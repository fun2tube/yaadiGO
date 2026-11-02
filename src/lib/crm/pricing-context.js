import "server-only";

import { getTrips, getDestinations } from "@/lib/cms/catalogue";

/**
 * Real prices, handed to the model before it quotes.
 *
 * This is the single biggest quality change available to the AI quotation
 * builder, and it costs almost nothing.
 *
 * Without it, the model prices a Kerala trip from whatever it absorbed during
 * training: a global average, years stale, with no idea what YOUR business
 * charges or what your suppliers cost. The output is plausible and wrong, and
 * plausible-and-wrong is the worst possible failure mode here, because a
 * salesperson skim-reading a confident number sends it.
 *
 * With it, the model is anchored to trips this business actually operates at
 * prices it actually charges. It is the difference between "invent a number
 * for Kerala" and "we sell 7 nights in Kerala from ₹42,000 per person — price
 * this one consistently with that."
 *
 * Grounding is not the same as accuracy. The model can still be wrong about a
 * line it has no anchor for, which is why every line still carries a
 * confidence flag and a human still sends it.
 */

/** Rough seasonal bands for Indian travel. Coarse on purpose — a model does not need a calendar, it needs a nudge. */
const SEASONS = [
  { months: [12, 1], label: "Peak (Christmas / New Year) — expect 25–40% above base" },
  { months: [4, 5, 6], label: "Peak (summer holidays) — expect 15–30% above base for hill stations" },
  { months: [10, 11], label: "High (post-monsoon) — expect 10–20% above base" },
  { months: [7, 8, 9], label: "Low (monsoon) — expect 10–25% below base outside Kerala and Ladakh" },
  { months: [2, 3], label: "Shoulder — base rates apply" },
];

function seasonFor(monthName) {
  if (!monthName) return null;
  const index = new Date(`${monthName} 1, 2027`).getMonth();
  if (Number.isNaN(index)) return null;
  return SEASONS.find((s) => s.months.includes(index + 1))?.label ?? null;
}

/**
 * Build the reference block.
 *
 * Deliberately small. Feeding the whole catalogue would bury the two or three
 * comparable trips in forty irrelevant ones, and a long context makes a small
 * model worse at this, not better.
 */
export async function buildPricingContext({ destination, month } = {}) {
  const [trips, destinations] = await Promise.all([getTrips(), getDestinations()]);

  const needle = String(destination ?? "").toLowerCase();

  const scored = (item, haystack) => {
    if (!needle) return 0;
    const text = haystack.toLowerCase();
    if (text.includes(needle)) return 2;
    // A single shared word is a weak but real signal — "Kerala backwaters"
    // should still match a "Kerala" package.
    return needle.split(/\s+/).some((word) => word.length > 3 && text.includes(word)) ? 1 : 0;
  };

  const relevantTrips = trips
    .map((t) => ({ t, score: scored(t, `${t.title} ${t.destination} ${t.region}`) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ t }) => ({
      title: t.title,
      places: t.destination,
      nights: t.duration,
      fromPerPerson: t.price,
      advance: t.advanceAmount,
      groupSize: t.groupSize,
      inclusions: (t.inclusions ?? []).slice(0, 5),
    }));

  const relevantDestinations = destinations
    .map((d) => ({ d, score: scored(d, `${d.title} ${d.destination} ${d.region}`) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ d }) => ({
      title: d.title,
      places: d.destination,
      typicalLength: d.duration,
      fromPerPerson: d.fromPrice,
      bestTime: d.bestTime,
    }));

  // When nothing matches, give a general price ladder rather than nothing at
  // all — a floor and a ceiling still beat an unanchored guess.
  const ladder =
    relevantTrips.length === 0 && relevantDestinations.length === 0
      ? trips
          .slice(0, 6)
          .map((t) => `${t.destination}: from ₹${t.price.toLocaleString("en-IN")} pp`)
      : [];

  return {
    trips: relevantTrips,
    destinations: relevantDestinations,
    ladder,
    season: seasonFor(month),
    hasAnchor: relevantTrips.length > 0 || relevantDestinations.length > 0,
  };
}

/** Render it for a prompt. Plain text beats JSON for a model reading prices. */
export function renderPricingContext(context) {
  if (!context) return "";
  const lines = [];

  if (context.trips.length > 0) {
    lines.push("## What we already charge for comparable fixed departures");
    for (const t of context.trips) {
      lines.push(
        `- ${t.title} (${t.places}) — ${t.nights}, from ₹${t.fromPerPerson.toLocaleString(
          "en-IN"
        )} per person, ₹${t.advance.toLocaleString("en-IN")} advance, ${t.groupSize}.`
      );
      if (t.inclusions.length) lines.push(`  Includes: ${t.inclusions.join("; ")}`);
    }
  }

  if (context.destinations.length > 0) {
    lines.push("", "## Our customised trips to this region");
    for (const d of context.destinations) {
      lines.push(
        `- ${d.title} (${d.places}) — typically ${d.typicalLength}, from ₹${d.fromPerPerson.toLocaleString(
          "en-IN"
        )} per person. Best time: ${d.bestTime}.`
      );
    }
  }

  if (context.ladder.length > 0) {
    lines.push(
      "",
      "## We have nothing directly comparable. For scale, our current range:",
      ...context.ladder.map((l) => `- ${l}`)
    );
  }

  if (context.season) lines.push("", `## Season for these dates`, context.season);

  if (lines.length > 0) {
    lines.push(
      "",
      "Price consistently with the above. A quotation that lands far outside this range without a stated reason is wrong, and the salesperson has to justify it to a customer who has already seen our website."
    );
  }

  return lines.join("\n");
}
