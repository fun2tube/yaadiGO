import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createTestDb } from "./test-db";

/**
 * Visitor analytics, through the real writes into real Postgres, and the
 * Traffic report read back over them. The numbers here are the ones the
 * owner and the agent will make decisions on, so each definition in
 * lib/analytics/report.js is checked against rows we put in by hand.
 */

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let analytics: typeof import("./analytics");
let report: typeof import("../lib/analytics/report");

beforeAll(async () => {
  ctx = await createTestDb();
  process.env.DATABASE_URL = "pglite://test";
  (globalThis as { __yaadigoDb?: unknown }).__yaadigoDb = ctx.db;
  analytics = await import("./analytics");
  report = await import("../lib/analytics/report");
}, 60000);

beforeEach(async () => {
  await ctx.reset();
});

afterAll(async () => {
  await ctx.close();
});

const uuid = () => crypto.randomUUID();

const visitInfo = (over: Partial<import("./analytics").VisitInfo> = {}) => ({
  visitorId: uuid(),
  newVisitor: true,
  landingPath: "/",
  referrerHost: "google.com",
  channel: "organic",
  source: "google",
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmTerm: null,
  utmContent: null,
  device: "mobile",
  browser: "Chrome",
  os: "Android",
  timezone: "Asia/Kolkata",
  language: "en-IN",
  ...over,
});

async function visitRow(id: string) {
  const result = await ctx.client.query<{ pageviews: number; channel: string; landing_path: string }>(
    "select pageviews, channel, landing_path from visits where id = $1",
    [id]
  );
  return result.rows[0];
}

const period = () => {
  const until = new Date(Date.now() + 60_000);
  const since = new Date(Date.now() - 24 * 3600_000);
  return {
    since,
    until,
    previous: { since: new Date(since.getTime() - 24 * 3600_000), until: since },
  };
};

describe("recordPageview", () => {
  it("creates the visit on its first page and counts each page once", async () => {
    const visitId = uuid();
    const first = uuid();
    const visit = visitInfo({ landingPath: "/group-tours" });
    expect(await analytics.recordPageview(ctx.db as never, { visitId, pageviewId: first, path: "/group-tours", visit })).toBe(true);
    // The same beacon again (a retry) changes nothing.
    expect(await analytics.recordPageview(ctx.db as never, { visitId, pageviewId: first, path: "/group-tours", visit })).toBe(false);
    expect((await visitRow(visitId)).pageviews).toBe(1);

    // An internal click must not re-classify where the visit came from.
    await analytics.recordPageview(ctx.db as never, {
      visitId,
      pageviewId: uuid(),
      path: "/group-tours/ladakh",
      visit: visitInfo({ landingPath: "/group-tours/ladakh", channel: "direct", source: "direct" }),
    });
    const row = await visitRow(visitId);
    expect(row).toMatchObject({ pageviews: 2, channel: "organic", landing_path: "/group-tours" });
  });
});

describe("recordLeave", () => {
  it("only ever grows time and scroll, and ignores a pageview from another visit", async () => {
    const visitId = uuid();
    const pageviewId = uuid();
    await analytics.recordPageview(ctx.db as never, { visitId, pageviewId, path: "/", visit: visitInfo() });

    await analytics.recordLeave(ctx.db as never, { visitId, pageviewId, durationMs: 40_000, maxScroll: 80 });
    // A later, smaller report (a second tab flush) must not shrink it.
    await analytics.recordLeave(ctx.db as never, { visitId, pageviewId, durationMs: 5_000, maxScroll: 20 });
    expect(await analytics.recordLeave(ctx.db as never, { visitId: uuid(), pageviewId, durationMs: 99_000, maxScroll: 100 })).toBe(false);

    const result = await ctx.client.query<{ duration_ms: number; max_scroll: number }>(
      "select duration_ms, max_scroll from pageviews where id = $1",
      [pageviewId]
    );
    expect(result.rows[0]).toEqual({ duration_ms: 40_000, max_scroll: 80 });
  });

  it("refuses an impossible scroll depth at the database", async () => {
    const visitId = uuid();
    const pageviewId = uuid();
    await analytics.recordPageview(ctx.db as never, { visitId, pageviewId, path: "/", visit: visitInfo() });
    await expect(
      ctx.client.query("update pageviews set max_scroll = 140 where id = $1", [pageviewId])
    ).rejects.toThrow();
  });
});

