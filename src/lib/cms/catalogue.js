import "server-only";

import { cache } from "react";

import { listRecords, upsertBy } from "@/lib/cms/records";
import { mergeDepartureEdits } from "@/lib/cms/departure-edits";
import { loadCommitments, withTripLock } from "@/lib/cms/seats";
import { departureState } from "@/lib/inventory";
import { getOverrides } from "@/lib/cms/store";
import { groupTours, departureStatus, formatDepartureDate } from "@/lib/tours";
import { packages } from "@/lib/packages";
import { TRIPS } from "@/lib/cms/trips";
import { packageFromContent, tourFromContent } from "@/lib/trip-model";

/**
 * The catalogue the public site actually renders.
 *
 * Three layers, highest wins:
 *
 *   1. MANAGED trips (`lib/cms/trips.js`) — created or fully edited in the
 *      admin, with their own itinerary, inclusions and photos. A coded trip
 *      becomes managed the first time someone edits its content.
 *   2. Legacy per-slug OVERRIDES on a coded trip (below).
 *   3. The code catalogue in `lib/tours.js` / `lib/packages.js`.
 *
 * Departures and seat counts are NOT part of a managed trip: they stay in
 * `tripOverrides`, moved only by bookings and saveTripDepartures (#130).
 *
 * The rest of this note describes the override layer. Code defines the
 * trips; the admin stores a per-slug OVERRIDE on top. Same
 * reasoning as the content store — an empty override file renders exactly the
 * site in git, and a bad edit is undone by deleting one record.
 *
 * What the admin may override is deliberately narrow: the operational fields
 * that change weekly (departure dates, seats, prices, whether a trip is
 * listed at all). Itineraries and inclusions stay in code, where they get
 * reviewed — those are the promises the business has to honour, and they
 * should not be a two-tap change on a phone.
 */

export const TRIP_OVERRIDES = "tripOverrides";
export const DESTINATION_OVERRIDES = "destinationOverrides";

/** Recompute everything derived, so an edited trip behaves like a coded one. */
function applyTripOverride(tour, override) {
  if (!override) return { ...tour, published: true, edited: false };

  const departures = (override.departures ?? tour.departures).map((d) => ({
    ...d,
    status: departureStatus(d),
  }));

  const bookable = departures.filter((d) => d.seatsLeft > 0);
  const next = bookable[0] ?? departures[0];

  return {
    ...tour,
    title: override.title ?? tour.title,
    heroNote: override.heroNote ?? tour.heroNote,
    destination: override.destination ?? tour.destination,
    duration: override.duration ?? tour.duration,
    groupSize: override.groupSize ?? tour.groupSize,
    advanceAmount: override.advanceAmount ?? tour.advanceAmount,
    departures,
    // Derived fields must be recomputed, never carried over — a stale
    // "from" price under edited departures is the kind of wrong number that
    // ends up in a customer complaint.
    price: departures.length ? Math.min(...departures.map((d) => d.price)) : tour.price,
    nextDeparture: next ? formatDepartureDate(next.start) : tour.nextDeparture,
    seatsLeft: next?.seatsLeft ?? 0,
    departureCount: bookable.length,
    published: override.published !== false,
    edited: true,
  };
}

/**
 * Resolve each item's card photo, on the server.
 *
 * The listings that render these cards are CLIENT components — they hold the
 * filter state — which pulls the card components into the client bundle with
 * them. A client component cannot await the override store, so putting an
 * `<EditableImg>` inside a card is impossible. That boundary is what blocked
 * making card art editable at all.
 *
 * Resolving it here sidesteps the boundary rather than fighting it: the server
 * attaches the final image id to the data, and the card stays a dumb renderer
 * that works in either environment. The cmsId travels with it, so the editor
 * can still select the image even though the card never touched the store.
 */
