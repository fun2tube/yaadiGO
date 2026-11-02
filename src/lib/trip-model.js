import { z } from "zod";
import {
  ADVANCE_DEFAULT,
  SHARING_STANDARD,
  departureStatus,
  formatDepartureDate,
} from "@/lib/tours";

/**
 * One trip shape for both kinds (docs/design/trip-management.md §4.1).
 *
 * Group tours (`lib/tours.js`) and customized trips (`lib/packages.js`) grew
 * up as two hand-written shapes. The admin edits ONE content shape; the two
 * converters at the bottom turn it back into exactly what the existing pages
 * already render, so no public page had to change to read from the database.
 *
 * Browser-safe: the editor imports the schema and the defaults.
 */

export const TRIP_KINDS = [
  { value: "group", label: "Group tour", blurb: "Fixed dates, shared group, seats per departure." },
  { value: "customized", label: "Customized trip", blurb: "A starting plan built around the customer's dates." },
];

/**
 * draft     never published — only the admin sees it
 * internal  published to the sales library only, never on the website
 * published live on the website
 * archived  off the website; its URL redirects to `redirectTo` if set
 */
export const TRIP_STATUSES = [
  { value: "draft", label: "Draft", tone: "faint" },
  { value: "internal", label: "Sales only", tone: "warn" },
  { value: "published", label: "Live", tone: "good" },
  { value: "archived", label: "Archived", tone: "faint" },
];

export function tripPath(kind, slug) {
  return kind === "group" ? `/group-tours/${slug}` : `/customized-tours/${slug}`;
}

export function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

// ---------------------------------------------------------------------------
// The editable content
// ---------------------------------------------------------------------------

const line = z.string().trim().min(1).max(400);
const Day = z.object({
  day: z.union([z.number(), z.string()]).transform((v) => String(v).trim()),
  title: z.string().trim().min(1, "Every day needs a title.").max(120),
  detail: z.string().trim().max(1200).default(""),
});
const Faq = z.object({
  q: z.string().trim().min(1).max(240),
  a: z.string().trim().min(1).max(1200),
});
const Priced = z.object({
  id: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(80).optional(),
  city: z.string().trim().min(1).max(80).optional(),
  detail: z.string().trim().max(160).default(""),
  delta: z.number().int().min(0).max(1_000_000),
});

export const TripContentSchema = z.object({
  title: z.string().trim().min(3, "Give the trip a title.").max(120),
  destination: z.string().trim().min(2, "Say where it goes, e.g. Srinagar · Gulmarg.").max(160),
  region: z.enum(["India", "International"]).default("India"),
  theme: z.string().trim().min(2).max(40),
  duration: z.string().trim().min(2, "Say how long, e.g. 6N / 7D.").max(40),
  summary: z.string().trim().min(10, "Write one or two lines on why this trip.").max(400),
  coverImageId: z.string().trim().max(120).nullable().default(null),
  highlights: z.array(line).max(20).default([]),
  days: z.array(Day).max(40).default([]),
  inclusions: z.array(line).max(40).default([]),
  exclusions: z.array(line).max(40).default([]),
  faq: z.array(Faq).max(20).default([]),
  knowBefore: z.array(line).max(20).default([]),

  // Group tours
  groupSize: z.string().trim().max(60).default(""),
  ageGroup: z.string().trim().max(40).default(""),
  advanceAmount: z.number().int().min(0).max(1_000_000).default(ADVANCE_DEFAULT),
  sharing: z.array(Priced).max(6).default(SHARING_STANDARD),
  pickups: z.array(Priced).max(12).default([]),

  // Customized trips
  fromPrice: z.number().int().min(0).max(10_000_000).default(0),
  bestTime: z.string().trim().max(120).default(""),
  idealFor: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  places: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
});

/**
 * Stricter checks that only apply when PUBLISHING — a draft may be half
 * written, a live page may not. Returns a list of plain-language problems.
 */
export function publishProblems(kind, content) {
  const problems = [];
  if (!content.days?.length) problems.push("Add the day-by-day itinerary.");
  if (!content.inclusions?.length) problems.push("List what is included.");
  if (kind === "group") {
    if (!content.pickups?.length) problems.push("Add at least one joining point.");
    if (!content.sharing?.length) problems.push("Add at least one room-sharing option.");
  } else if (!content.fromPrice) {
    problems.push("Set a 'from' price per person.");
  }
  return problems;
}

