import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./index";
import { pageviews, siteEvents, visits } from "./schema";

/**
 * Writes for the visitor analytics (lib/analytics, docs/design/ai-cofounder.md).
 *
 * Every time is the server's `now()`. A phone's clock is whatever its owner
 * set it to, and a report bucketed by it would put visits in the wrong day.
 *
 * Beacons can arrive twice (a retry, a back-forward cache restore), so each
 * write is idempotent: a pageview id already seen changes nothing, and the
 * visit's page count only moves when a pageview row was actually inserted.
 */

export type VisitInfo = {
  visitorId: string;
  newVisitor: boolean;
  landingPath: string;
  referrerHost: string | null;
  channel: string;
  source: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  device: string;
  browser: string | null;
  os: string | null;
  timezone: string | null;
  language: string | null;
};

type Db = NonNullable<ReturnType<typeof getDb>>;

export async function recordPageview(
  db: Db,
  input: { visitId: string; pageviewId: string; path: string; visit: VisitInfo }
) {
  return db.transaction(async (tx) => {
    // The first pageview of a visit creates it, classified as it arrived.
    // Later ones only touch last_seen_at: a visit's source is where it came
    // FROM, which an internal click must not overwrite.
    await tx
      .insert(visits)
      .values({ id: input.visitId, ...input.visit, pageviews: 0 })
      .onConflictDoUpdate({ target: visits.id, set: { lastSeenAt: sql`now()` } });

    const inserted = await tx
      .insert(pageviews)
      .values({ id: input.pageviewId, visitId: input.visitId, path: input.path })
      .onConflictDoNothing()
      .returning({ id: pageviews.id });

    if (inserted.length) {
      await tx
        .update(visits)
        .set({ pageviews: sql`${visits.pageviews} + 1` })
        .where(eq(visits.id, input.visitId));
    }
    return inserted.length > 0;
  });
}

/** How long the page was looked at and how far down. Only ever grows. */
export async function recordLeave(
  db: Db,
  input: { visitId: string; pageviewId: string; durationMs: number; maxScroll: number }
) {
  const updated = await db
    .update(pageviews)
    .set({
      durationMs: sql`greatest(coalesce(${pageviews.durationMs}, 0), ${input.durationMs})`,
      maxScroll: sql`greatest(coalesce(${pageviews.maxScroll}, 0), ${input.maxScroll})`,
    })
    .where(and(eq(pageviews.id, input.pageviewId), eq(pageviews.visitId, input.visitId)))
    .returning({ id: pageviews.id });
  if (updated.length) {
    await db.update(visits).set({ lastSeenAt: sql`now()` }).where(eq(visits.id, input.visitId));
  }
  return updated.length > 0;
}

/**
 * Something a visitor did. An event naming a visit we never saw (a stale
 * cookie, a blocked pageview) is kept without the link rather than lost.
 */
export async function recordSiteEvent(
  db: Db,
  input: { visitId: string | null; name: string; path?: string | null; props?: Record<string, unknown> }
) {
  let visitId = input.visitId;
  if (visitId) {
    const found = await db.select({ id: visits.id }).from(visits).where(eq(visits.id, visitId)).limit(1);
    if (!found.length) visitId = null;
  }
  await db.insert(siteEvents).values({
    visitId,
    name: input.name,
    path: input.path ?? null,
    props: input.props ?? {},
  });
}

/** True when this visit exists — lead capture links only to real visits. */
export async function visitExists(db: Db, visitId: string) {
  const found = await db.select({ id: visits.id }).from(visits).where(eq(visits.id, visitId)).limit(1);
  return found.length > 0;
}
