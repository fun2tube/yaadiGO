/**
 * Seats on a departure — computed, never typed (docs/design/trip-management.md
 * §4.2, phase 2).
 *
 *   seats left = capacity − travellers on seat-holding bookings − active holds
 *
 * Nothing stores "seats left". The two S1 bugs found on 2026-10-10 (#130, the
 * editor writing back a stale count; #136, seat moves failing on Postgres)
 * were both a stored counter drifting from the bookings it was meant to
 * reflect. A number that is derived from the bookings cannot drift from them.
 *
 * Pure and browser-safe, so the rules are unit-tested and the admin screens
 * show exactly what the server enforces.
 */

/** Bookings close this many days before departure unless a batch says otherwise. */
export const CUTOFF_DAYS_DEFAULT = 7;

/** How long a salesperson's hold keeps seats off sale. */
export const HOLD_HOURS = 48;

/** "Filling fast" at or below this many seats. */
export const FILLING_AT = 3;

const DAY = 86_400_000;

const toTime = (iso) => new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).getTime();

/** Is this hold still keeping seats off sale? Expiry needs no job — time does it. */
export function holdIsActive(hold, now = Date.now()) {
  return hold?.status === "active" && new Date(hold.expiresAt).getTime() > now;
}

/**
 * Travellers committed to each departure, by id.
 *
 * @param bookings          booking records (any trip)
 * @param holds             hold records (any trip)
 * @param holdsSeats        (status) => boolean — from the booking pipeline
 */
export function commitments({ bookings = [], holds = [], holdsSeats, now = Date.now() }) {
  const booked = new Map();
  const held = new Map();
  for (const b of bookings) {
    if (!b.departureId || !holdsSeats(b.status)) continue;
    const key = `${b.tripSlug}:${b.departureId}`;
    booked.set(key, (booked.get(key) ?? 0) + (Number(b.travellers) || 0));
  }
  for (const h of holds) {
    if (!holdIsActive(h, now)) continue;
    const key = `${h.tripSlug}:${h.departureId}`;
    held.set(key, (held.get(key) ?? 0) + (Number(h.seats) || 0));
  }
  return { booked, held };
}

/**
 * The seat count of a batch that predates `capacity`.
 *
 * Before phase 2 a batch stored only "seats left", decremented by each
 * confirmed booking. Its true size is therefore what is left PLUS what was
 * booked. Every write path persists this the first time it touches a batch
 * (see normaliseCapacity), so the inference happens once and is then fixed.
 */
export function capacityOf(departure, bookedNow = 0) {
  if (Number.isFinite(departure.capacity)) return departure.capacity;
  return Math.max(0, (Number(departure.seatsLeft) || 0) + bookedNow);
}

/** Give every batch an explicit capacity, inferred from the old counter if need be. */
export function normaliseCapacity(departures, tripSlug, booked) {
  return departures.map((d) => {
    if (Number.isFinite(d.capacity)) return d;
    const { seatsLeft: _old, ...rest } = d;
    void _old;
    return { ...rest, capacity: capacityOf(d, booked.get(`${tripSlug}:${d.id}`) ?? 0) };
  });
}

/**
 * Everything the site and the desk need to know about one batch.
 *
 * Status, in order of precedence:
 *   cancelled  the desk called it off
 *   completed  it has already ended
 *   closed     past the booking cut-off, or closed by hand
 *   soldout    no seats left
 *   filling    a few seats left
 *   available
 */
export function departureState(departure, { tripSlug, booked, held, now = Date.now() }) {
  const key = `${tripSlug}:${departure.id}`;
  const bookedHere = booked.get(key) ?? 0;
  const heldHere = held.get(key) ?? 0;
  const capacity = capacityOf(departure, bookedHere);
  const seatsLeft = Math.max(0, capacity - bookedHere - heldHere);

  const cutoffDays = Number.isFinite(departure.cutoffDays) ? departure.cutoffDays : CUTOFF_DAYS_DEFAULT;
  const startsAt = toTime(departure.start);
  const cutoffAt = startsAt - cutoffDays * DAY;
  const endsAt = toTime(departure.end) + DAY;

  let status;
  if (departure.cancelled) status = "cancelled";
  else if (now >= endsAt) status = "completed";
  else if (departure.closed || now >= cutoffAt) status = "closed";
  else if (seatsLeft <= 0) status = "soldout";
  else if (seatsLeft <= FILLING_AT) status = "filling";
  else status = "available";

  const minToRun = Number(departure.minToRun) || 0;

  return {
    ...departure,
    capacity,
    booked: bookedHere,
    held: heldHere,
    seatsLeft,
    status,
    bookable: status === "available" || status === "filling",
    cutoffDays,
    cutoffDate: new Date(cutoffAt).toISOString().slice(0, 10),
    minToRun,
    // Enough people are booked that the batch will run, whatever happens.
    guaranteed: minToRun > 0 && bookedHere >= minToRun,
    // Still short of the minimum, and the start is close.
    atRisk: minToRun > 0 && bookedHere < minToRun && startsAt - now < 21 * DAY && now < startsAt,
  };
}

/**
 * Can `seats` more be taken on this batch right now? Returns null if yes, or
 * the sentence to read to the customer if not.
 */
export function refusal(state, seats) {
  if (state.status === "cancelled") return "That departure has been cancelled.";
  if (state.status === "completed") return "That departure has already run.";
  if (state.status === "closed") return `Bookings for the ${state.start} batch have closed.`;
  if (seats > state.seatsLeft) {
    return `Only ${state.seatsLeft} seat${state.seatsLeft === 1 ? "" : "s"} left on the ${state.start} batch.`;
  }
  return null;
}
