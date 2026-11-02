import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, type TestDb } from "./test-db";
import * as schema from "./schema";
import { toPaise } from "./money";

/**
 * Does the CRM's data actually survive a round trip through Postgres?
 *
 * The repository is the boundary where rupees become paise and ISO strings
 * become timestamps. Both translations are silent when they go wrong — a
 * dropped field looks like a field nobody set, and a Date where a string was
 * expected sorts alphabetically by weekday. So each one is asserted rather
 * than assumed.
 *
 * These exercise the same SQL the repository issues. They cannot import it
 * directly — it is `server-only`, which refuses to load outside a Next
 * request — so the translation logic is duplicated here in the small. What is
 * under test is the schema and the round trip, and those are identical.
 */

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let db: TestDb;

beforeAll(async () => {
  ctx = await createTestDb();
  db = ctx.db;
}, 60000);

beforeEach(async () => {
  await ctx.reset();
});

afterAll(async () => {
  await ctx.close();
});

describe("money survives the boundary", () => {
  it("stores rupees as exact paise and reads them back", async () => {
    const [lead] = await db.insert(schema.leads).values({ name: "Kavita" }).returning();

    // A figure a float would mangle.
    const [quote] = await db
      .insert(schema.quotations)
      .values({
        leadId: lead.id,
        version: 1,
        title: "Kerala",
        token: "t".repeat(24),
        subtotalPaise: toPaise(53000),
        costPaise: toPaise(37500),
        discountPaise: toPaise(3000),
        taxPaise: toPaise(2500),
        totalPaise: toPaise(52500),
        perPersonPaise: toPaise(13125),
        grossMarginPaise: toPaise(12500),
        marginPercent: 25,
      })
      .returning();

    expect(quote.totalPaise).toBe(5250000n);
    expect(Number(quote.totalPaise) / 100).toBe(52500);
    // 0.1 + 0.2 territory: the parts must still sum to the whole.
    expect(quote.subtotalPaise - quote.discountPaise + quote.taxPaise).toBe(quote.totalPaise);
  });

  it("keeps an unknown margin null rather than zero", async () => {
    const [lead] = await db.insert(schema.leads).values({ name: "X" }).returning();
    const [quote] = await db
      .insert(schema.quotations)
      .values({ leadId: lead.id, version: 1, title: "No cost data", token: "u".repeat(24) })
      .returning();

    // A margin nobody entered must not read as 0% or 100% — both would tell a
    // salesperson something false about how far they can discount.
    expect(quote.grossMarginPaise).toBeNull();
    expect(quote.marginPercent).toBeNull();
  });
});

describe("the constraints the application no longer has to remember", () => {
  it("rejects a lost lead with no reason", async () => {
    await expect(
      db.insert(schema.leads).values({ name: "Anon", status: "lost" })
    ).rejects.toThrow();

    const [ok] = await db
      .insert(schema.leads)
      .values({ name: "Anon", status: "lost", lostReason: "Price too high" })
      .returning();
    expect(ok.lostReason).toBe("Price too high");
  });

  it("rejects a positive refund", async () => {
    const [lead] = await db.insert(schema.leads).values({ name: "L" }).returning();
    const [booking] = await db
      .insert(schema.bookings)
      .values({ reference: "YG-1", source: "quotation", leadId: lead.id, tripTitle: "T" })
      .returning();

    await expect(
      db.insert(schema.payments).values({
        bookingId: booking.id,
        kind: "refund",
        amountPaise: toPaise(5000),
        method: "UPI",
      })
    ).rejects.toThrow();
  });

  it("allows part-paid, which the old five-status list rejected", async () => {
    const [lead] = await db.insert(schema.leads).values({ name: "L" }).returning();
    const [booking] = await db
      .insert(schema.bookings)
      .values({
        reference: "YG-2",
        source: "quotation",
        leadId: lead.id,
        tripTitle: "T",
        status: "part-paid",
      })
      .returning();
    expect(booking.status).toBe("part-paid");
  });

  it("refuses a second invoice for the same booking", async () => {
    const [lead] = await db.insert(schema.leads).values({ name: "L" }).returning();
    const [booking] = await db
      .insert(schema.bookings)
      .values({ reference: "YG-3", source: "quotation", leadId: lead.id, tripTitle: "T" })
      .returning();

    const invoice = {
      bookingId: booking.id,
      financialYear: "26-27",
      title: "T",
      seller: {},
      customer: {},
    };

    await db.insert(schema.invoices).values({ ...invoice, number: "YG/26-27/0001", sequence: 1 });

    // Idempotency in issueInvoice() is the first line of defence. This is the
    // one that cannot be forgotten.
    await expect(
      db.insert(schema.invoices).values({ ...invoice, number: "YG/26-27/0002", sequence: 2 })
    ).rejects.toThrow();
  });

  it("refuses a duplicate invoice number", async () => {
    const [lead] = await db.insert(schema.leads).values({ name: "L" }).returning();
    const rows = await db
      .insert(schema.bookings)
      .values([
        { reference: "YG-4", source: "quotation", leadId: lead.id, tripTitle: "A" },
        { reference: "YG-5", source: "quotation", leadId: lead.id, tripTitle: "B" },
      ])
      .returning();

    const base = { financialYear: "26-27", sequence: 1, title: "T", seller: {}, customer: {} };
    await db.insert(schema.invoices).values({ ...base, bookingId: rows[0].id, number: "YG/26-27/0001" });

    // A gap or a duplicate in an invoice sequence is a compliance question.
    await expect(
      db.insert(schema.invoices).values({ ...base, bookingId: rows[1].id, number: "YG/26-27/0001" })
    ).rejects.toThrow();
  });
});

