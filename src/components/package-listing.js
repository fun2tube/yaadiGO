"use client";

import { useMemo, useState } from "react";
import { LazyMotion, domMax, m, AnimatePresence, useReducedMotion } from "motion/react";
import PackageCard from "./package-card";
import { packages } from "@/lib/packages";

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

export default function PackageListing({ destinations = packages }) {
  const REGIONS = ["All", ...new Set(destinations.map((p) => p.region))];
  const TAGS = ["All", ...new Set(destinations.flatMap((p) => p.idealFor))].sort();

  // The CSS layer already honours prefers-reduced-motion; the JS layer has to
  // be told. A duration of 0 keeps the layout bookkeeping (cards still end up
  // in the right place) while removing the travel that causes the problem.
  const reduced = useReducedMotion();

  const [region, setRegion] = useState("All");
  const [tag, setTag] = useState("All");
  const [sort, setSort] = useState("featured");

  const list = useMemo(() => {
    let out = destinations.filter(
      (p) =>
        (region === "All" || p.region === region) &&
        (tag === "All" || p.idealFor.includes(tag))
    );
    if (sort === "price-asc") out = [...out].sort((a, b) => a.fromPrice - b.fromPrice);
    if (sort === "price-desc") out = [...out].sort((a, b) => b.fromPrice - a.fromPrice);
    return out;
  }, [destinations, region, tag, sort]);

  return (
    <section id="packages" className="mx-auto max-w-6xl px-6 py-12 sm:px-10">
      <div data-reveal>
        <span className="eyebrow text-accent-deep">Start from a shape</span>
        <h2 className="mt-2 font-display text-[28px] font-bold tracking-tight text-paper-text sm:text-[36px]">
          {destinations.length} destinations we plan properly
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-paper-text-muted">
          None of these is a fixed package. Each one is a starting shape with the places, the
          practical warnings and an indicative cost already worked out — you tell us what to change
          and we rebuild it around your dates.
        </p>
      </div>

      {/* Filters */}
      <div className="mt-8 flex flex-col gap-3 border-b border-paper-line pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="eyebrow w-[62px] shrink-0 text-paper-text-faint">Region</span>
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

        <div className="flex flex-wrap items-center gap-3">
          <span className="eyebrow w-[62px] shrink-0 text-paper-text-faint">Good for</span>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(t)}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-all ${
                  tag === t
                    ? "border-accent bg-accent text-white"
                    : "border-paper-line-strong text-paper-text-muted hover:border-accent/50 hover:text-paper-text"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="eyebrow text-paper-text-faint">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-paper-line-strong bg-card px-3 py-1.5 text-[13px] text-paper-text"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <p className="mt-4 font-mono text-[11px] text-paper-text-faint">
        {list.length} destination{list.length === 1 ? "" : "s"}
      </p>

      {list.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-paper-line-strong p-10 text-center text-[14px] text-paper-text-muted">
          Nothing matches those filters.{" "}
          <button
            type="button"
            onClick={() => {
              setRegion("All");
              setTag("All");
            }}
            className="font-bold text-accent-deep underline"
          >
            Show everything
          </button>
        </p>
      ) : (
        /**
         * The filtered grid, animated.
         *
         * `layout` is the one thing CSS genuinely cannot do: when a filter
         * changes, every surviving card TRAVELS to its new position instead of
         * snapping there. That is not decoration — it is what makes the effect
         * of a filter legible, and it is the same mechanism the AI-driven
         * catalogue will need when Yaadi re-filters the page from chat.
         *
         * `m` + LazyMotion rather than the bare `motion` import: ~6KB instead
         * of the whole library, which matters because the audience is
         * mid-range Android and this site's argument is that it is faster than
         * its competitors.
         *
         * `domMax` rather than `domAnimation` because layout animation needs
         * it. Loaded here, on the page that uses it, not globally.
         */
        <LazyMotion features={domMax} strict>
          <m.div layout className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {list.map((pkg, i) => (
                <m.div
                  key={pkg.slug}
                  layout
                  /**
                   * `initial={false}` is not a style choice, it is a
                   * correctness one.
                   *
                   * With `initial={{ opacity: 0 }}` motion writes
                   * `style="opacity:0"` into the SERVER-RENDERED html — so
                   * every card on the destinations page was invisible until
                   * hydration finished. On a mid-range Android on 3G that is a
                   * blank grid for a noticeable beat, and with JS blocked it is
                   * a blank grid permanently. The CSS `data-reveal` system
                   * explicitly handles that case; this undid it.
                   *
                   * So the entrance stays with CSS, where it degrades safely.
                   * motion keeps the two jobs CSS cannot do: cards TRAVELLING
                   * to new positions (`layout`) and leaving without the grid
                   * jumping (`exit`).
                   */
                  initial={false}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{
                    // The house ease, imported rather than reinvented — this is
                    // `--ease-out-soft` from globals.css. One easing
                    // vocabulary, two implementations.
                    duration: reduced ? 0 : 0.42,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <PackageCard pkg={pkg} index={i} />
                </m.div>
              ))}
            </AnimatePresence>
          </m.div>
        </LazyMotion>
      )}
    </section>
  );
}
