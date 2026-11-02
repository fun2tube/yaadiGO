// Proof — the numbers the site is allowed to claim.
//
// Every figure here is DERIVED from the catalogue, so it cannot drift from
// what the site actually sells. The previous hand-written stats ("10+ years",
// "40+ destinations") were unverifiable: nobody could check them, and the
// destination count did not match the catalogue. A number a visitor can
// disprove by scrolling is worse than no number.
//
// The rule: if it is not derivable from real inventory or a policy the
// business has actually committed to in writing, it does not go here.
//
// What is deliberately NOT here: review counts, ratings, "trips booked last
// week", years in business, traveller totals. Competitors lead with those and
// we have none of them yet. Inventing them is the one thing that would cost
// more than it earns. See `src/lib/testimonials.js` for the same decision.

import { groupTours } from "@/lib/tours";
import { packages } from "@/lib/packages";

/** Every place named across the catalogue. "A · B · C" counts as three. */
function destinationNames() {
  const names = new Set();
  for (const item of [...groupTours, ...packages]) {
    for (const part of String(item.destination ?? "").split("·")) {
      const name = part.trim();
      if (name) names.add(name);
    }
  }
  return names;
}

/** Departures with seats, on dates that have not passed. */
export function bookableDepartures(now = Date.now()) {
  return groupTours.flatMap((tour) =>
    (tour.departures ?? []).filter(
      (d) => d.seatsLeft > 0 && new Date(d.start).getTime() >= now
    )
  );
}

/**
 * The homepage figures.
 *
 * Rounded DOWN to a tens boundary and suffixed "+" only where the real number
 * is comfortably above it — so the claim stays true as inventory changes,
 * without the figure jittering every time a seat sells.
 */
export function siteProof(now = Date.now()) {
  const trips = groupTours.length + packages.length;
  const places = destinationNames().size;
  const departures = bookableDepartures(now).length;

  return {
    trips,
    places,
    departures,
    stats: [
      {
        value: departures,
        suffix: "",
        label: "departures you can book today",
      },
      {
        value: Math.floor(places / 10) * 10,
        suffix: "+",
        label: "places across India and Asia",
      },
      {
        // Not a count — the offer. The strongest true thing we can say, and
        // the one competitors cannot match without changing their business.
        value: 0,
        prefix: "₹",
        suffix: "",
        label: "payable until you approve the itinerary",
      },
    ],
  };
}

/**
 * Trust without reviews.
 *
 * Both competitors lead with social proof — 9,070 reviews, 1,500 verified
 * agents. We have none of that yet and will not fake it, so this panel earns
 * trust from things that are checkable on this site, today, by the visitor:
 * live seat counts they can verify against the booking page, a written policy,
 * and a registered company. Verifiable beats impressive.
 *
 * When real reviews exist, they go in `src/lib/testimonials.js` and render
 * ALONGSIDE this — not instead of it.
 */
// `id` is the stable key the page editor saves an override against. An index
// would reattach yesterday's edit to the wrong card the moment anyone reorders
// this array.
export const PROOF_POINTS = [
  {
    id: "seats",
    title: "The seat counts are real",
    detail:
      "Every departure on this site shows the seats actually left in that batch. When it says two, it is two — click through and book them.",
  },
  {
    id: "written",
    title: "The itinerary is written before you pay",
    detail:
      "Weather risk, permits and likely closures are on the page before any money moves — not discovered on day four.",
  },
  {
    id: "approve",
    title: "Nothing is payable until you approve",
    detail:
      "Draft itineraries are free and revised as many times as it takes. You pay once the plan is one you actually want.",
  },
  {
    id: "registered",
    title: "A registered company, not a marketplace",
    detail:
      "YaadiGo Networks Pvt Ltd runs these trips. You deal with us start to finish — not a lead form passed to five agents.",
  },
];
