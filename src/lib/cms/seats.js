import "server-only";

import crypto from "node:crypto";
import { createRecord, getRecord, listRecords, mutateBy, updateRecord, upsertBy } from "@/lib/cms/records";
import { groupTours } from "@/lib/tours";
import { bookingHoldsSeats } from "@/lib/crm/schema";
import { emit } from "@/lib/crm/events";
import {
  HOLD_HOURS,
  commitments,
  departureState,
  holdIsActive,
  normaliseCapacity,
  refusal,
} from "@/lib/inventory";

/**
 * Seat inventory, phase 2 (docs/design/trip-management.md §4.2).
 *
 * Seats are DERIVED (lib/inventory.js): capacity − booked − active holds.
 * Anything that takes or returns seats runs inside `withTripLock`, which
 * locks the trip's departures row (SELECT … FOR UPDATE on Postgres, a
 * serialised chain on the file store) and performs its write INSIDE that
 * lock. Two people confirming the last seat therefore queue: the second one
 * recounts after the first has written, and is refused.
 *
 * Holds and the waitlist are document collections, so none of this needed a
 * database migration.
 */

// Same collection catalogue.js reads; the name is repeated rather than
// imported so this module and the catalogue do not import each other.
const TRIP_OVERRIDES = "tripOverrides";
export const SEAT_HOLDS = "seatHolds";
export const WAITLIST = "waitlist";

const ref = () => crypto.randomUUID().slice(0, 12);

const codeDepartures = (slug) => groupTours.find((t) => t.slug === slug)?.departures ?? [];

/** Every booking and hold, reduced to travellers per batch. */
export async function loadCommitments(now = Date.now()) {
  const [bookings, holds] = await Promise.all([listRecords("bookings"), listRecords(SEAT_HOLDS)]);
  return {
    ...commitments({ bookings: bookings ?? [], holds: holds ?? [], holdsSeats: bookingHoldsSeats, now }),
    bookings: bookings ?? [],
    holds: holds ?? [],
  };
}

/**
 * Run `work` with the trip's departures locked.
 *
 * `work` receives the batches (capacity made explicit — see
 * normaliseCapacity) and their live state, and returns either
 * `{ error }` to refuse, or `{ departures? }` to change the batches. Any
 * record writes it makes happen while the lock is held.
 */
export async function withTripLock(slug, work) {
  let outcome = { ok: true };
  await mutateBy(TRIP_OVERRIDES, "slug", slug, async (existing) => {
    const now = Date.now();
    const { booked, held, bookings, holds } = await loadCommitments(now);
    const departures = normaliseCapacity(existing?.departures ?? codeDepartures(slug), slug, booked);
    const states = departures.map((d) => departureState(d, { tripSlug: slug, booked, held, now }));

    const result = await work({ departures, states, bookings, holds, now });
    if (result?.error) {
      outcome = { ok: false, message: result.error };
      return null;
    }
    outcome = { ok: true, ...(result?.value ? { value: result.value } : {}) };
    const next = result?.departures ?? departures;
    await syncDepartureRows(slug, departures, next);
    // Persisting even when nothing changed is deliberate: it fixes each old
    // batch's capacity the first time it is touched, before any count moves.
    return { departures: next };
  });
  return outcome;
}

/**
 * Keep a row in the `departures` TABLE for every batch.
 *
 * Bookings reference `departures.id` with a foreign key, so a booking on a
 * batch with no row is refused by the database — which is why website seat
 * requests never became bookings before 2026-10-10. The editable source of a
 * batch stays the trip's document; this row is its anchor for the key, and a
 * plain-SQL view of seats for reports and ops.
 *
 * Rows are never deleted: a removed batch is unpublished, because cancelled
 * bookings may still point at it.
 */
async function syncDepartureRows(slug, before, after) {
  const { booked, held } = await loadCommitments();
  const keep = new Set(after.map((d) => d.id));
  for (const d of after) {
    const state = departureState(d, { tripSlug: slug, booked, held });
    await upsertBy("departures", "id", d.id, {
      tripSlug: slug,
      startDate: d.start,
      endDate: d.end,
      price: d.price,
      seatsTotal: state.capacity,
      seatsLeft: Math.min(state.capacity, Math.max(0, state.seatsLeft)),
      published: !d.cancelled,
    });
  }
  for (const d of before) {
    if (!keep.has(d.id)) await upsertBy("departures", "id", d.id, { published: false });
  }
}

