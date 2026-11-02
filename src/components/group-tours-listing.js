"use client";

import { useMemo, useState } from "react";
import { groupTours } from "@/lib/tours";
import TourCard from "./tour-card";

// Themes and regions are derived from what was actually passed in, so an
// unpublished trip cannot leave a filter behind that matches nothing.

export default function GroupToursListing({ tours: allTours = groupTours }) {
  const THEMES = ["All", ...new Set(allTours.map((t) => t.theme))];
  const REGIONS = ["All", ...new Set(allTours.map((t) => t.region))];

  const [theme, setTheme] = useState("All");
  const [region, setRegion] = useState("All");
  const [sort, setSort] = useState("departure");

  const tours = useMemo(() => {
    let list = allTours.filter(
      (t) =>
        (theme === "All" || t.theme === theme) && (region === "All" || t.region === region)
    );
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [allTours, theme, region, sort]);

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
      <div className="flex flex-wrap items-center gap-3 pb-4">
        <span className="eyebrow text-paper-text-faint">Region</span>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRegion(r)}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-all ${
                region === r
                  ? "border-ink bg-ink text-ink-text"
                  : "border-paper-line-strong text-paper-text-muted hover:border-ink/40 hover:text-paper-text"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-paper-line pb-6">
        <span className="eyebrow text-paper-text-faint">Theme</span>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-all ${
                theme === t
                  ? "border-accent bg-accent text-white shadow-sm shadow-accent/30"
                  : "border-paper-line-strong text-paper-text-muted hover:border-accent/50 hover:text-paper-text"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-paper-text-faint">
            Sort
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-paper-line-strong bg-card px-3 py-1.5 text-[13px] text-paper-text"
          >
            <option value="departure">Next departure</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </div>
      </div>

      <p className="mt-4 text-[13px] text-paper-text-faint">
        {tours.length} {tours.length === 1 ? "tour" : "tours"}
      </p>

      {tours.length === 0 && (
        <p className="mt-10 rounded-2xl border border-dashed border-paper-line-strong p-10 text-center text-[14px] text-paper-text-muted">
          No departures match those filters right now.{" "}
          <button
            type="button"
            onClick={() => {
              setTheme("All");
              setRegion("All");
            }}
            className="font-bold text-accent-deep underline"
          >
            Show every tour
          </button>
        </p>
      )}

      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tours.map((tour, i) => (
          <TourCard key={tour.slug} tour={tour} index={i} />
        ))}
      </div>
    </section>
  );
}
