import { formatDepartureRange } from "@/lib/tours";

/**
 * The booking record a seat request from the trip page creates.
 *
 * One builder, so the app and the database test (db/booking-records.test.ts)
 * write exactly the same shape. Until 2026-10-10 this record had no
 * `reference` or `source` — both NOT NULL — and pointed at a departure with no
 * row in `departures`, so Postgres refused every one of them: seat requests
 * reached the inbox as leads, but never became bookings.
 */

export function bookingReference() {
  const year = new Date().getFullYear().toString().slice(-2);
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `YG${year}-${random}`;
}

export function buildBookingRequest({ tour, departure, quote, travellers, leadId = null, contact = {}, salesOwnerId = null }) {
  return {
    reference: bookingReference(),
    // The two doors into bookings: "website" (a fixed departure reserved on a
    // trip page) and "quotation" (a customised quote the customer approved).
    source: "website",
    status: "requested",
    leadId,
    tripSlug: tour.slug,
    tripTitle: tour.title,
    departureId: departure.id,
    departureLabel: formatDepartureRange(departure),
    departureStart: departure.start,
    sharing: quote.sharing.label,
    pickup: quote.pickup.city,
    travellers,
    perPerson: quote.perPerson,
    total: quote.total,
    advance: quote.advance,
    balance: quote.balance,
    // Snapshot of what the batch looked like when they asked. Useful when the
    // desk rings back a week later and the numbers no longer match.
    seatsLeftAtRequest: departure.seatsLeft,
    name: contact.name ?? null,
    phone: contact.phone ?? null,
    email: contact.email ?? null,
    // Whoever owns the lead owns the booking. Without it a seat request had no
    // salesperson, so it was invisible to the one person meant to work it once
    // bookings were scoped to their owner (F6, 2026-10-14).
    salesOwnerId,
    notes: [],
  };
}
