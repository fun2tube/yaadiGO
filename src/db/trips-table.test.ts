import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createTestDb } from "./test-db";

/**
 * Trips on a real table (migration 0009), through the app's own code: the
 * move out of `documents`, the whole draft → publish → archive lifecycle
 * (which also proves the repository can write a whole record back), the
 * columns Postgres derives from the live content, and moving the coded trips
 * in, twice, without changing what the site shows.
 */

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let trips: typeof import("../lib/cms/trips");
let catalogue: typeof import("../lib/cms/catalogue");
let tripImport: typeof import("../lib/cms/trip-import");

beforeAll(async () => {
  ctx = await createTestDb();
  process.env.DATABASE_URL = "pglite://test";
  (globalThis as { __yaadigoDb?: unknown }).__yaadigoDb = ctx.db;
  trips = await import("../lib/cms/trips");
  catalogue = await import("../lib/cms/catalogue");
  tripImport = await import("../lib/cms/trip-import");
}, 60000);

beforeEach(async () => {
  await ctx.reset();
});

afterAll(async () => {
  await ctx.close();
});

const row = async (slug: string) =>
  (await ctx.client.query<Record<string, unknown>>(
    `select slug, kind, status, version, title, destination, nights, from_price_paise::text as from_price_paise from trips where slug = $1`,
    [slug]
  )).rows[0];

const content = (over = {}) => ({
  title: "Spiti in Winter",
  destination: "Kaza · Langza",
  region: "India",
  theme: "Mountains",
  duration: "6N / 7D",
  summary: "Snow, monasteries and very quiet roads.",
  days: [{ day: 1, title: "Arrive Manali", detail: "" }],
  inclusions: ["Stays"],
  pickups: [{ id: "manali", city: "Manali", detail: "", delta: 0 }],
  ...over,
});

describe("the 0009 move out of documents", () => {
  it("moves trips and versions with every field, then clears the documents", async () => {
    await ctx.client.query(
      `insert into documents (id, collection, key, data) values
        ('t1', 'trips', 'spiti-winter', $1::jsonb),
        ('v1', 'tripVersions', 'spiti-winter@1', $2::jsonb),
        ('n1', 'navigation', 'main', '{"key":"main"}'::jsonb)`,
      [
        JSON.stringify({
          slug: "spiti-winter", kind: "group", status: "published", live: content(), draft: null, version: 1,
          source: "manual", publishedAt: "2026-10-20T10:00:00.000Z", publishedByName: "Neha", createdByName: "Neha",
        }),
        JSON.stringify({ key: "spiti-winter@1", tripSlug: "spiti-winter", kind: "group", version: 1, status: "published", content: content() }),
      ]
    );
    const sql = readFileSync(join(process.cwd(), "drizzle/0009_trips_table.sql"), "utf8");
    for (const statement of sql.slice(sql.indexOf("-- MOVE")).split("--> statement-breakpoint")) {
      if (statement.trim()) await ctx.client.exec(statement);
    }

    expect(await row("spiti-winter")).toMatchObject({
      kind: "group", status: "published", version: 1, title: "Spiti in Winter", destination: "Kaza · Langza", nights: 6,
    });
    const versions = (await ctx.client.query(`select key, trip_slug from trip_versions`)).rows;
    expect(versions).toEqual([{ key: "spiti-winter@1", trip_slug: "spiti-winter" }]);
    const left = (await ctx.client.query<{ collection: string }>(`select collection from documents`)).rows;
    expect(left).toEqual([{ collection: "navigation" }]);
  });
});

