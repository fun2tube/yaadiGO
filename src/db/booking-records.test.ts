import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createTestDb } from "./test-db";

/**
 * Website seat requests, through the real repository into real Postgres.
 *
 * Found 2026-10-10 while building phase 2, each confirmed against this
 * database before it was fixed:
 *
 *   1. the trip page's booking record had no `reference` or `source`, both
 *      NOT NULL — refused;
 *   2. with those, `departure_id` pointed at a batch with no row in
 *      `departures` — refused by the foreign key;
 *   3. confirming wrote `seats_held = true` into an integer column — refused.
 *
 * So seat requests reached the inbox as leads but never became bookings, and
 * could not have been confirmed if they had. Every earlier test replaced
 * storage with a stand-in. These run the app's own record shape.
 */

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let repo: typeof import("./repository");
let build: typeof import("../lib/cms/booking-record");

beforeAll(async () => {
  ctx = await createTestDb();
  process.env.DATABASE_URL = "pglite://test";
  (globalThis as { __yaadigoDb?: unknown }).__yaadigoDb = ctx.db;
  repo = await import("./repository");
  build = await import("../lib/cms/booking-record");
}, 60000);

beforeEach(async () => {
  await ctx.reset();
});

afterAll(async () => {
  await ctx.close();
});

const departure = { id: "kve-1012", start: "2026-10-12", end: "2026-10-18", seatsLeft: 4 };
const request = () =>
  build.buildBookingRequest({
    tour: { slug: "kashmir-valley-escape", title: "Kashmir Valley Escape" },
    departure,
    quote: {
      sharing: { label: "Triple sharing" },
      pickup: { city: "Srinagar" },
      perPerson: 28500,
      total: 57000,
      advance: 10000,
      balance: 47000,
    },
    travellers: 2,
    leadId: null,
    contact: { name: "Asha", phone: "9800000000" },
  });

/** What seats.js syncDepartureRows writes for a batch. */
const anchorRow = () =>
  repo.upsertBy("departures", "id", departure.id, {
    tripSlug: "kashmir-valley-escape",
    startDate: departure.start,
    endDate: departure.end,
    price: 28500,
    seatsTotal: 12,
    seatsLeft: 12,
    published: true,
  });

describe("a booking request from the trip page", () => {
  it("is refused while its batch has no departures row — the reason it is synced first", async () => {
    await expect(repo.createRecord("bookings", request())).rejects.toThrow();
  });

  it("inserts once the batch's row exists, then confirms with seats as a number", async () => {
    await anchorRow();
    const created = await repo.createRecord("bookings", request());
    expect((created as Record<string, unknown> | undefined)?.reference).toMatch(/^YG\d\d-[A-Z0-9]{5}$/);
    expect(created).toMatchObject({ status: "requested", source: "website", total: 57000, departureId: "kve-1012" });

    const updated = await repo.updateRecord("bookings", created!.id as string, {
      status: "confirmed",
      seatsHeld: 2,
    });
    expect(updated).toMatchObject({ status: "confirmed", seatsHeld: 2 });
  });

  it("keeps the departures row in step when it is synced again", async () => {
    await anchorRow();
    await repo.upsertBy("departures", "id", departure.id, { seatsLeft: 9, price: 29900 });
    const rows = (await repo.listRecords("departures")) ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ seatsTotal: 12, seatsLeft: 9, price: 29900 });
  });
});
