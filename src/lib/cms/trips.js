import "server-only";

import { createRecord, listRecords, mutateBy, removeRecord } from "@/lib/cms/records";
import { groupTours } from "@/lib/tours";
import { packages } from "@/lib/packages";
import {
  TripContentSchema,
  contentFromPackage,
  contentFromTour,
  emptyContent,
  publishProblems,
  slugify,
  tripPath,
} from "@/lib/trip-model";

/**
 * Trips managed in the admin (docs/design/trip-management.md, phase 1).
 *
 * One record per trip, keyed by slug:
 *
 *   { slug, kind, status, live, draft, version, source, redirectTo, … }
 *
 * `live` is what the website shows. `draft` is pending edits — saving never
 * changes the live page; only Publish does, and every publish stores a
 * snapshot in `tripVersions`.
 *
 * The 34 trips that started life in code are COPY-ON-WRITE: they keep
 * rendering from `lib/tours.js` / `lib/packages.js` until somebody first
 * edits one here, at which point the current page (code plus any old
 * override) is copied into a record and the record takes over. Nothing is
 * mass-migrated, so an empty table still means exactly the site in git —
 * the same rule every other editable thing in this project follows.
 *
 * Seats are deliberately NOT in here. Departures and seat counts stay where
 * the booking code moves them (see catalogue.js, and #130).
 */

export const TRIPS = "trips";
export const TRIP_VERSIONS = "tripVersions";

const codeTour = (slug) => groupTours.find((t) => t.slug === slug) ?? null;
const codePackage = (slug) => packages.find((p) => p.slug === slug) ?? null;

async function records() {
  return (await listRecords(TRIPS)) ?? [];
}

export async function getTripRecord(slug) {
  return (await records()).find((r) => r.slug === slug) ?? null;
}

/** Every slug in use anywhere, so a new trip can never collide with one. */
async function takenSlugs() {
  return new Set([
    ...groupTours.map((t) => t.slug),
    ...packages.map((p) => p.slug),
    ...(await records()).map((r) => r.slug),
  ]);
}

