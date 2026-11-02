import "server-only";

import {
  createRecord,
  getRecord,
  listRecords,
  updateRecord,
} from "@/lib/cms/records";
import { getTrip } from "@/lib/cms/catalogue";
import { ensureDepartureRows, moveBookingSeats } from "@/lib/cms/seats";
import { buildBookingRequest } from "@/lib/cms/booking-record";
import { quoteBooking } from "@/lib/tours";
import { BOOKING_STAGES, bookingHoldsSeats, canSeeBooking, visibleBookings } from "@/lib/crm/schema";

/**
 * Seat reservations for fixed departures.
 *
 * The public panel reserves, it does not charge — there is no payment gateway
 * in this project. So a "booking" here is a request the desk works through by
 * hand, and the only thing that has to be right is the seat count: a batch
 * that keeps advertising six seats after four are spoken for oversells, and
 * the desk finds out when it has to phone someone and take it back.
 *
 * Seats therefore move on CONFIRM, not on request. Requests are cheap and
 * frequently abandoned; holding stock against every one of them would empty
 * the batch within a day of launch.
 *
 * Statuses:
 *   requested  — traveller asked, no seats held
 *   confirmed  — desk verified room; seats deducted from the batch
 *   paid       — advance received (recorded by hand, no gateway)
 *   completed  — travelled
 *   cancelled  — seats returned to the batch if they were held
 */

export const BOOKINGS = "bookings";

/**
 * Derived, not retyped.
 *
 * This list used to be five statuses written out by hand while
 * `BOOKING_STAGES` in lib/crm/schema.js had seven. `recordPayment` sets
 * `part-paid`, which this list rejected — so a part-paid booking could not be
 * moved by anyone, through any screen. Two lists of the same thing will always
 * drift; there is now one, and this is a view of it.
 */
export const BOOKING_STATUSES = BOOKING_STAGES.map((stage) => stage.value);

/**
 * Statuses in which the seats are deducted from the batch.
 *
 * Also derived. The hand-written set here omitted `part-paid` and
 * `in-progress`, so a booking that had been part-paid would have had its seats
 * released on the next status change — quietly putting a sold seat back on
 * sale.
 */
export function holdsSeats(status) {
  return bookingHoldsSeats(status);
}

/**
 * Build a booking from what the traveller chose.
 *
 * The client posts choices — trip, batch, room, pickup, headcount — and never
 * money. Every rupee is recomputed here from the live catalogue, so a tampered
 * form cannot reserve a ₹32,000 seat for ₹1, and a price the admin changed
 * mid-session cannot be locked in at the stale figure.
 *
 * Returns null when the selection does not resolve to a real, bookable batch.
 */
export async function createBookingRequest({
  tripSlug,
  departureId,
  sharingId,
  pickupId,
  travellers,
  leadId = null,
  contact = {},
  salesOwnerId = null,
  // Converting a salesperson's hold: those seats are already the customer's,
  // so a batch the hold itself filled (or that closed since) is not a reason
  // to refuse. A cancelled or finished batch still is.
  fromHold = false,
}) {
  const tour = await getTrip(tripSlug);
  if (!tour) return null;

  const departure = tour.departures.find((d) => d.id === departureId);
  if (!departure) return null;
  // Full, past the cut-off, closed, cancelled or already run: not a batch anyone
  // can be sold onto, whatever the form said. The enquiry itself is already a
  // lead, so nothing is lost — the desk sees it and offers another date.
  if (departure.bookable === false) {
    const stillRunning = departure.status !== "cancelled" && departure.status !== "completed";
    if (!(fromHold && stillRunning)) return null;
  }

  const people = Math.min(Math.max(Number.parseInt(travellers, 10) || 1, 1), 20);
  const quote = quoteBooking({ tour, departure, sharingId, pickupId, travellers: people });

  // The batch's row in `departures` must exist before a booking can point
  // at it (foreign key). It is kept in step under the trip's lock. A hold
  // conversion already holds that lock and anchored the row first —
  // re-locking here would wait on itself forever.
  if (!fromHold) await ensureDepartureRows(tripSlug);

  return createRecord(
    BOOKINGS,
    buildBookingRequest({ tour, departure, quote, travellers: people, leadId, contact, salesOwnerId })
  );
}

