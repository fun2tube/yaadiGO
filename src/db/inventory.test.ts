import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createTestDb, type TestDb } from "./test-db";
import { bookings, departures, events, leads, payments, users } from "./schema";
import { toPaise } from "./money";

/**
 * The tests that decide whether the architecture claim is true.
 *
 * Every one of these runs against real Postgres. The oversell test in
 * particular is the reason the store moved off JSON files at all — under the
 * old read-modify-write it passed by luck and failed under load.
 */

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

async function seed() {
  const [seller] = await db
    .insert(users)
    .values({ email: "priya@yaadigo.com", name: "Priya", role: "sales", status: "active" })
    .returning();

  const [departure] = await db
    .insert(departures)
    .values({
      tripSlug: "kashmir-valley-escape",
      startDate: "2027-10-12",
      endDate: "2027-10-18",
      pricePaise: toPaise(27000),
      seatsTotal: 12,
      seatsLeft: 4,
    })
    .returning();

  return { seller, departure };
}

async function makeBooking(departureId: string, travellers: number, sellerId: string) {
  const [booking] = await db
    .insert(bookings)
    .values({
      reference: `YG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      source: "fixed-departure",
      departureId,
      name: "Test Customer",
      tripTitle: "Kashmir Valley Escape",
      travellers,
      totalPaise: toPaise(27000 * travellers),
      salesOwnerId: sellerId,
    })
    .returning();
  return booking;
}

/**
 * The confirm, written exactly as lib/db/inventory.ts writes it.
 *
 * Duplicated here rather than imported because that module is `server-only`,
 * which refuses to load outside a Next request. The SQL is what is under test,
 * and it is identical.
 */
async function confirm(bookingId: string) {
  return db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (!booking) throw new Error("No such booking.");
    if (booking.status !== "requested") return { seatsMoved: 0 };

    const need = booking.travellers;
    const moved = await tx
      .update(departures)
      .set({ seatsLeft: sql`${departures.seatsLeft} - ${need}` })
      .where(sql`${departures.id} = ${booking.departureId} and ${departures.seatsLeft} >= ${need}`)
      .returning({ seatsLeft: departures.seatsLeft });

    if (moved.length === 0) throw new Error("INSUFFICIENT_SEATS");

    await tx
      .update(bookings)
      .set({ status: "confirmed", seatsHeld: need })
      .where(eq(bookings.id, bookingId));

    await tx.insert(events).values({
      type: "booking.confirmed",
      bookingId: booking.id,
      ownerId: booking.salesOwnerId,
      amountPaise: booking.totalPaise,
      payload: { seatsHeld: need },
    });

    return { seatsMoved: need };
  });
}

beforeAll(async () => {
  ctx = await createTestDb();
  db = ctx.db;
  // Generous: this boots Postgres and replays every migration. It happens once.
}, 60000);

beforeEach(async () => {
  await ctx.reset();
});

afterAll(async () => {
  await ctx.close();
});

describe("seat inventory", () => {
  it("deducts seats and writes the event in one transaction", async () => {
    const { seller, departure } = await seed();
    const booking = await makeBooking(departure.id, 2, seller.id);

    await confirm(booking.id);

    const [after] = await db.select().from(departures).where(eq(departures.id, departure.id));
    expect(after.seatsLeft).toBe(2);

    const log = await db.select().from(events).where(eq(events.bookingId, booking.id));
    expect(log).toHaveLength(1);
    expect(log[0].type).toBe("booking.confirmed");
  });

  it("refuses to oversell a batch", async () => {
    const { seller, departure } = await seed(); // 4 seats
    const booking = await makeBooking(departure.id, 6, seller.id);

    await expect(confirm(booking.id)).rejects.toThrow("INSUFFICIENT_SEATS");

    const [after] = await db.select().from(departures).where(eq(departures.id, departure.id));
    expect(after.seatsLeft).toBe(4); // untouched
  });

  it("does not leave a confirmed booking behind when the seats fail", async () => {
    // The whole reason for the transaction: the old code confirmed the booking
    // and moved the seats as two separate writes, so a failure between them
    // left a booking holding seats that were never taken.
    const { seller, departure } = await seed();
    const booking = await makeBooking(departure.id, 6, seller.id);

    await expect(confirm(booking.id)).rejects.toThrow();

    const [after] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(after.status).toBe("requested");
    expect(after.seatsHeld).toBe(0);

    const log = await db.select().from(events).where(eq(events.bookingId, booking.id));
    expect(log).toHaveLength(0); // the event rolled back too
  });

  it("refuses the third booking when only four seats exist", async () => {
    // Four seats, three bookings of two. Under the old read-modify-write all
    // three read "4" in JavaScript and all three succeeded, leaving the batch
    // at -2.
    //
    // HONESTY NOTE: PGlite is a single connection, so these transactions are
    // serialised rather than genuinely parallel. This proves the guard logic
    // and the rollback are correct — it does NOT prove behaviour under real
    // parallel connections. The guarantee there comes from the guarded UPDATE
    // and the CHECK constraint, both exercised below; the remaining risk is
    // worth one load test against the real database before launch.
    const { seller, departure } = await seed(); // 4 seats
    const a = await makeBooking(departure.id, 2, seller.id);
    const b = await makeBooking(departure.id, 2, seller.id);
    const c = await makeBooking(departure.id, 2, seller.id);

    const results = await Promise.allSettled([confirm(a.id), confirm(b.id), confirm(c.id)]);
    const ok = results.filter((r) => r.status === "fulfilled").length;

    expect(ok).toBe(2); // exactly two of three fit

    const [after] = await db.select().from(departures).where(eq(departures.id, departure.id));
    expect(after.seatsLeft).toBe(0);
    expect(after.seatsLeft).toBeGreaterThanOrEqual(0); // never negative

    const confirmed = await db.select().from(bookings).where(eq(bookings.status, "confirmed"));
    expect(confirmed).toHaveLength(2);

    // Seats held across all bookings must equal seats taken off the batch.
    const held = confirmed.reduce((sum, row) => sum + row.seatsHeld, 0);
    expect(held).toBe(4);
  });

  it("is backstopped by a CHECK constraint even if the WHERE is forgotten", async () => {
    const { departure } = await seed();
    // Exactly the bug the constraint exists to catch: an UPDATE with no guard.
    await expect(
      db
        .update(departures)
        .set({ seatsLeft: sql`${departures.seatsLeft} - 99` })
        .where(eq(departures.id, departure.id))
    ).rejects.toThrow();

    const [after] = await db.select().from(departures).where(eq(departures.id, departure.id));
    expect(after.seatsLeft).toBe(4);
  });
});

describe("constraints the application no longer has to remember", () => {
  it("rejects a lost lead with no reason", async () => {
    await expect(
      db.insert(leads).values({ name: "Anon", status: "lost" })
    ).rejects.toThrow();

    const [ok] = await db
      .insert(leads)
      .values({ name: "Anon", status: "lost", lostReason: "Price too high" })
      .returning();
    expect(ok.lostReason).toBe("Price too high");
  });

  it("rejects a positive refund and a negative payment", async () => {
    const { seller, departure } = await seed();
    const booking = await makeBooking(departure.id, 2, seller.id);

    await expect(
      db.insert(payments).values({
        bookingId: booking.id,
        kind: "refund",
        amountPaise: toPaise(5000), // positive refund
        method: "UPI",
      })
    ).rejects.toThrow();

    const [refund] = await db
      .insert(payments)
      .values({
        bookingId: booking.id,
        kind: "refund",
        amountPaise: -toPaise(5000),
        method: "UPI",
      })
      .returning();
    expect(refund.amountPaise).toBe(-toPaise(5000));
  });

  it("rejects two accounts for the same email in different cases", async () => {
    await db.insert(users).values({ email: "priya@yaadigo.com", name: "Priya" });
    await expect(
      db.insert(users).values({ email: "Priya@YaadiGo.com", name: "Impostor" })
    ).rejects.toThrow();
  });

  it("rejects a departure that ends before it starts", async () => {
    await expect(
      db.insert(departures).values({
        tripSlug: "x",
        startDate: "2027-10-18",
        endDate: "2027-10-12",
        pricePaise: toPaise(1000),
        seatsTotal: 5,
        seatsLeft: 5,
      })
    ).rejects.toThrow();
  });

  it("rejects a booking with no lead and no departure", async () => {
    await expect(
      db.insert(bookings).values({
        reference: "YG-ORPHAN",
        source: "fixed-departure",
        name: "Nobody",
        tripTitle: "Nowhere",
      })
    ).rejects.toThrow();
  });
});

describe("money survives the round trip through Postgres", () => {
  it("stores paise as bigint without precision loss", async () => {
    const { seller, departure } = await seed();
    // A number that a float would mangle.
    const awkward = toPaise(247513.37);
    const [booking] = await db
      .insert(bookings)
      .values({
        reference: "YG-MONEY",
        source: "quotation",
        leadId: (await db.insert(leads).values({ name: "L" }).returning())[0].id,
        name: "Test",
        tripTitle: "Test",
        totalPaise: awkward,
        salesOwnerId: seller.id,
      })
      .returning();

    const [read] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(read.totalPaise).toBe(awkward);
    expect(read.totalPaise).toBe(24751337n);
    expect(departure.pricePaise).toBe(2700000n);
  });
});