export function emptyContent(kind, title = "") {
  return TripContentSchema.parse({
    title: title || "Untitled trip",
    destination: "To be decided",
    theme: kind === "group" ? "Mountains" : "Culture",
    duration: kind === "group" ? "5N / 6D" : "5–7 days",
    summary: "A short line on what makes this trip worth taking.",
    pickups:
      kind === "group"
        ? [{ id: "start", city: "Starting city", detail: "Join at the start point", delta: 0 }]
        : [],
  });
}

// ---------------------------------------------------------------------------
// From the code catalogue into content (used once, when a coded trip is first
// edited in the admin — copy-on-write)
// ---------------------------------------------------------------------------

export function contentFromTour(tour) {
  return TripContentSchema.parse({
    title: tour.title,
    destination: tour.destination,
    region: tour.region ?? "India",
    theme: tour.theme ?? "Mountains",
    duration: tour.duration,
    summary: tour.heroNote ?? "",
    coverImageId: tour.coverImageId ?? null,
    highlights: tour.highlights ?? [],
    days: tour.itinerary ?? [],
    inclusions: tour.inclusions ?? [],
    exclusions: tour.exclusions ?? [],
    faq: tour.faq ?? [],
    knowBefore: tour.knowBefore ?? [],
    groupSize: tour.groupSize ?? "",
    ageGroup: tour.ageGroup ?? "",
    advanceAmount: tour.advanceAmount ?? ADVANCE_DEFAULT,
    sharing: tour.sharing ?? SHARING_STANDARD,
    pickups: tour.pickups ?? [],
  });
}

export function contentFromPackage(pkg) {
  return TripContentSchema.parse({
    title: pkg.title,
    destination: pkg.destination,
    region: pkg.region ?? "India",
    theme: pkg.theme ?? "Culture",
    duration: pkg.duration,
    summary: pkg.heroNote ?? "",
    coverImageId: pkg.coverImageId ?? null,
    highlights: pkg.highlights ?? [],
    days: pkg.outline ?? [],
    inclusions: pkg.inclusions ?? [],
    exclusions: pkg.exclusions ?? [],
    faq: pkg.faq ?? [],
    knowBefore: pkg.knowBefore ?? [],
    fromPrice: pkg.fromPrice ?? 0,
    bestTime: pkg.bestTime ?? "",
    idealFor: pkg.idealFor ?? [],
    places: pkg.places ?? [],
  });
}

// ---------------------------------------------------------------------------
// From content back to what the pages render
// ---------------------------------------------------------------------------

/**
 * A group tour exactly as `lib/tours.js` shapes one, including the derived
 * summary fields — and safe with no departures, which a brand-new trip has.
 */
export function tourFromContent(slug, content, departures = [], extra = {}) {
  const withStatus = departures.map((d) => ({ ...d, status: departureStatus(d) }));
  const bookable = withStatus.filter((d) => d.seatsLeft > 0);
  const next = bookable[0] ?? withStatus[0] ?? null;

  return {
    slug,
    title: content.title,
    destination: content.destination,
    region: content.region,
    theme: content.theme,
    duration: content.duration,
    heroNote: content.summary,
    groupSize: content.groupSize,
    ageGroup: content.ageGroup,
    advanceAmount: content.advanceAmount,
    sharing: content.sharing,
    pickups: content.pickups,
    itinerary: content.days,
    highlights: content.highlights,
    inclusions: content.inclusions,
    exclusions: content.exclusions,
    faq: content.faq,
    knowBefore: content.knowBefore,
    coverImageId: content.coverImageId,
    departures: withStatus,
    price: withStatus.length ? Math.min(...withStatus.map((d) => d.price)) : 0,
    nextDeparture: next ? formatDepartureDate(next.start) : "Dates coming soon",
    seatsLeft: next?.seatsLeft ?? 0,
    departureCount: bookable.length,
    ...extra,
  };
}

/** A customized trip exactly as `lib/packages.js` shapes one. */
export function packageFromContent(slug, content, extra = {}) {
  return {
    slug,
    title: content.title,
    destination: content.destination,
    region: content.region,
    theme: content.theme,
    duration: content.duration,
    fromPrice: content.fromPrice,
    bestTime: content.bestTime,
    idealFor: content.idealFor,
    heroNote: content.summary,
    highlights: content.highlights,
    outline: content.days,
    inclusions: content.inclusions,
    exclusions: content.exclusions,
    places: content.places,
    knowBefore: content.knowBefore,
    faq: content.faq,
    coverImageId: content.coverImageId,
    tripType: "customised",
    ...extra,
  };
}
