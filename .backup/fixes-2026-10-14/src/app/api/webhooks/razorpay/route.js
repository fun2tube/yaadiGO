import "@/lib/crm";
import { recordPayment } from "@/lib/crm/payments";
import { listRecords } from "@/lib/cms/records";
import { PAYMENTS } from "@/lib/crm/payments";
import { verifyWebhook, toRupees, methodFromRazorpay } from "@/lib/crm/razorpay";

/**
 * Razorpay webhook.
 *
 * This is the whole point of the gateway: the customer pays on their phone and
 * the booking updates with nobody typing. A payment recorded by hand from a
 * screenshot is a payment recorded late, wrongly, or not at all.
 *
 * Three rules this route is built around:
 *
 *   1. VERIFY FIRST, PARSE SECOND. The signature is HMAC over the RAW body, so
 *      the body is read as text and only parsed after it checks out. An
 *      unauthenticated endpoint that writes to the payment ledger is the worst
 *      possible thing to get wrong.
 *
 *   2. ALWAYS 200 ONCE VERIFIED. Razorpay retries non-2xx for days. A payment
 *      we have already recorded, or an event we do not handle, is not a failure
 *      — returning 500 for it produces a retry storm and duplicate ledger rows.
 *      A genuine internal error is the one case worth a 500, so the retry is
 *      useful.
 *
 *   3. IDEMPOTENT BY PAYMENT ID. Razorpay delivers the same event more than
 *      once, by design. The gateway's payment id is stored as the reference and
 *      checked before writing.
 */

export const dynamic = "force-dynamic";

/** Already in the ledger? Razorpay re-delivers, so this is not optional. */
async function alreadyRecorded(paymentId) {
  const rows = await listRecords(PAYMENTS);
  return rows.some((row) => row.reference === paymentId);
}

export async function POST(request) {
  // Raw text, not request.json(). Re-serialising changes key order and
  // whitespace, the HMAC stops matching, and every webhook gets rejected —
  // the most common way a correct integration appears broken.
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  const check = verifyWebhook(raw, signature);
  if (!check.ok) {
    console.error(`[razorpay] webhook rejected — ${check.reason}`);
    // 400, not 500: a bad signature is not something a retry will fix, and
    // this is the one path where we want Razorpay to stop.
    return Response.json({ message: "Invalid signature." }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ message: "Malformed body." }, { status: 400 });
  }

  const type = event?.event;

  // Only the events that move money. `payment_link.paid` is the one that
  // matters for a link we issued; `payment.captured` covers a payment taken
  // any other way against the same notes.
  if (type !== "payment_link.paid" && type !== "payment.captured") {
    return Response.json({ ok: true, ignored: type ?? "unknown" });
  }

  const payment =
    event?.payload?.payment?.entity ?? event?.payload?.payment_link?.entity ?? null;
  const link = event?.payload?.payment_link?.entity ?? null;

  if (!payment?.id) {
    console.error("[razorpay] verified webhook carried no payment entity", type);
    return Response.json({ ok: true, ignored: "no payment entity" });
  }

  // The booking id travels in `notes`, which we set when creating the link and
  // the customer cannot edit. Never trust anything else to identify a booking.
  const notes = payment.notes ?? link?.notes ?? {};
  const bookingId = notes.bookingId;
  if (!bookingId) {
    console.error(`[razorpay] payment ${payment.id} has no bookingId in notes — not recorded`);
    return Response.json({ ok: true, ignored: "no bookingId" });
  }

  try {
    if (await alreadyRecorded(payment.id)) {
      return Response.json({ ok: true, duplicate: payment.id });
    }

    const result = await recordPayment({
      bookingId,
      amount: toRupees(payment.amount),
      kind: notes.kind === "balance" || notes.kind === "instalment" ? notes.kind : "advance",
      method: methodFromRazorpay(payment.method),
      reference: payment.id,
      note: `Razorpay ${type}${link?.short_url ? ` · ${link.short_url}` : ""}`,
      // No actor: nobody on the team did this, the customer did. Attributing it
      // to a salesperson would corrupt the activity reporting the KPIs read.
      actor: null,
      // The gateway took the money. Refusing to record it because it exceeds
      // our expected total would leave the ledger disagreeing with the bank,
      // which is strictly worse than an overpayment we can see and refund.
      allowOverpayment: true,
      // Recorded even on a booking nobody has confirmed yet — the bank has
      // the money either way. The booking keeps its status; seats still move
      // only when the desk confirms (lib/crm/payments.js).
      fromGateway: true,
    });

    if (result.error) {
      console.error(`[razorpay] could not record payment ${payment.id} — ${result.error}`);
      // 200 deliberately: a retry will hit the same validation error forever.
      // The payment is in the Razorpay dashboard and the log names it.
      return Response.json({ ok: true, recorded: false, reason: result.error });
    }

    console.info(
      `[razorpay] recorded ${payment.id} — ₹${toRupees(payment.amount).toLocaleString("en-IN")} on booking ${bookingId}`
    );
    return Response.json({ ok: true, recorded: true });
  } catch (error) {
    // The one case worth a 500. Something is broken on our side and the retry
    // is genuinely useful.
    console.error("[razorpay] webhook handler threw", error);
    return Response.json({ message: "Internal error." }, { status: 500 });
  }
}
