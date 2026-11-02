import "server-only";

import { createRecord, getRecord, updateRecord } from "@/lib/cms/records";
import { BOOKINGS } from "@/lib/cms/bookings";
import { getQuotation } from "@/lib/crm/quotations";
import { getLead, markConverted } from "@/lib/crm/leads";
import { emit } from "@/lib/crm/events";

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
 * The advance a customised trip asks for.
 *
 * 25%, floored at ₹10,000 and capped at ₹50,000. A percentage alone asks
 * ₹250 on a cheap trip (not worth raising an invoice for) and ₹1,50,000 on an
 * expensive one (which customers refuse before they have met you).
 */
function advanceFor(total) {
  const quarter = Math.round(total * 0.25);
  return Math.min(Math.max(quarter, 10000), 50000);
}

export async function bookingForQuotation(quotationId) {
  const rows = await import("@/lib/cms/records").then((m) => m.listRecords(BOOKINGS));
  return rows.find((b) => b.quotationId === quotationId) ?? null;
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

  const booking = await createRecord(BOOKINGS, {
    reference: reference(),
    // Tells every downstream screen which rules apply: no seats to hold, and
    // the itinerary lives on the quotation rather than on a trip page.
    source: "quotation",
    status: "confirmed",

    leadId: quotation.leadId,
    quotationId: quotation.id,
    tripSlug: null,
    departureId: null,

    tripTitle: quotation.title,
    departureLabel: quotation.startDate ?? "Dates to confirm",
    departureStart: quotation.startDate ?? null,

    travellers: quotation.travellers,
    perPerson: quotation.perPerson,
    total: quotation.total,
    advance: advanceFor(quotation.total),
    balance: quotation.total - advanceFor(quotation.total),
    collected: 0,

    name: lead?.name ?? null,
    phone: lead?.phone ?? null,
    email: lead?.email ?? null,

    // Whoever owned the lead keeps the revenue. Attribution follows the work,
    // not whoever happened to press the button.
    salesOwnerId: quotation.ownerId ?? lead?.ownerId ?? null,
    opsOwnerId: null,
    handedToOpsAt: null,

    // Operations builds the real service list from this.
    itinerary: quotation.itinerary ?? lead?.itinerary ?? null,
    inclusions: quotation.inclusions ?? [],
    exclusions: quotation.exclusions ?? [],

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
