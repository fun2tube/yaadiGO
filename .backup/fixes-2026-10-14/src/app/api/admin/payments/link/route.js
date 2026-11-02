import { z } from "zod";
import { authorise } from "@/lib/cms/auth";
import "@/lib/crm";
import { getRecord, updateRecord } from "@/lib/cms/records";
import { BOOKINGS } from "@/lib/cms/bookings";
import { ledgerFor } from "@/lib/crm/payments";
import { createPaymentLink, razorpayConfigured } from "@/lib/crm/razorpay";
import { emit } from "@/lib/crm/events";

/**
 * "Send a payment link" — the single action that closes a sale.
 *
 * The salesperson says an amount or takes the default, and the customer gets a
 * UPI link on WhatsApp while they are still on the call. The webhook does the
 * rest.
 */

export const dynamic = "force-dynamic";

const Schema = z.object({
  bookingId: z.string().min(1).max(80),
  // Omitted means "whatever is still owed", which is what is wanted almost
  // every time and is one less number to get wrong under time pressure.
  amount: z.number().min(1).max(100000000).optional(),
  kind: z.enum(["advance", "instalment", "balance"]).optional(),
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

export async function POST(request) {
  const { user, denied } = await authorise("bookings.write");
  if (denied) return denied;

  if (!razorpayConfigured()) {
    return Response.json(
      { message: "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET." },
      { status: 503 }
    );
  }

  const parsed = Schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ message: "That didn't look right." }, { status: 400 });
  }

  const { bookingId, kind, expiresInDays } = parsed.data;
  const booking = await getRecord(BOOKINGS, bookingId);
  if (!booking) return Response.json({ message: "No such booking." }, { status: 404 });

  const ledger = await ledgerFor(bookingId);
  const outstanding = ledger?.outstanding ?? booking.total ?? 0;

  // Checked on the BOOKING, before the requested amount is even considered.
  // An earlier version only compared amount against outstanding, so passing an
  // explicit amount on a fully paid booking — where outstanding is 0 — skipped
  // the guard entirely and would have sent a second link to someone who had
  // already paid in full.
  if (outstanding <= 0) {
    return Response.json(
      { message: "This booking is paid in full. Nothing is outstanding." },
      { status: 409 }
    );
  }

  const amount = parsed.data.amount ?? outstanding;
  if (amount <= 0) {
    return Response.json({ message: "Enter an amount to collect." }, { status: 400 });
  }

  // Asking for more than is owed is almost always a typo, and a customer who
  // overpays has to be refunded by hand at our cost.
  if (amount > outstanding) {
    return Response.json(
      {
        message: `Only ₹${outstanding.toLocaleString("en-IN")} is outstanding. Send that, or record an overpayment deliberately.`,
      },
      { status: 409 }
    );
  }

  const result = await createPaymentLink({
    booking,
    amount,
    kind: kind ?? (ledger?.collected > 0 ? "balance" : "advance"),
    expiresInDays,
  });
  if (result.error) return Response.json({ message: result.error }, { status: 502 });

  // Kept on the booking so the link can be resent without making a second one,
  // and so the desk can see one was already sent rather than sending a third.
  await updateRecord(BOOKINGS, bookingId, {
    paymentLinks: [...(booking.paymentLinks ?? []), { ...result.link, sentAt: new Date().toISOString() }],
  });

  // The event spine fans this out to the customer on WhatsApp and email. This
  // route does not message anyone itself — subscribers do, which is why a new
  // channel never means editing this file.
  await emit(
    "payment.link.sent",
    {
      customerName: booking.name,
      customerEmail: booking.email,
      customerPhone: booking.phone,
      title: booking.tripTitle,
      url: result.link.url,
      summary: `₹${amount.toLocaleString("en-IN")} ${result.link.kind} link sent`,
      customerMessage: `Here is your secure payment link for ${booking.tripTitle} — ₹${amount.toLocaleString(
        "en-IN"
      )}. Pay by UPI, card or net banking: ${result.link.url}`,
    },
    {
      bookingId,
      leadId: booking.leadId ?? null,
      ownerId: booking.salesOwnerId ?? user.id,
      amount,
    }
  );

  return Response.json({ link: result.link });
}