async function uniqueSlug(base) {
  const taken = await takenSlugs();
  const root = slugify(base) || "trip";
  if (!taken.has(root)) return root;
  for (let i = 2; i < 100; i++) {
    if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/**
 * The record for a trip, creating it from the code catalogue the first time a
 * coded trip is touched. `current` is the page as visitors see it right now
 * (code + any legacy override), passed in by the caller because that merge
 * lives in catalogue.js.
 */
function seedFromCode(slug, current) {
  const tour = codeTour(slug);
  const pkg = codePackage(slug);
  if (!tour && !pkg) return null;
  const kind = tour ? "group" : "customized";
  const content = tour ? contentFromTour(current ?? tour) : contentFromPackage(current ?? pkg);
  return {
    slug,
    kind,
    // A coded trip that an old override had hidden stays hidden.
    status: current?.published === false ? "internal" : "published",
    live: content,
    draft: null,
    version: 0,
    source: "code",
    redirectTo: null,
  };
}

const stamp = (actor) => ({
  updatedAt: new Date().toISOString(),
  updatedById: actor?.id ?? null,
  updatedByName: actor?.name ?? null,
});

// ---------------------------------------------------------------------------
// Reads for the admin
// ---------------------------------------------------------------------------

/**
 * One row per trip for the admin list — coded and managed alike, with what a
 * person needs to decide whether to open it.
 */
export async function listTripsForAdmin({ trips, destinations }) {
  const recs = new Map((await records()).map((r) => [r.slug, r]));
  const rows = [];

  const row = (kind, item, rec) => {
    const content = rec?.draft ?? rec?.live ?? null;
    return {
      slug: item?.slug ?? rec.slug,
      kind,
      title: content?.title ?? item?.title,
      destination: content?.destination ?? item?.destination,
      duration: content?.duration ?? item?.duration,
      coverImageId: content?.coverImageId ?? item?.cardImageId ?? item?.slug ?? null,
      status: rec?.status ?? (item?.published === false ? "internal" : "published"),
      hasDraft: Boolean(rec?.draft),
      version: rec?.version ?? 0,
      source: rec?.source ?? "code",
      updatedAt: rec?.updatedAt ?? null,
      updatedByName: rec?.updatedByName ?? null,
      // Group trips only
      nextDeparture: item?.nextDeparture ?? null,
      departureCount: item?.departureCount ?? null,
      seatsLeft: item?.seatsLeft ?? null,
      price: kind === "group" ? item?.price ?? null : content?.fromPrice ?? item?.fromPrice ?? null,
      path: tripPath(kind, item?.slug ?? rec.slug),
    };
  };

  for (const t of trips) rows.push(row("group", t, recs.get(t.slug)));
  for (const d of destinations) rows.push(row("customized", d, recs.get(d.slug)));

  // Records the catalogue does not list: drafts, archived trips, and anything
  // without live content yet.
  const listed = new Set(rows.map((r) => r.slug));
  for (const rec of recs.values()) {
    if (!listed.has(rec.slug)) rows.push(row(rec.kind, null, rec));
  }

  const order = { draft: 0, internal: 1, published: 2, archived: 3 };
  return rows.sort(
    (a, b) =>
      (b.hasDraft ? 1 : 0) - (a.hasDraft ? 1 : 0) ||
      order[a.status] - order[b.status] ||
      a.title.localeCompare(b.title)
  );
}

/** Everything the editor needs for one trip. */
export async function getTripForEdit(slug, current) {
  const rec = (await getTripRecord(slug)) ?? seedFromCode(slug, current);
  if (!rec) return null;
  const versions = (await listRecords(TRIP_VERSIONS))
    .filter((v) => v.tripSlug === slug)
    .sort((a, b) => b.version - a.version)
    .map(({ version, status, publishedAt, publishedByName, content }) => ({
      version,
      status,
      publishedAt,
      publishedByName,
      title: content?.title,
      days: content?.days?.length ?? 0,
    }));

  return {
    slug,
    kind: rec.kind,
    status: rec.status,
    content: rec.draft ?? rec.live ?? emptyContent(rec.kind),
    hasDraft: Boolean(rec.draft),
    everPublished: Boolean(rec.live),
    version: rec.version ?? 0,
    source: rec.source ?? "manual",
    redirectTo: rec.redirectTo ?? null,
    managed: Boolean(await getTripRecord(slug)),
    fromCode: Boolean(codeTour(slug) || codePackage(slug)),
    versions,
    path: tripPath(rec.kind, slug),
  };
}

/** Where an archived trip's old URL should send people, if anywhere. */
export async function redirectFor(slug) {
  const rec = await getTripRecord(slug);
  return rec?.status === "archived" && rec.redirectTo ? rec.redirectTo : null;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createTrip({ kind, title, actor }) {
  if (!["group", "customized"].includes(kind)) return { error: "Pick a kind of trip." };
  const name = String(title ?? "").trim();
  if (name.length < 3) return { error: "Give the trip a title." };

  const slug = await uniqueSlug(name);
  const record = await createRecord(TRIPS, {
    slug,
    kind,
    status: "draft",
    live: null,
    draft: emptyContent(kind, name),
    version: 0,
    source: "manual",
    redirectTo: null,
    createdAt: new Date().toISOString(),
    createdByName: actor?.name ?? null,
    ...stamp(actor),
  });
  return { trip: record };
}

export async function duplicateTrip(slug, { actor, current } = {}) {
  const from = (await getTripRecord(slug)) ?? seedFromCode(slug, current);
  if (!from) return { error: "No such trip." };
  const content = { ...(from.draft ?? from.live), title: `${(from.draft ?? from.live).title} (copy)` };
  const newSlug = await uniqueSlug(content.title);

  const record = await createRecord(TRIPS, {
    slug: newSlug,
    kind: from.kind,
    status: "draft",
    live: null,
    draft: content,
    version: 0,
    source: "duplicate",
    sourceRef: slug,
    redirectTo: null,
    createdAt: new Date().toISOString(),
    createdByName: actor?.name ?? null,
    ...stamp(actor),
  });
  return { trip: record };
}

/**
 * Save pending edits. Never changes the live page.
 *
 * Validation here is the lenient schema — a draft may be unfinished. The
 * stricter checks run on Publish.
 */
export async function saveDraft(slug, input, { actor, current } = {}) {
  const parsed = TripContentSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${issue.path.join(".") || "Trip"}: ${issue.message}` };
  }

  const saved = await mutateBy(TRIPS, "slug", slug, (existing) => {
    const base = existing ?? seedFromCode(slug, current);
    if (!base) return null;
    if (base.status === "archived") return null;
    return { ...base, draft: parsed.data, ...stamp(actor) };
  });
  if (!saved) return { error: "That trip cannot be edited (it may be archived or missing)." };
  return { trip: saved };
}

export async function discardDraft(slug, { actor } = {}) {
  const saved = await mutateBy(TRIPS, "slug", slug, (existing) => {
    if (!existing?.draft || !existing.live) return null;
    return { draft: null, ...stamp(actor) };
  });
  return saved ? { trip: saved } : { error: "There are no unpublished changes to discard." };
}

/**
 * Make the draft live — on the website (`published`) or in the sales library
 * only (`internal`). Snapshots the result as a new version.
 */
export async function publishTrip(slug, { target = "published", actor, current } = {}) {
  if (!["published", "internal"].includes(target)) return { error: "Unknown publish target." };

  let problems = [];
  let snapshot = null;
  const saved = await mutateBy(TRIPS, "slug", slug, (existing) => {
    const base = existing ?? seedFromCode(slug, current);
    if (!base) return null;
    const content = base.draft ?? base.live;
    if (!content) return null;

    problems = publishProblems(base.kind, content);
    if (target === "published" && problems.length) return null;

    const version = (base.version ?? 0) + 1;
    const now = new Date().toISOString();
    snapshot = { kind: base.kind, content, version, status: target, publishedAt: now };
    return {
      ...base,
      status: target,
      live: content,
      draft: null,
      version,
      redirectTo: null,
      publishedAt: now,
      publishedByName: actor?.name ?? null,
      ...stamp(actor),
    };
  });

  if (!saved) {
    return problems.length
      ? { error: `Not ready to go live: ${problems.join(" ")}`, problems }
      : { error: "No such trip." };
  }

  await createRecord(TRIP_VERSIONS, {
    key: `${slug}@${snapshot.version}`,
    tripSlug: slug,
    ...snapshot,
    publishedByName: actor?.name ?? null,
  });
  return { trip: saved };
}

/**
 * Take a trip off the website without losing it. `redirectTo` is a path on
 * this site (another trip, or a listing) its old URL should forward to.
 */
export async function archiveTrip(slug, { redirectTo = null, actor, current } = {}) {
  if (redirectTo && !/^\/(group-tours|customized-tours)(\/[a-z0-9-]+)?$/.test(redirectTo)) {
    return { error: "Redirect to a trip or listing on this site." };
  }
  if (redirectTo && redirectTo.endsWith(`/${slug}`)) {
    return { error: "A trip cannot redirect to itself." };
  }
  const saved = await mutateBy(TRIPS, "slug", slug, (existing) => {
    const base = existing ?? seedFromCode(slug, current);
    if (!base || !base.live) return null;
    return {
      ...base,
      status: "archived",
      redirectTo,
      archivedAt: new Date().toISOString(),
      ...stamp(actor),
    };
  });
  return saved ? { trip: saved } : { error: "Only a trip that has been published can be archived — delete a draft instead." };
}

export async function restoreTrip(slug, { actor } = {}) {
  const saved = await mutateBy(TRIPS, "slug", slug, (existing) => {
    if (existing?.status !== "archived") return null;
    // Back to sales-only, so it does not reappear on the site by surprise.
    return { status: "internal", redirectTo: null, archivedAt: null, ...stamp(actor) };
  });
  return saved ? { trip: saved } : { error: "Only an archived trip can be restored." };
}

/** Delete outright — only a draft that was never published. */
export async function deleteDraftTrip(slug) {
  const rec = await getTripRecord(slug);
  if (!rec) return { error: "No such trip." };
  if (rec.live || codeTour(slug) || codePackage(slug)) {
    return { error: "This trip has been published. Archive it instead — that keeps its history and its links." };
  }
  await removeRecord(TRIPS, rec.id);
  return { ok: true };
}
