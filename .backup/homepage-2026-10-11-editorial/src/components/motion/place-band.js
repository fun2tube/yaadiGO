"use client";

import { useRef } from "react";
import { LazyMotion, domAnimation, m, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useHydrated } from "./shared";

/**
 * Two lines of place names in large serif, sliding past each other in
 * opposite directions as the page scrolls — the editorial pause between the
 * two products and the departures rail.
 *
 * Tied to scroll rather than a clock: it moves only when the reader does,
 * so it is never motion for its own sake, and it costs nothing at rest.
 * Purely typographic and decorative (aria-hidden); every place named here is
 * reachable from the trips themselves.
 */
export default function PlaceBand({ places }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const hydrated = useHydrated();
  const on = hydrated && !reduced;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const forward = useTransform(scrollYProgress, [0, 1], ["-4%", "-30%"]);
  const back = useTransform(scrollYProgress, [0, 1], ["-30%", "-4%"]);

  // Enough copies that the line overruns the widest screen in both directions.
  const line = [...places, ...places, ...places];
  const half = Math.ceil(line.length / 2);
  const rows = [line, [...line.slice(half), ...line.slice(0, half)]];

  return (
    <LazyMotion features={domAnimation} strict>
      <div ref={ref} aria-hidden="true" className="overflow-hidden bg-paper py-16 sm:py-24">
        {rows.map((row, r) => (
          <m.div
            key={r}
            className="flex w-max items-baseline gap-10 whitespace-nowrap sm:gap-14"
            style={on ? { x: r === 0 ? forward : back } : { x: "-10%" }}
          >
            {row.map((place, i) => (
              <span key={i} className="flex items-baseline gap-10 sm:gap-14">
                <span
                  className={`display-light text-[56px] leading-[1.1] sm:text-[104px] lg:text-[128px] ${
                    (i + r) % 2 ? "italic text-accent-deep" : "text-paper-text"
                  }`}
                >
                  {place}
                </span>
                <span className="h-2 w-2 shrink-0 -translate-y-4 rounded-full bg-paper-line-strong sm:-translate-y-8" />
              </span>
            ))}
          </m.div>
        ))}
      </div>
    </LazyMotion>
  );
}