describe("the trip lifecycle on the table", () => {
  it("drafts, publishes with a version, edits and republishes, and archives", async () => {
    // lib/cms/trips.js is JS: its options are inferred from defaults, too narrowly for TS.
    const t = trips as any;
    const { trip } = await t.createTrip({ kind: "customized", title: "Kerala Backwaters Slow", actor: { id: "u1", name: "Neha" } });
    expect(await row(trip.slug)).toMatchObject({ status: "draft", title: null });

    const draft = content({ title: "Kerala Backwaters Slow", destination: "Alleppey", duration: "4N / 5D", fromPrice: 38500, pickups: [] });
    expect((await t.saveDraft(trip.slug, draft, { actor: { id: "u1", name: "Neha" } })).error).toBeUndefined();
    const published = await t.publishTrip(trip.slug, { actor: { id: "u1", name: "Neha" } });
    expect(published.error).toBeUndefined();
    // Postgres derived the queryable facts from what is now live.
    expect(await row(trip.slug)).toMatchObject({ status: "published", version: 1, title: "Kerala Backwaters Slow", nights: 4, from_price_paise: "3850000" });

    await t.saveDraft(trip.slug, { ...draft, title: "Kerala, Slowly" }, { actor: { id: "u1", name: "Neha" } });
    // A draft never changes what is live.
    expect((await row(trip.slug)).title).toBe("Kerala Backwaters Slow");
    await t.publishTrip(trip.slug, { actor: { id: "u1", name: "Neha" } });
    expect(await row(trip.slug)).toMatchObject({ version: 2, title: "Kerala, Slowly" });
    expect((await ctx.client.query(`select count(*)::int as n from trip_versions where trip_slug = $1`, [trip.slug])).rows[0]).toEqual({ n: 2 });

    expect((await t.archiveTrip(trip.slug, { redirectTo: "/customized-tours" })).error).toBeUndefined();
    expect((await row(trip.slug)).status).toBe("archived");
    expect(await t.redirectFor(trip.slug)).toBe("/customized-tours");
  });

  it("refuses a visible trip with nothing live, at the database", async () => {
    await expect(
      ctx.client.query(`insert into trips (id, slug, kind, status) values ('x', 'empty', 'group', 'published')`)
    ).rejects.toThrow();
  });
});

describe("moving the coded trips in", () => {
  it("moves all 34 once, changes nothing the site shows, and a second run does nothing", async () => {
    const before = {
      tours: await catalogue.getTrips({ includeUnpublished: true }),
      packages: await catalogue.getDestinations({ includeUnpublished: true }),
    };
    const first = await tripImport.importCodeTrips();
    expect(first.failed).toEqual([]);
    expect(first.moved).toHaveLength(before.tours.length + before.packages.length);

    const second = await tripImport.importCodeTrips();
    expect(second.moved).toEqual([]);

    const counts = (await ctx.client.query<{ kind: string; n: number }>(
      `select kind, count(*)::int as n from trips where source = 'code' and status = 'published' group by kind order by kind`
    )).rows;
    expect(counts).toEqual([
      { kind: "customized", n: before.packages.length },
      { kind: "group", n: before.tours.length },
    ]);

    // What the pages render, compared field by field (the request cache is
    // per call here, so these are fresh reads from the table).
    const after = {
      tours: await catalogue.getTrips({ includeUnpublished: true }),
      packages: await catalogue.getDestinations({ includeUnpublished: true }),
    };
    const SHOWN_TOUR = ["title", "destination", "duration", "heroNote", "itinerary", "inclusions", "exclusions", "faq", "highlights", "sharing", "pickups", "price", "nextDeparture", "published"];
    const SHOWN_PKG = ["title", "destination", "duration", "heroNote", "outline", "inclusions", "exclusions", "faq", "highlights", "fromPrice", "bestTime", "idealFor", "places", "published"];
    // jsonb stores object keys in its own order ({a, q} not {q, a}); pages
    // read fields by name, so compare with sorted keys. Day numbers are text
    // by design (see lib/trip-model.parity.test.js).
    const canonical = (x: unknown): unknown =>
      Array.isArray(x)
        ? x.map(canonical)
        : x && typeof x === "object"
          ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canonical((x as Record<string, unknown>)[k])]))
          : x;
    // A list the code never set reads as empty after the move ([] for
    // undefined): every page maps over these or checks `.length`, so the two
    // render the same.
    const LISTS = new Set(["itinerary", "outline", "inclusions", "exclusions", "faq", "highlights", "sharing", "pickups", "idealFor", "places"]);
    const value = (key: string, v: unknown) => (LISTS.has(key) && v === undefined ? [] : v);
    const text = (key: string, v: unknown) => JSON.stringify(canonical(value(key, v)), (k, x) => (k === "day" ? String(x) : x));
    for (const tour of before.tours) {
      const now = after.tours.find((t: { slug: string }) => t.slug === tour.slug);
      for (const key of SHOWN_TOUR) expect(text(key, now?.[key]), `${tour.slug}.${key}`).toBe(text(key, tour[key]));
      expect(now?.managed).toBe(true);
    }
    for (const pkg of before.packages) {
      const now = after.packages.find((p: { slug: string }) => p.slug === pkg.slug);
      for (const key of SHOWN_PKG) expect(text(key, now?.[key]), `${pkg.slug}.${key}`).toBe(text(key, pkg[key]));
    }
  });
});
