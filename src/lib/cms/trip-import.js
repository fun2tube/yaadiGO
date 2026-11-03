import "server-only";

import { createRecord, listRecords } from "@/lib/cms/records";
import { getDestinations, getTrips } from "@/lib/cms/catalogue";
import { TRIPS } from "@/lib/cms/trips";
import { contentFromPackage, contentFromTour } from "@/lib/trip-model";

/**
 * Move the trips that still live in code (lib/tours.js, lib/packages.js) into
 * the `trips` table (docs/design/ai-cofounder.md §6a, phase 1d).
 *
 * Each record is built from the trip AS VISITORS SEE IT NOW (code plus any
 * legacy admin override), through the same conversion the editor uses when a
 * coded trip is first edited, so the page does not change. Proven for all 34
 * by lib/trip-model.parity.test.js.
 *
 * Idempotent: a trip that already has a record is left alone, so this runs
 * after every deploy (/api/cron/maintenance) and does nothing once done. Two
 * runs at once cannot double a trip: `trips.slug` is UNIQUE, and the loser's
 * insert is skipped.
 *
 * Departures and seats are not part of this: they stay where the booking code
 * moves them.
 */
export async function importCodeTrips() {
  const existing = new Set(((await listRecords(TRIPS)) ?? []).map((r) => r.slug));
  const [tours, packages] = await Promise.all([
    getTrips({ includeUnpublished: true }),
    getDestinations({ includeUnpublished: true }),
  ]);

  const candidates = [
    ...tours.filter((t) => !t.managed).map((t) => ({ kind: "group", item: t, content: () => contentFromTour(t) })),
    ...packages.filter((p) => !p.managed).map((p) => ({ kind: "customized", item: p, content: () => contentFromPackage(p) })),
  ];

  const moved = [];
  const skipped = [];
  const failed = [];
  for (const { kind, item, content } of candidates) {
    if (existing.has(item.slug)) {
      skipped.push(item.slug);
      continue;
    }
    try {
      const live = content();
      await createRecord(TRIPS, {
        slug: item.slug,
        kind,
        // A coded trip an old override had hidden stays hidden.
        status: item.published === false ? "internal" : "published",
        live,
        draft: null,
        version: 0,
        source: "code",
        sourceRef: null,
        redirectTo: null,
        createdByName: "Moved from code",
        updatedById: null,
        updatedByName: null,
      });
      moved.push(item.slug);
    } catch (error) {
      // Most likely a concurrent run got there first (unique slug); either
      // way it must not stop the rest.
      failed.push({ slug: item.slug, error: String(error?.message ?? error).slice(0, 200) });
    }
  }
  return { moved, skipped, failed };
}
