"use client";

import Link from "next/link";
import { formatDepartureRange } from "@/lib/tours";
import { packages } from "@/lib/packages";
import { ChevronIcon, SparkleIcon, CalendarIcon } from "./icons";

/**
 * Destinations mega-panel, the way group-travel sites do it: every trip
 * reachable in one hop, grouped by the thing people actually shop by, and
 * each one showing the next real departure and price rather than just a name.
 *
 * The dates are the point. A nav that lists destinations is a sitemap; a nav
 * that says "Kashmir · 12–18 Oct · from ₹28,500 · 4 seats" is the top of a
 * booking funnel.
 */

export default function NavMegaMenu({ trips = [], onNavigate, onAskYaadi }) {
  // Themes come from the trips actually passed in, so an unpublished trip
  // cannot leave an empty column behind.
  const themeOrder = Array.from(new Set(trips.map((t) => t.theme)));
  const byTheme = themeOrder
    .map((theme) => ({ theme, trips: trips.filter((t) => t.theme === theme) }))
    .filter((group) => group.trips.length > 0);

  // Soonest bookable batches across the whole catalogue — the "leaving next"
  // rail, which is what converts browsers who have no destination in mind.
  const leavingNext = trips
    .flatMap((tour) =>
      tour.departures
        .filter((d) => d.status !== "soldout")
        .map((departure) => ({ tour, departure }))
    )
    .sort((a, b) => a.departure.start.localeCompare(b.departure.start))
    .slice(0, 4);

  return (
    <div className="grid gap-8 p-6 lg:grid-cols-[1fr_260px] lg:gap-10 lg:p-7">
      <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
        {byTheme.map((group) => (
          <div key={group.theme}>
            <span className="eyebrow text-paper-text-faint">{group.theme}</span>
            <div className="mt-3 flex flex-col gap-3">
              {group.trips.map((tour) => (
                <Link
                  key={tour.slug}
                  href={`/group-tours/${tour.slug}`}
                  onClick={onNavigate}
                  className="group/item block"
                >
                  <span className="block text-[13.5px] font-semibold text-paper-text transition-colors group-hover/item:text-accent-deep">
                    {tour.title}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10.5px] text-paper-text-faint">
                    {tour.duration} · from ₹{tour.price.toLocaleString("en-IN")}
                    {tour.region === "International" && (
                      <span className="ml-1.5 text-accent-deep">INTL</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-paper-text-muted">
                    {tour.departureCount} departure{tour.departureCount === 1 ? "" : "s"} open
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:border-l lg:border-paper-line lg:pl-8">
        <div>
          <span className="eyebrow flex items-center gap-1.5 text-accent-deep">
            <CalendarIcon size={11} /> Leaving next
          </span>
          <div className="mt-3 flex flex-col gap-2.5">
            {leavingNext.map(({ tour, departure }) => (
              <Link
                key={departure.id}
                href={`/group-tours/${tour.slug}#book`}
                onClick={onNavigate}
                className="group/next flex items-baseline justify-between gap-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold text-paper-text transition-colors group-hover/next:text-accent-deep">
                    {tour.destination.split("·")[0].trim()}
                  </span>
                  <span className="block font-mono text-[10px] text-paper-text-faint">
                    {formatDepartureRange(departure)}
                  </span>
                </span>
                <span
                  className={`shrink-0 font-mono text-[10px] ${
                    departure.status === "filling" ? "text-warn" : "text-paper-text-faint"
                  }`}
                >
                  {departure.seatsLeft} left
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <span className="eyebrow text-paper-text-faint">Customised</span>
          <p className="mt-2 text-[12px] leading-relaxed text-paper-text-muted">
            {packages.length} destinations planned around your own dates — free itinerary, no
            booking required.
          </p>
          <Link
            href="/customized-tours#packages"
            onClick={onNavigate}
            className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-bold text-accent-deep"
          >
            Browse destinations <ChevronIcon size={12} />
          </Link>
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <Link
            href="/group-tours"
            onClick={onNavigate}
            className="flex items-center justify-between gap-2 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-bold text-ink-text"
          >
            All departures <ChevronIcon size={13} />
          </Link>
          <button
            type="button"
            onClick={onAskYaadi}
            className="flex items-center gap-2 rounded-xl border border-paper-line-strong px-4 py-2.5 text-[12.5px] font-semibold text-paper-text-muted transition-colors hover:border-accent hover:text-accent-deep"
          >
            <SparkleIcon size={13} className="text-accent-deep" />
            No dates that work? Ask Yaadi
          </button>
        </div>
      </div>
    </div>
  );
}