async function withCardImages(items, kind) {
  const overrides = await getOverrides();

  return items.map((item) => {
    const cmsId = `${kind}.${item.slug}.card`;
    return {
      ...item,
      // Falls back to the slug, which is how the media library is keyed — so
      // an item with no override renders exactly what it rendered before.
      // Admin-chosen card art, then the trip's own cover, then the photo
      // registered under its slug.
      cardImageId: overrides.image[cmsId] || item.coverImageId || item.slug,
      cardImageCmsId: cmsId,
      cardImageHidden: Boolean(overrides.hidden[cmsId]),
    };
  });
}

/**
 * Live seats on every departure (lib/inventory.js), and the trip-level
 * summary every card and listing reads — recomputed from them, so a batch
 * that closes or sells out changes the card, the listing and the chat at once.
 *
 * Past and cancelled batches stay in `departures` (the admin needs them);
 * `bookable` on each one is what the public site offers.
 */
function withSeats(tour, booked, held, now = Date.now()) {
  const departures = [...(tour.departures ?? [])]
    .sort((a, b) => String(a.start).localeCompare(String(b.start)))
    .map((d) => departureState(d, { tripSlug: tour.slug, booked, held, now }));
  const open = departures.filter((d) => d.bookable);
  const upcoming = departures.filter((d) => d.status !== "completed" && d.status !== "cancelled");
  const next = open[0] ?? upcoming[0] ?? null;
  const priced = open.length ? open : upcoming;

  return {
    ...tour,
    departures,
    price: priced.length ? Math.min(...priced.map((d) => d.price)) : tour.price ?? 0,
    nextDeparture: next ? formatDepartureDate(next.start) : "Dates coming soon",
    seatsLeft: next?.seatsLeft ?? 0,
    departureCount: open.length,
    guaranteed: Boolean(next?.guaranteed),
  };
}

/** Managed trip records, once per request. */
const managedTrips = cache(async function managedTrips() {
  return (await listRecords(TRIPS)) ?? [];
});

/** What a managed record adds to the page-shaped object. */
function managedMeta(record) {
  return {
    published: record.status === "published",
    status: record.status,
    edited: true,
    managed: true,
    version: record.version ?? 0,
  };
}

/**
 * Every trip, merged. `includeUnpublished` is for the admin and the booking
 * code: it includes sales-only and archived trips too, because a booking on an
 * archived trip must still be able to release its seats.
 */
export function getTrips({ includeUnpublished = false } = {}) {
  // React's request cache compares arguments by identity, so an options
  // OBJECT missed it on every call — each `getTrip(slug)` re-ran the whole
  // catalogue against a database 400 ms away. A boolean is a stable key.
  return tripsForRequest(Boolean(includeUnpublished));
}

/** Bookings and holds, once per request however many trips are rendered. */
const commitmentsForRequest = cache(() => loadCommitments());

const tripsForRequest = cache(async function tripsForRequest(includeUnpublished) {
  // Bookings and holds load alongside everything else, not after it.
  const commitments = commitmentsForRequest();
  const [overrides, records] = await Promise.all([listRecords(TRIP_OVERRIDES), managedTrips()]);
  const bySlug = new Map(overrides.map((row) => [row.slug, row]));
  const managed = new Map(
    records.filter((r) => r.kind === "group" && r.live).map((r) => [r.slug, r])
  );

  const fromCode = groupTours.map((tour) => {
    const record = managed.get(tour.slug);
    const override = bySlug.get(tour.slug);
    if (!record) return applyTripOverride(tour, override);
    return tourFromContent(
      tour.slug,
      record.live,
      override?.departures ?? tour.departures,
      managedMeta(record)
    );
  });

  const coded = new Set(groupTours.map((t) => t.slug));
  const fromAdmin = [...managed.values()]
    .filter((record) => !coded.has(record.slug))
    .map((record) =>
      tourFromContent(
        record.slug,
        record.live,
        bySlug.get(record.slug)?.departures ?? [],
        managedMeta(record)
      )
    );

  const merged = await withCardImages([...fromCode, ...fromAdmin], "trip");
  const { booked, held } = await commitments;
  const live = merged.map((tour) => withSeats(tour, booked, held));
  return includeUnpublished ? live : live.filter((tour) => tour.published);
});