/** Make sure every batch of a trip has its `departures` row (see above). */
export async function ensureDepartureRows(slug) {
  return withTripLock(slug, async () => ({}));
}

/** Tell the desk a seat came free on a batch people are waiting for. */
async function seatsFreed(slug, departureId, title) {
  const waiting = ((await listRecords(WAITLIST)) ?? []).filter(
    (w) => w.tripSlug === slug && w.departureId === departureId && w.status === "waiting"
  );
  if (!waiting.length) return;
  await emit(
    "departure.seat_freed",
    {
      summary: `${title ?? slug} — a seat came free, ${waiting.length} on the waitlist.`,
      href: `/admin/departures/${slug}/${departureId}`,
    },
    {}
  );
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

/**
 * Move a booking across the "holds seats" line, under the lock.
 *
 * Taking seats is checked against the live count and refused if the batch is
 * full, closed or cancelled. `update` (the booking write) runs inside the
 * lock, so the next confirmation counts this one.
 */
export async function moveBookingSeats(booking, { taking, update }) {
  if (!booking.departureId || !booking.tripSlug) {
    await update();
    return { ok: true };
  }

  const result = await withTripLock(booking.tripSlug, async ({ states }) => {
    if (taking) {
      const state = states.find((s) => s.id === booking.departureId);
      if (!state) return { error: "That departure no longer exists." };
      const no = refusal(state, Number(booking.travellers) || 1);
      if (no) return { error: no };
    }
    await update();
    return {};
  });

  if (result.ok && !taking) await seatsFreed(booking.tripSlug, booking.departureId, booking.tripTitle);
  return result;
}

// ---------------------------------------------------------------------------
// Holds
// ---------------------------------------------------------------------------

export async function listHolds({ tripSlug, departureId } = {}) {
  const now = Date.now();
  return ((await listRecords(SEAT_HOLDS)) ?? [])
    .filter((h) => (!tripSlug || h.tripSlug === tripSlug) && (!departureId || h.departureId === departureId))
    .map((h) => ({ ...h, active: holdIsActive(h, now), expired: h.status === "active" && !holdIsActive(h, now) }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/** Keep seats off sale for a named person for HOLD_HOURS. */
export async function createHold({ tripSlug, departureId, seats, name, phone, leadId = null, note = "", actor }) {
  const count = Math.trunc(Number(seats));
  if (!(count >= 1 && count <= 20)) return { error: "Hold between 1 and 20 seats." };
  if (!String(name ?? "").trim()) return { error: "Whose seats are these? Add a name." };

  const result = await withTripLock(tripSlug, async ({ states, now }) => {
    const state = states.find((s) => s.id === departureId);
    if (!state) return { error: "That departure no longer exists." };
    const no = refusal(state, count);
    if (no) return { error: no };

    const hold = await createRecord(SEAT_HOLDS, {
      ref: ref(),
      tripSlug,
      departureId,
      seats: count,
      name: String(name).trim().slice(0, 120),
      phone: String(phone ?? "").trim().slice(0, 30),
      leadId,
      note: String(note ?? "").trim().slice(0, 500),
      status: "active",
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + HOLD_HOURS * 3_600_000).toISOString(),
      heldById: actor?.id ?? null,
      heldByName: actor?.name ?? null,
    });
    return { value: hold };
  });

  return result.ok ? { hold: result.value } : { error: result.message };
}

/** Give held seats back — the customer said no, or it was a mistake. */
export async function releaseHold(id, { actor } = {}) {
  const hold = await getRecord(SEAT_HOLDS, id);
  if (!hold) return { error: "No such hold." };
  if (hold.status !== "active") return { error: "That hold is no longer active." };

  const result = await withTripLock(hold.tripSlug, async () => {
    await updateRecord(SEAT_HOLDS, id, {
      status: "released",
      releasedAt: new Date().toISOString(),
      releasedByName: actor?.name ?? null,
    });
    return {};
  });
  if (!result.ok) return { error: result.message };
  await seatsFreed(hold.tripSlug, hold.departureId);
  return { ok: true };
}

/**
 * Turn a hold into a confirmed booking in one step, with no moment where the
 * seats are neither held nor booked — someone else could take them in that
 * gap. `makeBooking` creates the booking record; it runs inside the lock.
 */
export async function convertHold(id, { makeBooking }) {
  const hold = await getRecord(SEAT_HOLDS, id);
  if (!hold) return { error: "No such hold." };
  if (!holdIsActive(hold)) return { error: "That hold has expired or been released — check the seats are still free and hold again." };

  // The booking about to be created points at the batch's departures row, so
  // make sure it exists BEFORE taking the lock — `makeBooking` runs inside
  // the lock and must not try to take it again.
  await ensureDepartureRows(hold.tripSlug);

  const result = await withTripLock(hold.tripSlug, async () => {
    const booking = await makeBooking(hold);
    if (!booking) return { error: "That departure no longer exists." };
    await updateRecord(SEAT_HOLDS, id, {
      status: "converted",
      bookingId: booking.id,
      convertedAt: new Date().toISOString(),
    });
    return { value: booking };
  });
  return result.ok ? { booking: result.value } : { error: result.message };
}

// ---------------------------------------------------------------------------
// Waitlist
// ---------------------------------------------------------------------------

export const WAITLIST_STATUSES = ["waiting", "offered", "booked", "removed"];

export async function listWaitlist({ tripSlug, departureId } = {}) {
  return ((await listRecords(WAITLIST)) ?? [])
    .filter((w) => (!tripSlug || w.tripSlug === tripSlug) && (!departureId || w.departureId === departureId))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

/** Someone wants a seat on a full batch. First come, first offered. */
export async function joinWaitlist({ tripSlug, departureId, travellers, name, phone, email, leadId }) {
  return createRecord(WAITLIST, {
    ref: ref(),
    tripSlug,
    departureId,
    travellers: Math.min(Math.max(Number(travellers) || 1, 1), 20),
    name: String(name ?? "").slice(0, 120),
    phone: String(phone ?? "").slice(0, 30),
    email: String(email ?? "").slice(0, 160),
    leadId: leadId ?? null,
    status: "waiting",
    createdAt: new Date().toISOString(),
  });
}

export async function setWaitlistStatus(id, status, { actor } = {}) {
  if (!WAITLIST_STATUSES.includes(status)) return { error: "Unknown waitlist status." };
  const entry = await getRecord(WAITLIST, id);
  if (!entry) return { error: "No such waitlist entry." };
  const updated = await updateRecord(WAITLIST, id, {
    status,
    updatedAt: new Date().toISOString(),
    updatedByName: actor?.name ?? null,
  });
  return { entry: updated };
}

// ---------------------------------------------------------------------------
// The batch itself
// ---------------------------------------------------------------------------

/** Stop or restart sales on a batch by hand (the cut-off does it by date). */
export async function setDepartureClosed(tripSlug, departureId, closed) {
  const result = await withTripLock(tripSlug, async ({ departures }) => {
    if (!departures.some((d) => d.id === departureId)) return { error: "That departure no longer exists." };
    return { departures: departures.map((d) => (d.id === departureId ? { ...d, closed: Boolean(closed) } : d)) };
  });
  return result.ok ? { ok: true } : { error: result.message };
}

/**
 * Call a batch off. Refused while anyone is booked or held on it — the desk
 * must move or refund those people first, so nobody is left holding a paid
 * seat on a trip that is not running.
 */
export async function cancelDeparture(tripSlug, departureId) {
  const result = await withTripLock(tripSlug, async ({ departures, states }) => {
    const state = states.find((s) => s.id === departureId);
    if (!state) return { error: "That departure no longer exists." };
    if (state.booked > 0 || state.held > 0) {
      return {
        error: `${state.booked + state.held} traveller${state.booked + state.held === 1 ? " is" : "s are"} booked or held on this batch. Move or cancel them first.`,
      };
    }
    return { departures: departures.map((d) => (d.id === departureId ? { ...d, cancelled: true } : d)) };
  });
  return result.ok ? { ok: true } : { error: result.message };
}
