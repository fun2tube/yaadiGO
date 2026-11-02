import "server-only";

import { createRecord, getRecord, listRecords, updateRecord } from "@/lib/cms/records";
import { BOOKINGS } from "@/lib/cms/bookings";
import { getQuotation } from "@/lib/crm/quotations";
import { getLead, markConverted } from "@/lib/crm/leads";
import { emit } from "@/lib/crm/events";
import { advanceFromSchedule } from "@/lib/crm/quote-content";
import { bookingHoldsSeats } from "@/lib/crm/schema";

/**
 * Approved quotation → booking.
 *
 * This was the broken link. Approving a quotation marked the lead won and
 * stopped there, so a "won" lead had nothing behind it: no money owed, no
 * payment schedule, nothing for operations to pick up. The reconciliation
 * check on the reports page caught it on its first real run, which is the
 * whole reason that check exists.
 *
 * A customised booking differs from a fixed-departure one in exactly two ways:
 * there is no seat inventory to move, and the price comes from the quotation
 * rather than a departure. Everything downstream — payments, the ops handover,
 * the timeline — is identical, which is why they share a record shape rather
 * than getting a parallel pipeline.
 */

/** Short, human, and safe to read aloud on a phone call. */
function reference() {
  const year = new Date().getFullYear().toString().slice(-2);
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `YG${year}-${random}`;
}

/**
 * The advance a quotation asks for: the first row of ITS payment schedule.
 *
 * This was a separate rule here — 25%, floored at ₹10,000 — while the
 * customer's page printed the schedule (₹5,000 a person). The board asked for
 * ₹16,039 on a quote whose customer had been told ₹10,000 (review
 * 2026-10-14-full-function-test, F7). One rule now, in quote-content.js.
 */
export function advanceForQuotation(quotation) {
  return advanceFromSchedule(
    quotation.total ?? 0,
    quotation.content?.paymentSchedule ?? undefined,
    quotation.travellers
  );
}

export async function bookingForQuotation(quotationId) {
  const rows = await listRecords(BOOKINGS);
  return rows.find((b) => b.quotationId === quotationId) ?? null;
}

/** Bookings that are still live — the ones a new approval must not duplicate. */
const CLOSED = new Set(["cancelled", "completed"]);

/**
 * The lead's live booking, if it has one.
 *
 * One lead is one enquiry is one trip. A customer who requested seats on the
 * website and then approved the quotation the desk built for them has ONE
 * trip, and it used to be recorded as two: the seat request (₹54,000) and the
 * approved quote (₹64,155), so the lead, Reports and the invoice queue all
 * showed ₹1,18,155 owed (review 2026-10-14-full-function-test, F1). The same
 * happened when v2 of a quotation was approved after v1 — a revision is a new
 * record, so the per-quotation check above never saw it.
 *
 * The most recently created live booking wins if there are somehow several.
 */
export async function openBookingForLead(leadId) {
  if (!leadId) return null;
  const rows = await listRecords(BOOKINGS);
  return (
    rows
      .filter((b) => b.leadId === leadId && !CLOSED.has(b.status))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] ?? null
  );
}

/**
 * What an approved quotation sets on a booking.
 *
 * Money and the itinerary come from the quotation, because that is what the
 * customer approved. The departure, the seats and the status do NOT: a seat
 * request keeps its batch (and its seats, if the desk already confirmed it),
 * and a booking already part-paid stays part-paid.
 */
export function quotationTerms(quotation, booking = null) {
  const advance = advanceForQuotation(quotation);
  const departureStart = booking?.departureStart ?? quotation.startDate ?? null;
  return {
    quotationId: quotation.id,
    tripTitle: quotation.title,
    departureLabel: booking?.departureId
      ? booking.departureLabel
      : quotation.startDate ?? booking?.departureLabel ?? "Dates to confirm",
    departureStart,
    travellers: quotation.travellers,
    perPerson: quotation.perPerson,
    total: quotation.total,
    advance,
    balance: Math.max(0, quotation.total - advance),
    itinerary: quotation.itinerary ?? booking?.itinerary ?? null,
    inclusions: quotation.inclusions ?? [],
    exclusions: quotation.exclusions ?? [],
  };
}

/**
 * Turn an approved quotation into a booking.
 *
 * Idempotent: approving twice, or a retry after a dropped connection, returns
 * the existing booking rather than creating a second one. Duplicate bookings
 * are worse than none — they double the revenue in every report and somebody
 * eventually chases the customer for money they already paid.
 */