describe("recordSiteEvent", () => {
  it("keeps an event for an unknown visit, without the link", async () => {
    await analytics.recordSiteEvent(ctx.db as never, { visitId: uuid(), name: "whatsapp_clicked", path: "/" });
    const result = await ctx.client.query<{ visit_id: string | null; name: string }>("select visit_id, name from site_events");
    expect(result.rows).toEqual([{ visit_id: null, name: "whatsapp_clicked" }]);
  });
});

describe("buildTrafficReport", () => {
  it("counts visitors, visits, enquiries and booked value by channel, without double counting", async () => {
    const returning = uuid();
    const googleVisit = uuid();
    const instaVisit = uuid();
    const directVisit = uuid();

    // Google: two pages, one enquiry that became a ₹50,000 booking, plus a
    // second lead on the same visit with no booking.
    await analytics.recordPageview(ctx.db as never, { visitId: googleVisit, pageviewId: uuid(), path: "/", visit: visitInfo({ visitorId: returning }) });
    await analytics.recordPageview(ctx.db as never, { visitId: googleVisit, pageviewId: uuid(), path: "/group-tours", visit: visitInfo({ visitorId: returning }) });
    // Instagram: one page, no enquiry. Same browser as the Google visit.
    await analytics.recordPageview(ctx.db as never, {
      visitId: instaVisit,
      pageviewId: uuid(),
      path: "/group-tours/ladakh",
      visit: visitInfo({ visitorId: returning, channel: "social", source: "instagram", landingPath: "/group-tours/ladakh" }),
    });
    // Direct: one page.
    await analytics.recordPageview(ctx.db as never, {
      visitId: directVisit,
      pageviewId: uuid(),
      path: "/",
      visit: visitInfo({ channel: "direct", source: "direct", referrerHost: null }),
    });

    await ctx.client.query(
      `insert into leads (id, name, source, visit_id) values ('lead-1', 'Asha', 'enquiry', $1), ('lead-2', 'Asha', 'planner', $1)`,
      [googleVisit]
    );
    await ctx.client.query(
      `insert into bookings (id, reference, source, lead_id, status, name, trip_title, total_paise)
       values ('bk-1', 'YG-1', 'quotation', 'lead-1', 'confirmed', 'Asha', 'Ladakh', 5000000),
              ('bk-2', 'YG-2', 'quotation', 'lead-1', 'cancelled', 'Asha', 'Ladakh', 9900000)`
    );

    const r = await report.buildTrafficReport(period());
    expect(r.available).toBe(true);
    expect(r.headline).toMatchObject({
      visitors: 2,
      visits: 3,
      pageviews: 4,
      onePagePct: 67,
      enquiries: 2,
      conversionPct: 33.3,
    });

    const google = r.channels.find((c: { channel: string }) => c.channel === "organic");
    // One booking, at its own value: not doubled by the visit's second lead,
    // and the cancelled one is not counted.
    expect(google).toMatchObject({ visits: 1, enquiries: 2, bookings: 1, bookedPaise: 5000000 });
    expect(r.channels.find((c: { channel: string }) => c.channel === "social")).toMatchObject({ visits: 1, enquiries: 0, bookings: 0 });

    expect(r.landing[0]).toMatchObject({ path: "/", visits: 2 });
    expect(r.liveNow).toBe(3);
  });

  it("reports an empty period as zeros, not errors", async () => {
    const r = await report.buildTrafficReport(period());
    expect(r.headline).toMatchObject({ visitors: 0, visits: 0, enquiries: 0, conversionPct: null, engagedSeconds: null });
    expect(r.channels).toEqual([]);
  });
});