export async function getTrip(slug, { includeUnpublished = false } = {}) {
  const trips = await getTrips({ includeUnpublished });
  return trips.find((tour) => tour.slug === slug) ?? null;
}

export async function saveTripOverride(slug, patch) {
  if (!groupTours.some((tour) => tour.slug === slug)) return null;
  // A managed trip's title and visibility belong to its record and its
  // Publish/Archive actions, not to this legacy override.
  if ((await managedTrips()).some((r) => r.slug === slug && r.kind === "group" && r.live)) {
    return { slug, managed: true };
  }
  // Departures never go through a plain upsert: that is the blind overwrite
  // that could undo a booking (#130). They go through saveTripDepartures.
  const rest = { ...patch };
  delete rest.departures;
  return upsertBy(TRIP_OVERRIDES, "slug", slug, rest);
}

/**
 * Save the editor's departure changes — dates, prices, batch size, minimum
 * to run, cut-off. Seats left are never written; they are derived.
 *
 * Runs under the trip's lock (seats.js), so a booking or hold cannot land
 * between the check ("is the new size at least what is committed?") and the
 * write. Returns { ok: true } or { ok: false, message }.
 */
export async function saveTripDepartures(slug, edits) {
  const tour = groupTours.find((t) => t.slug === slug);
  const record = (await managedTrips()).find((r) => r.slug === slug && r.kind === "group");
  if (!tour && !record) return { ok: false, message: "No such trip." };

  return withTripLock(slug, async ({ departures, states }) => mergeDepartureEdits(departures, edits, states));
}

function applyDestinationOverride(pkg, override) {
  if (!override) return { ...pkg, published: true, edited: false };
  return {
    ...pkg,
    title: override.title ?? pkg.title,
    heroNote: override.heroNote ?? pkg.heroNote,
    destination: override.destination ?? pkg.destination,
    duration: override.duration ?? pkg.duration,
    fromPrice: override.fromPrice ?? pkg.fromPrice,
    bestTime: override.bestTime ?? pkg.bestTime,
    idealFor: override.idealFor ?? pkg.idealFor,
    published: override.published !== false,
    edited: true,
  };
}

export function getDestinations({ includeUnpublished = false } = {}) {
  // A boolean key, for the same reason as getTrips.
  return destinationsForRequest(Boolean(includeUnpublished));
}

const destinationsForRequest = cache(async function destinationsForRequest(includeUnpublished) {
  const [overrides, records] = await Promise.all([
    listRecords(DESTINATION_OVERRIDES),
    managedTrips(),
  ]);
  const bySlug = new Map(overrides.map((row) => [row.slug, row]));
  const managed = new Map(
    records.filter((r) => r.kind === "customized" && r.live).map((r) => [r.slug, r])
  );

  const fromCode = packages.map((pkg) => {
    const record = managed.get(pkg.slug);
    if (!record) return applyDestinationOverride(pkg, bySlug.get(pkg.slug));
    return packageFromContent(pkg.slug, record.live, managedMeta(record));
  });

  const coded = new Set(packages.map((p) => p.slug));
  const fromAdmin = [...managed.values()]
    .filter((record) => !coded.has(record.slug))
    .map((record) => packageFromContent(record.slug, record.live, managedMeta(record)));

  const merged = await withCardImages([...fromCode, ...fromAdmin], "destination");
  return includeUnpublished ? merged : merged.filter((pkg) => pkg.published);
});

export async function getDestination(slug, { includeUnpublished = false } = {}) {
  const all = await getDestinations({ includeUnpublished });
  return all.find((pkg) => pkg.slug === slug) ?? null;
}

export async function saveDestinationOverride(slug, patch) {
  if (!packages.some((pkg) => pkg.slug === slug)) return null;
  return upsertBy(DESTINATION_OVERRIDES, "slug", slug, patch);
}
