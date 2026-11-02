import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Seats end to end over the real catalogue, booking and seats code
 * (phase 2: seats derived from bookings and holds, every change under the
 * trip's lock).
 *
 * Storage is an in-memory stand-in with the record store's rules. Its
 * `mutateBy` serialises per collection like the real file store, so two
 * confirmations racing for the last seat really do queue.
 */

const db = {};
let seq = 0;
const chains = new Map();

vi.mock("@/lib/cms/records", () => {
  const all = (c) => (db[c] ??= []);
  const find = (c, k, v) => all(c).find((r) => r[k] === v) ?? null;
  const serial = (c, task) => {
    const run = (chains.get(c) ?? Promise.resolve()).then(task, task);
    chains.set(c, run.catch(() => {}));
    return run;
  };
  return {
    listRecords: vi.fn(async (c) => [...all(c)]),
    getRecord: vi.fn(async (c, id) => find(c, "id", id)),
    createRecord: vi.fn(async (c, data) => {
      const row = { id: `${c}_${++seq}`, ...data };
      all(c).push(row);
      return row;
    }),
    updateRecord: vi.fn(async (c, id, patch) => Object.assign(find(c, "id", id) ?? {}, patch)),
    upsertBy: vi.fn(async (c, k, v, patch) => {
      const row = find(c, k, v);
      if (row) return Object.assign(row, patch);
      const created = { id: `${c}_${++seq}`, [k]: v, ...patch };
      all(c).push(created);
      return created;
    }),
    mutateBy: vi.fn((c, k, v, mutate) =>
      serial(c, async () => {
        const row = find(c, k, v);
        const result = await mutate(row ? { ...row } : null);
        if (!result) return null;
        if (row) return Object.assign(row, result);
        const created = { id: `${c}_${++seq}`, [k]: v, ...result };
        all(c).push(created);
        return created;
      })
    ),
  };
});

vi.mock("@/lib/cms/store", () => ({
  getOverrides: vi.fn(async () => ({ text: {}, image: {}, hidden: {}, style: {} })),
}));

const emitted = [];
vi.mock("@/lib/crm/events", () => ({
  emit: vi.fn(async (type, payload) => emitted.push({ type, payload })),
}));

const SLUG = "kashmir-valley-escape";

async function load() {
  vi.resetModules();
  return {
    ...(await import("./catalogue")),
    ...(await import("./bookings")),
    ...(await import("./seats")),
  };
}

/** A batch comfortably clear of its cut-off, whatever day the tests run. */
async function aBatch(m) {
  const trip = await m.getTrip(SLUG, { includeUnpublished: true });
  return trip.departures.find((d) => d.bookable);
}

async function seats(departureId) {
  const m = await load();
  const trip = await m.getTrip(SLUG, { includeUnpublished: true });
  return trip.departures.find((d) => d.id === departureId);
}

async function request(m, departureId, travellers) {
  return m.createBookingRequest({ tripSlug: SLUG, departureId, travellers, leadId: "lead_1" });
}

beforeEach(() => {
  for (const key of Object.keys(db)) delete db[key];
  chains.clear();
  emitted.length = 0;
});

describe("seats are derived from bookings", () => {
  it("a request takes no seats; confirming takes exactly its travellers", async () => {
    const m = await load();
    const batch = await aBatch(m);
    const booking = await request(m, batch.id, 2);
    expect((await seats(batch.id)).seatsLeft).toBe(batch.seatsLeft);

    expect((await m.setBookingStatus(booking.id, "confirmed")).ok).toBe(true);
    expect((await seats(batch.id)).seatsLeft).toBe(batch.seatsLeft - 2);
    expect(db.bookings[0].seatsHeld).toBe(2);
  });

  it("a cancellation gives the seats back", async () => {
    const m = await load();
    const batch = await aBatch(m);
    const booking = await request(m, batch.id, 2);
    await m.setBookingStatus(booking.id, "confirmed");
    await m.setBookingStatus(booking.id, "cancelled");
    expect((await seats(batch.id)).seatsLeft).toBe(batch.seatsLeft);
  });

  it("two confirmations racing for the last seats: exactly one wins", async () => {
    const m = await load();
    const batch = await aBatch(m);
    const left = batch.seatsLeft;
    const a = await request(m, batch.id, left);
    const b = await request(m, batch.id, left);

    const results = await Promise.all([m.setBookingStatus(a.id, "confirmed"), m.setBookingStatus(b.id, "confirmed")]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok).message).toMatch(/Only 0 seats left|seats left/);
    expect((await seats(batch.id)).seatsLeft).toBe(0);
  });

  it("writes a departures row for the batch before the booking points at it", async () => {
    const m = await load();
    const batch = await aBatch(m);
    await request(m, batch.id, 1);
    expect(db.departures.find((d) => d.id === batch.id)).toMatchObject({ tripSlug: SLUG, seatsTotal: batch.capacity });
  });
});

