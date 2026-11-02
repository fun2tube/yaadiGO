"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { ArrowIcon } from "../icons";

const formatINR = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const SHOWN = 8;
const EASE = [0.22, 1, 0.36, 1];

/**
 * Customized trip ideas, filtered by occasion.
 *
 * Occasions, not regions, because that is how a family or a couple starts
 * thinking: "something for our honeymoon", not "something in the south".
 * Each idea carries the occasion keys it belongs to, computed on the server
 * from `idealFor`, `theme` and `region` — so a new trip in the data appears
 * under the right chips with no change here.
 *
 * Set as an index rather than a row of pills: occasions are words with a
 * count beside them, the chosen one underlined. Cards are photograph and
 * type, no box — the grid reads as a magazine spread.
 *
 * The grid is keyed on the active filter, so a change cross-fades the whole
 * set with a short stagger instead of cards jumping around.
 */
export default function TripIdeas({ ideas, occasions, allHref, allLabel }) {
  const [active, setActive] = useState("all");
  const reduced = useReducedMotion();
  const shown = ideas.filter((idea) => active === "all" || idea.occasions.includes(active));

  return (
    <LazyMotion features={domAnimation} strict>
      <div
        role="tablist"
        aria-label="Filter trip ideas by occasion"
        className="mt-14 flex gap-x-8 gap-y-3 overflow-x-auto border-b border-paper-line pb-0 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden"
      >
        {occasions.map((o) => {
          const on = o.key === active;
          return (
            <button
              key={o.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(o.key)}
              className={`relative -mb-px flex shrink-0 items-start gap-1.5 border-b py-4 font-display text-[19px] transition-colors duration-500 ${
                on
                  ? "border-paper-text text-paper-text"
                  : "border-transparent text-paper-text-faint hover:text-paper-text"
              }`}
            >
              <span className={on ? "italic" : ""}>{o.label}</span>
              <sup className="mt-1 font-mono text-[10px] tabular-nums">{String(o.count).padStart(2, "0")}</sup>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={active}
          className="mt-12 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-4"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.25 } }}
        >
          {shown.slice(0, SHOWN).map((idea, i) => (
            <m.div
              key={idea.slug}
              initial={reduced ? false : { opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: EASE, delay: Math.min(i, 7) * 0.07 }}
              // A gentle stagger in height so the grid reads as a layout,
              // not a spreadsheet. Desktop only — on a phone it is one column.
              className={i % 4 === 1 || i % 4 === 3 ? "lg:mt-16" : ""}
            >
              <Link href={idea.href} data-cursor="Explore" className="group flex h-full flex-col">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[3px] bg-paper-dim">
                  <Image
                    src={idea.src}
                    alt={idea.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-[1800ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
                  />
                  <span className="absolute left-3 top-3 bg-paper/90 px-2.5 py-1 eyebrow text-[10px] text-paper-text backdrop-blur-sm">
                    {idea.duration}
                  </span>
                </div>
                <span className="mt-5 eyebrow text-paper-text-faint">{idea.destination}</span>
                <h3 className="mt-2 font-display text-[23px] font-normal leading-[1.15] tracking-[-0.01em] text-paper-text">
                  {idea.title}
                </h3>
                <p className="mt-1.5 text-[13px] text-paper-text-muted">
                  For {idea.idealFor.slice(0, 2).join(" · ").toLowerCase()}
                </p>
                <div className="mt-auto pt-4">
                  <div className="flex items-center justify-between border-t border-paper-line pt-3.5">
                    <span className="text-[12.5px] text-paper-text-muted">
                      from <span className="font-display text-[17px] text-paper-text">{formatINR(idea.price)}</span>
                    </span>
                    <ArrowIcon className="text-paper-text-faint transition-all duration-700 group-hover:translate-x-1 group-hover:text-accent-deep" />
                  </div>
                </div>
              </Link>
            </m.div>
          ))}
        </m.div>
      </AnimatePresence>

      <div className="mt-20 flex justify-center">
        <Link href={allHref} className="link-editorial text-[15px] font-semibold text-paper-text">
          {allLabel}
          <ArrowIcon />
        </Link>
      </div>
    </LazyMotion>
  );
}