describe("the whole chain lands", () => {
  it("lead → quotation → booking → payment → invoice, all linked", async () => {
    const [user] = await db
      .insert(schema.users)
      .values({ email: "priya@yaadigo.com", name: "Priya", role: "sales", status: "active" })
      .returning();

    const [lead] = await db
      .insert(schema.leads)
      .values({
        name: "Kavita Menon",
        phone: "+91 98220 44556",
        destination: "Kerala",
        ownerId: user.id,
        followUpAt: new Date(),
        notes: [{ body: "Called", at: new Date().toISOString() }],
      })
      .returning();

    const [quote] = await db
      .insert(schema.quotations)
      .values({
        leadId: lead.id,
        version: 1,
        title: "Kerala backwaters",
        token: "v".repeat(24),
        travellers: 4,
        totalPaise: toPaise(52500),
        lines: [{ label: "Hotels", perPerson: true, amount: 34000 }],
        ownerId: user.id,
        status: "approved",
      })
      .returning();

    const [booking] = await db
      .insert(schema.bookings)
      .values({
        reference: "YG26-ABCDE",
        source: "quotation",
        leadId: lead.id,
        quotationId: quote.id,
        tripTitle: quote.title,
        travellers: 4,
        totalPaise: quote.totalPaise,
        salesOwnerId: user.id,
        status: "confirmed",
      })
      .returning();

    await db.insert(schema.payments).values({
      bookingId: booking.id,
      leadId: lead.id,
      kind: "advance",
      amountPaise: toPaise(12075),
      method: "UPI",
    });

    await db.insert(schema.invoices).values({
      bookingId: booking.id,
      number: "YG/26-27/0001",
      financialYear: "26-27",
      sequence: 1,
      title: booking.tripTitle,
      seller: { name: "YaadiGo" },
      customer: { name: lead.name },
      totalPaise: booking.totalPaise,
    });

    await db.insert(schema.events).values({
      type: "booking.created",
      leadId: lead.id,
      quotationId: quote.id,
      bookingId: booking.id,
      ownerId: user.id,
      amountPaise: booking.totalPaise,
      payload: { summary: "Kerala backwaters" },
    });

    // The chain is what makes cross-module reporting one filter rather than
    // four joins. Every hop must actually resolve.
    const [row] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, booking.id));
    expect(row.leadId).toBe(lead.id);
    expect(row.quotationId).toBe(quote.id);

    const payments = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.leadId, lead.id));
    expect(payments).toHaveLength(1);

    const events = await db.select().from(schema.events).where(eq(schema.events.leadId, lead.id));
    expect(events[0].amountPaise).toBe(toPaise(52500));

    // jsonb survives intact — notes and lines are snapshots, not strings.
    const [savedLead] = await db.select().from(schema.leads).where(eq(schema.leads.id, lead.id));
    expect(Array.isArray(savedLead.notes)).toBe(true);
    expect(savedLead.followUpAt).toBeInstanceOf(Date);
  });

  it("cascades a deleted lead to its quotations but not its bookings", async () => {
    const [lead] = await db.insert(schema.leads).values({ name: "Temp" }).returning();
    await db
      .insert(schema.quotations)
      .values({ leadId: lead.id, version: 1, title: "Q", token: "w".repeat(24) });

    const [departure] = await db
      .insert(schema.departures)
      .values({
        tripSlug: "kashmir",
        startDate: "2027-10-12",
        endDate: "2027-10-18",
        pricePaise: toPaise(27000),
        seatsTotal: 10,
        seatsLeft: 10,
      })
      .returning();

    await db.insert(schema.bookings).values({
      reference: "YG-6",
      source: "fixed-departure",
      leadId: lead.id,
      departureId: departure.id,
      tripTitle: "Kashmir",
    });

    await db.delete(schema.leads).where(eq(schema.leads.id, lead.id));

    // Quotations belong to the lead and go with it.
    expect(await db.select().from(schema.quotations)).toHaveLength(0);
    // A booking is a commitment to a customer. It survives, with a null lead,
    // because deleting a lead must never erase money that was taken.
    const bookings = await db.select().from(schema.bookings);
    expect(bookings).toHaveLength(1);
    expect(bookings[0].leadId).toBeNull();
  });
});
