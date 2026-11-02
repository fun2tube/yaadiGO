import { z } from "zod";
import { getDb } from "@/db";
import { recordLeave, recordPageview, recordSiteEvent } from "@/db/analytics";
import { classifySource, isBot, isTrackedPath, normalisePath, parseUserAgent } from "@/lib/analytics/classify";
import { SITE_URL } from "@/lib/site";
import { SESSION_COOKIE } from "@/lib/cms/auth";
import { enforceRateLimit } from "@/lib/ai";

export const dynamic = "force-dynamic";

/**
 * The visitor-analytics beacon (src/instrumentation-client.js sends it).
 *
 * Public and unauthenticated, so it trusts nothing: every field is validated
 * and clipped, bots are dropped, signed-in staff are not counted (they would
 * swamp a small site's numbers), and the answer is always 204. A tracker that
 * errors at a visitor, or tells a scraper what it got wrong, helps nobody.
 *
 * Bodies arrive as text/plain (navigator.sendBeacon's default), which keeps
 * the request "simple": no CORS preflight, and it survives the page closing.
 */

const ID = z.string().uuid();
const text = (max) => z.string().max(max).optional().nullable();

const Pageview = z.object({
  t: z.literal("pv"),
  vid: ID,
  sid: ID,
  pid: ID,
  path: z.string().max(2000),
  search: text(2000),
  ref: text(2000),
  newVisitor: z.boolean().optional(),
  tz: text(64),
  lang: text(35),
});

const Leave = z.object({
  t: z.literal("leave"),
  sid: ID,
  pid: ID,
  dur: z.number().int().min(0).max(6 * 60 * 60 * 1000),
  scroll: z.number().int().min(0).max(100),
});

// Only names the tracker sends. A free-form name would let anyone fill the
// table with whatever they like.
const EVENT_NAMES = ["whatsapp_clicked", "call_clicked", "email_clicked", "outbound_clicked"];
const Event = z.object({
  t: z.literal("ev"),
  sid: ID,
  name: z.enum(EVENT_NAMES),
  path: z.string().max(2000),
  props: z.record(z.string().max(40), z.union([z.string().max(300), z.number(), z.boolean()])).optional(),
});

const Beacon = z.discriminatedUnion("t", [Pageview, Leave, Event]);

const done = () => new Response(null, { status: 204 });

// Chrome still reports India's old zone name; one name per place, or the
// report splits India in two.
const ZONE_ALIASES = { "Asia/Calcutta": "Asia/Kolkata", "Asia/Katmandu": "Asia/Kathmandu", "Asia/Saigon": "Asia/Ho_Chi_Minh" };

export async function POST(request) {
  try {
    const ua = request.headers.get("user-agent") ?? "";
    if (isBot(ua)) return done();
    // Staff browsing their own site are not visitors.
    if (request.cookies.get(SESSION_COOKIE)) return done();

    try {
      // An hour's budget per address. A person clicking through the whole
      // site does not come close; a script hammering the endpoint does.
      enforceRateLimit(request, "beacon", 600);
    } catch {
      return done();
    }

    const db = getDb();
    if (!db) return done();

    const raw = await request.text();
    if (raw.length > 8000) return done();
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      // Junk is dropped quietly; logging it would let anyone fill our logs.
      return done();
    }
    const parsed = Beacon.safeParse(json);
    if (!parsed.success) return done();
    const beacon = parsed.data;

    if (beacon.t === "pv") {
      const path = normalisePath(beacon.path);
      if (!isTrackedPath(path)) return done();
      const params = new URLSearchParams(beacon.search ?? "");
      const source = classifySource({
        referrer: beacon.ref ?? null,
        params,
        ownHost: new URL(SITE_URL).hostname,
      });
      await recordPageview(db, {
        visitId: beacon.sid,
        pageviewId: beacon.pid,
        path,
        visit: {
          visitorId: beacon.vid,
          newVisitor: beacon.newVisitor ?? true,
          landingPath: path,
          ...source,
          ...parseUserAgent(ua),
          timezone: beacon.tz ? (ZONE_ALIASES[beacon.tz] ?? beacon.tz) : null,
          language: beacon.lang ?? null,
        },
      });
    } else if (beacon.t === "leave") {
      await recordLeave(db, {
        visitId: beacon.sid,
        pageviewId: beacon.pid,
        durationMs: beacon.dur,
        maxScroll: beacon.scroll,
      });
    } else {
      await recordSiteEvent(db, {
        visitId: beacon.sid,
        name: beacon.name,
        path: normalisePath(beacon.path),
        props: beacon.props ?? {},
      });
    }
  } catch (error) {
    // Logged for us, never shown to the visitor.
    console.error("[analytics] beacon failed:", error?.message ?? error);
  }
  return done();
}