describe("holds", () => {
  it("take seats off sale, and give them back when released", async () => {
    const m = await load();
    const batch = await aBatch(m);
    const { hold } = await m.createHold({ tripSlug: SLUG, departureId: batch.id, seats: 2, name: "Ravi" });
    expect((await seats(batch.id))).toMatchObject({ held: 2, seatsLeft: batch.seatsLeft - 2 });

    expect((await m.releaseHold(hold.id)).ok).toBe(true);
    expect((await seats(batch.id)).seatsLeft).toBe(batch.seatsLeft);
  });

  it("cannot hold more than is left", async () => {
    const m = await load();
    const batch = await aBatch(m);
    const result = await m.createHold({ tripSlug: SLUG, departureId: batch.id, seats: batch.seatsLeft + 1, name: "Ravi" });
    expect(result.error).toMatch(/seats? left/);
  });

  it("converts to a confirmed booking with no gap where the seats were free", async () => {
    const m = await load();
    const batch = await aBatch(m);
    const { hold } = await m.createHold({ tripSlug: SLUG, departureId: batch.id, seats: batch.seatsLeft, name: "Ravi" });
    // The batch is now full — the hold's own seats must not block its conversion.
    const result = await m.convertHold(hold.id, {
      makeBooking: async (h) => {
        const b = await m.createBookingRequest({ tripSlug: SLUG, departureId: h.departureId, travellers: h.seats, leadId: "lead_1", fromHold: true });
        return Object.assign(b, { status: "confirmed", seatsHeld: h.seats });
      },
    });
    expect(result.booking.status).toBe("confirmed");
    const after = await seats(batch.id);
    expect(after).toMatchObject({ held: 0, booked: batch.seatsLeft, seatsLeft: 0 });
  });
});

describe("the waitlist", () => {
  it("tells the desk when a seat frees up on a batch people are waiting for", async () => {
    const m = await load();
    const batch = await aBatch(m);
    const booking = await request(m, batch.id, 2);
    await m.setBookingStatus(booking.id, "confirmed");
    await m.joinWaitlist({ tripSlug: SLUG, departureId: batch.id, travellers: 2, name: "Meera", phone: "98" });

    await m.setBookingStatus(booking.id, "cancelled");
    expect(emitted.map((e) => e.type)).toContain("departure.seat_freed");
    expect(emitted[0].payload.href).toBe(`/admin/departures/${SLUG}/${batch.id}`);
  });

  it("says nothing when nobody is waiting", async () => {
    const m = await load();
    const batch = await aBatch(m);
    const booking = await request(m, batch.id, 2);
    await m.setBookingStatus(booking.id, "confirmed");
    await m.setBookingStatus(booking.id, "cancelled");
    expect(emitted).toHaveLength(0);
  });
});

describe("closing and cancelling a batch", () => {
  it("a closed batch takes no new bookings, and reopens", async () => {
    const m = await load();
    const batch = await aBatch(m);
    await m.setDepartureClosed(SLUG, batch.id, true);
    expect((await seats(batch.id)).status).toBe("closed");
    expect(await request(await load(), batch.id, 1)).toBeNull();

    await m.setDepartureClosed(SLUG, batch.id, false);
    expect((await seats(batch.id)).bookable).toBe(true);
  });

  it("cannot cancel a batch while anyone is booked on it", async () => {
    const m = await load();
    const batch = await aBatch(m);
    const booking = await request(m, batch.id, 2);
    await m.setBookingStatus(booking.id, "confirmed");
    expect((await m.cancelDeparture(SLUG, batch.id)).error).toMatch(/2 travellers are booked or held/);
  });

  it("the editor cannot shrink a batch below what is booked", async () => {
    const m = await load();
    const batch = await aBatch(m);
    const booking = await request(m, batch.id, 3);
    await m.setBookingStatus(booking.id, "confirmed");
    const trip = await m.getTrip(SLUG, { includeUnpublished: true });
    const edits = trip.departures.map((d) => ({ ...d, capacity: d.id === batch.id ? 2 : d.capacity }));
    expect((await m.saveTripDepartures(SLUG, edits)).message).toMatch(/3 seats are already booked or held/);
  });
});
