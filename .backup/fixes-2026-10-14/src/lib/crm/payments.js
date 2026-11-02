import "server-only";

import { createRecord, getRecord, listRecords, updateRecord } from "@/lib/cms/records";
import { BOOKINGS } from "@/lib/cms/bookings";
import { PAYMENT_METHODS } from "@/lib/crm/schema";
import { emit } from "@/lib/crm/events";

/**
 * Money in.
 *
 * Two rules, both learned the hard way in every agency that has ever run this
 * on a spreadsheet:
 *
 *   THE STAGE FOLLOWS THE LEDGER. Nobody should have to remember to move a
 *   booking to "paid" after recording the payment that paid it. A status the
 *   ledger already implies, but which a human must set, is a status that will
 *   be wrong by Friday.
 *
 *   REFUNDS ARE NEGATIVE. Stored as negative amounts so the ledger sums to the
 *   truth without the reader having to know which rows to subtract.
 */

export const PAYMENTS = "payments";

export async function paymentsFor(bookingId) {
  const rows = await listRecords(PAYMENTS);
  return rows
    .filter((p) => p.bookingId === bookingId)
    .sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)));
}

/**
 * Record a payment and move the booking, atomically enough.
 *
 * The file store has no transactions, so the order matters: the payment is
 * written FIRST and the booking updated second. A crash between them leaves
 * money recorded against a booking whose running total is stale — visible and
 * repairable. The reverse would lose the payment entirely.
 */
export async function recordPayment({
  bookingId,
  amount,
  kind = "instalment",
  method,
  reference,
  note,
  receivedAt,
  actor,
  allowOverpayment = false,
}) {
  const booking = await getRecord(BOOKINGS, bookingId);
  if (!booking) return { error: "No such booking." };

  const value = Number(amount);
  if (!Number.isFinite(value) || value === 0) return { error: "Enter an amount." };
  if (!PAYMENT_METHODS.includes(method)) return { error: "Choose how it was paid." };

  const signed = kind === "refund" ? -Math.abs(value) : Math.abs(value);
  const collected = (booking.collected ?? 0) + signed;
  const total = booking.total ?? 0;

  // Warn, never block. Overpayments genuinely happen — currency rounding, a
  // customer settling two bookings in one transfer — and the system should not
  // be cleverer than the person holding the bank statement.
  if (!allowOverpayment && signed > 0 && collected > total) {
    return {
      needsConfirmation: true,
      message: `That takes the total collected to ₹${collected.toLocaleString(
        "en-IN"
      )} against a booking of ₹${total.toLocaleString("en-IN")}. Record it anyway?`,
    };
  }

  if (collected < 0) return { error: "That refund is more than has been collected." };

  const payment = await createRecord(PAYMENTS, {
    bookingId,
    leadId: booking.leadId ?? null,
    kind,
    amount: signed,
    method,
    reference: reference?.trim() || null,
    note: note?.trim() || null,
    receivedAt: receivedAt || new Date().toISOString(),
    recordedById: actor?.id ?? null,
    recordedByName: actor?.name ?? null,
  });

  // Never walk a booking backwards past work operations has already started.
  const settled = total > 0 && collected >= total;
  const nextStage =
    ["in-progress", "completed"].includes(booking.status)
      ? booking.status
      : settled
        ? "paid"
        : collected > 0
          ? "part-paid"
          : booking.status;

  const updated = await updateRecord(BOOKINGS, bookingId, {
    collected,
    status: nextStage,
  });

  await emit(
    "payment.received",
    {
      customerName: booking.name,
      customerEmail: booking.email,
      customerPhone: booking.phone,
      kind,
      method,
      reference: payment.reference,
      collected,
      outstanding: Math.max(0, total - collected),
      summary: `${kind === "refund" ? "Refund" : "Payment"} ₹${Math.abs(signed).toLocaleString(
        "en-IN"
      )} · ${method}`,
      customerMessage:
        kind === "refund"
          ? `A refund of ₹${Math.abs(signed).toLocaleString("en-IN")} has been processed.`
          : `We have received ₹${signed.toLocaleString("en-IN")} for ${booking.reference}. ${
              total - collected > 0
                ? `₹${(total - collected).toLocaleString("en-IN")} remains.`
                : "Your booking is now paid in full."
            }`,
    },
    {
      leadId: booking.leadId,
      bookingId,
      ownerId: booking.salesOwnerId,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      amount: signed,
    }
  );

  // Paid in full is what operations waits for — worth its own event so the
  // handover queue can surface it without polling the ledger.
  if (settled && booking.status !== "paid") {
    await emit(
      "booking.paid",
      {
        reference: booking.reference,
        customerName: booking.name,
        summary: `${booking.tripTitle} · paid in full`,
      },
      {
        leadId: booking.leadId,
        bookingId,
        ownerId: booking.salesOwnerId,
        amount: total,
      }
    );
  }

  return { payment, booking: updated };
}

export async function ledgerFor(bookingId) {
  const [booking, payments] = await Promise.all([
    getRecord(BOOKINGS, bookingId),
    paymentsFor(bookingId),
  ]);
  if (!booking) return null;

  const collected = payments.reduce((sum, p) => sum + p.amount, 0);

  return {
    booking,
    payments,
    collected,
    outstanding: Math.max(0, (booking.total ?? 0) - collected),
    // Surfaced rather than silently corrected: if the running total on the
    // booking disagrees with the ledger, something wrote one without the
    // other and somebody should know.
    reconciles: collected === (booking.collected ?? 0),
  };
}
