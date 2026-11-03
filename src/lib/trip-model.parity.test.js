import { describe, it, expect } from "vitest";
import { groupTours } from "@/lib/tours";
import { packages } from "@/lib/packages";
import { contentFromTour, contentFromPackage, tourFromContent, packageFromContent } from "@/lib/trip-model";

/**
 * Every trip that started life in code survives the move into the database
 * unchanged: code → TripContentSchema → what the pages render.
 *
 * Written 2026-11-03 before moving the 34 coded trips into the `trips`
 * table. It found four group tours (Himachal Monsoon, Vietnam, Bali,
 * Thailand) the schema refused outright, because a "land only" joining
 * point is a discount and the schema allowed only additions; those four
 * could not even be opened in the trip editor.
 *
 * Day numbers come back as text ("1"), by design: a day can be "1–2". Every
 * page prints them the same way, so they are compared as text.
 */

// Derived at render time from departures and admin state, not trip content.
const DERIVED = new Set(["departures", "price", "nextDeparture", "seatsLeft", "departureCount", "status", "published", "edited"]);
const normalise = (key, value) =>
  key === "itinerary" || key === "outline"
    ? JSON.stringify((value ?? []).map((d) => ({ ...d, day: String(d.day) })))
    : JSON.stringify(value);

describe("coded trips survive the move into the database", () => {
  it.each(groupTours.map((t) => [t.slug, t]))("group tour %s", (_slug, tour) => {
    const back = tourFromContent(tour.slug, contentFromTour(tour), tour.departures);
    for (const key of Object.keys(tour)) {
      if (DERIVED.has(key)) continue;
      expect(normalise(key, back[key]), key).toBe(normalise(key, tour[key]));
    }
  });

  it.each(packages.map((p) => [p.slug, p]))("customized trip %s", (_slug, pkg) => {
    const back = packageFromContent(pkg.slug, contentFromPackage(pkg));
    for (const key of Object.keys(pkg)) {
      expect(normalise(key, back[key]), key).toBe(normalise(key, pkg[key]));
    }
  });
});