export async function convertQuotationToBooking(quotationId, { actor } = {}) {
  const quotation = await getQuotation(quotationId);
  if (!quotation) return { error: "No such quotation." };

  if (quotation.status !== "approved") {
    return { error: "Only an approved quotation becomes a booking." };
  }

  const existing = await bookingForQuotation(quotationId);
  if (existing) return { booking: existing, alreadyExisted: true };

  const lead = await getLead(quotation.leadId);

  // The lead already has a trip on the books (a seat request, or an earlier
  // version of this quotation): the approval updates THAT booking.
  const live = await openBookingForLead(quotation.leadId);
  if (live) {
    const terms = quotationTerms(quotation, live);
    const notes = [
      ...(live.notes ?? []),
      {
        body: `Quotation v${quotation.version ?? 1} approved — total now ₹${Number(
          quotation.total ?? 0
        ).toLocaleString("en-IN")} (was ₹${Number(live.total ?? 0).toLocaleString("en-IN")}).`,
        at: new Date().toISOString(),
      },
    ];

    // Seats on a batch are counted from `travellers` on seat-holding bookings
    // (lib/inventory.js). Changing the head count of a booking that already
    // holds seats would take or free seats WITHOUT the trip lock that checks
    // the batch has room — an oversell. So the seat count stays as it is and
    // the desk is told to change it on the bookings board, where the lock is.
    const holding = Boolean(live.departureId) && bookingHoldsSeats(live.status);
    if (holding && Number(terms.travellers) !== Number(live.travellers)) {
      notes.push({
        body: `The quotation is for ${terms.travellers} travellers but this booking holds ${live.travellers} seats on the batch. Seats were not changed — adjust them before departure.`,
        at: new Date(Date.now() + 1).toISOString(),
      });
      terms.travellers = live.travellers;
    }

    const booking = await updateRecord(BOOKINGS, live.id, { ...terms, notes });

    await markConverted(quotation.leadId, { value: quotation.total, actor, bookingId: booking.id });

    await emit(
      "booking.updated",
      {
        customerName: booking.name,
        reference: booking.reference,
        summary: `${booking.tripTitle} · quotation v${quotation.version ?? 1} approved · ₹${Number(
          booking.total ?? 0
        ).toLocaleString("en-IN")}`,
      },
      {
        leadId: booking.leadId,
        quotationId: quotation.id,
        bookingId: booking.id,
        ownerId: booking.salesOwnerId ?? quotation.ownerId ?? null,
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? null,
        amount: booking.total,
      }
    );

    return { booking, linkedExisting: true };
  }

  const booking = await createRecord(BOOKINGS, {
    reference: reference(),
    // Tells every downstream screen which rules apply: no seats to hold, and
    // the itinerary lives on the quotation rather than on a trip page.
    source: "quotation",
    // NOT "confirmed". Approval means "build it"; the desk still has to check
    // the hotels and take the advance — the customer's own page says the
    // booking is confirmed once the advance arrives. Marking it confirmed here
    // put an unagreed advance into "awaiting payment" and sent ops a trip with
    // nothing paid (F8).
    status: "requested",

    leadId: quotation.leadId,
    tripSlug: null,
    departureId: null,

    ...quotationTerms(quotation),
    // Operations builds the real service list from this.
    itinerary: quotation.itinerary ?? lead?.itinerary ?? null,
    collected: 0,

    name: lead?.name ?? null,
    phone: lead?.phone ?? null,
    email: lead?.email ?? null,

    // Whoever owned the lead keeps the revenue. Attribution follows the work,
    // not whoever happened to press the button.
    salesOwnerId: quotation.ownerId ?? lead?.ownerId ?? null,
    opsOwnerId: null,
    handedToOpsAt: null,

    seatsHeld: 0,
    notes: [],
  });

  await markConverted(quotation.leadId, {
    value: quotation.total,
    actor,
    bookingId: booking.id,
  });

  await emit(
    "booking.created",
    {
      customerName: booking.name,
      customerEmail: booking.email,
      customerPhone: booking.phone,
      reference: booking.reference,
      summary: `${booking.tripTitle} · ${booking.travellers} travellers`,
      customerMessage: `Your booking ${booking.reference} is registered. A travel expert will call to confirm dates and arrange the ₹${booking.advance.toLocaleString(
        "en-IN"
      )} advance.`,
    },
    {
      leadId: booking.leadId,
      quotationId: booking.quotationId,
      bookingId: booking.id,
      ownerId: booking.salesOwnerId,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      amount: booking.total,
    }
  );

  return { booking };
}

/**
 * Hand a booking to operations.
 *
 * Deliberately explicit rather than automatic on payment. Operations starts
 * spending real money with suppliers the moment they pick it up, and "the
 * system moved it" is not a good enough reason to be committing a hotel
 * deposit. Sales presses the button when the money is actually in.
 */
export async function handToOperations(bookingId, { actor, opsOwnerId } = {}) {
  const booking = await getRecord(BOOKINGS, bookingId);
  if (!booking) return { error: "No such booking." };
  if (booking.handedToOpsAt) return { booking, alreadyExisted: true };

  if (!["paid", "part-paid", "confirmed"].includes(booking.status)) {
    return { error: "Confirm the booking before handing it over." };
  }

  const updated = await updateRecord(BOOKINGS, bookingId, {
    handedToOpsAt: new Date().toISOString(),
    opsOwnerId: opsOwnerId ?? null,
  });

  await emit(
    "booking.handover",
    {
      reference: booking.reference,
      customerName: booking.name,
      summary: `${booking.tripTitle} · departs ${booking.departureLabel}`,
      outstanding: Math.max(0, (booking.total ?? 0) - (booking.collected ?? 0)),
    },
    {
      leadId: booking.leadId,
      bookingId: booking.id,
      ownerId: opsOwnerId ?? booking.salesOwnerId,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      amount: booking.total,
    }
  );

  return { booking: updated };
}