/**
 * Apply a status change.
 *
 * Seats are derived from bookings, so a status change IS the seat change.
 * Crossing the "holds seats" line runs under the trip's lock (seats.js):
 * taking is checked against the live count first; giving back notifies the
 * desk if the batch has a waitlist.
 */
export async function setBookingStatus(id, status, { note } = {}) {
  if (!BOOKING_STATUSES.includes(status)) {
    return { ok: false, message: "Unknown status." };
  }

  const booking = await getRecord(BOOKINGS, id);
  if (!booking) return { ok: false, message: "No such booking." };

  // Confirming a booking that already has money on it (a gateway payment that
  // arrived before the desk confirmed) lands where the ledger says it is.
  // "Confirmed" with ₹10,000 collected would ask the customer for an advance
  // they have already paid.
  if (status === "confirmed" && (booking.collected ?? 0) > 0) {
    status = (booking.collected ?? 0) >= (booking.total ?? 0) ? "paid" : "part-paid";
  }
  if (booking.status === status) return { ok: true, booking };

  const wasHolding = holdsSeats(booking.status);
  const willHold = holdsSeats(status);

  const notes = note
    ? [...(booking.notes ?? []), { body: note, at: new Date().toISOString() }]
    : booking.notes ?? [];

  let updated = null;
  const write = async () => {
    // A number, not a flag: `seats_held` is an integer column — how many
    // seats this booking has off the batch. A boolean here was refused by
    // Postgres (found 2026-10-10).
    updated = await updateRecord(BOOKINGS, id, {
      status,
      notes,
      seatsHeld: willHold ? Number(booking.travellers) || 0 : 0,
    });
  };

  // Seats are derived from bookings (lib/inventory.js), so there is no counter
  // to move. Crossing the "holds seats" line still happens under the trip's
  // lock: taking seats is checked against the live count and refused if the
  // batch is full, closed or cancelled; giving them back tells the desk if
  // anyone is on the waitlist.
  if (wasHolding !== willHold) {
    const moved = await moveBookingSeats(booking, { taking: willHold, update: write });
    if (!moved.ok) return moved;
  } else {
    await write();
  }
  return { ok: true, booking: updated };
}

export async function addBookingNote(id, body) {
  const booking = await getRecord(BOOKINGS, id);
  if (!booking) return null;
  return updateRecord(BOOKINGS, id, {
    notes: [...(booking.notes ?? []), { body, at: new Date().toISOString() }],
  });
}

export async function listBookings() {
  const rows = await listRecords(BOOKINGS);
  // Soonest departure first: what leaves next is what the desk must settle.
  return [...rows].sort((a, b) => (a.departureStart ?? "").localeCompare(b.departureStart ?? ""));
}

/**
 * A booking's salesperson. Seat requests made before 2026-10-14 carry no
 * `salesOwnerId`; for those the lead's owner is the answer, so scoping never
 * hides a booking from the person whose lead it is.
 */
async function withOwners(rows) {
  if (!rows.some((b) => !b.salesOwnerId && b.leadId)) return rows;
  const leads = await listRecords("leads");
  const ownerOf = new Map(leads.map((l) => [l.id, l.ownerId ?? null]));
  return rows.map((b) =>
    b.salesOwnerId || !b.leadId ? b : { ...b, salesOwnerId: ownerOf.get(b.leadId) ?? null }
  );
}

/** The bookings this person may see (lib/crm/schema.js `bookingScope`). */
export async function listBookingsFor(user) {
  return visibleBookings(user, await withOwners(await listBookings()));
}

/** One booking, or null if it does not exist OR this person may not see it. */
export async function getBookingFor(user, id) {
  const booking = await getRecord(BOOKINGS, id);
  if (!booking) return null;
  const [resolved] = await withOwners([booking]);
  return canSeeBooking(user, resolved) ? booking : null;
}
