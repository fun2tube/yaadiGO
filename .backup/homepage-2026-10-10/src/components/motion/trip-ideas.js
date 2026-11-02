"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { ChevronIcon } from "../icons";
import { EASE_OUT_SOFT } from "./shared";

const formatINR = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const SHOWN = 8;

/**
 * Customized trip ideas, filtered by occasion.
 *
 * Occasions, not regions, because that is how a family or a couple starts
 * thinking: "something for our honeymoon", not "something in the south".
 * Each idea carries the occasion keys it belongs to, computed on the server
 * from `idealFor`, `theme` and `region` — so a new trip in the data appears
 * under the right chips with no change here.
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
        className="mt-8 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden"
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
              className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-[13.5px] font-semibold transition-all duration-300 ${
                on
                  ? "border-ink bg-ink text-ink-text"
                  : "border-paper-line-strong text-paper-text-muted hover:border-paper-text hover:text-paper-text"
              }`}
            >
              {o.label}
              <span
                className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                  on ? "bg-white/15" : "bg-paper-dim"
                }`}
              >
                {o.count}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={active}
          className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.15 } }}
        >
          {shown.slice(0, SHOWN).map((idea, i) => (
            <m.div
              key={idea.slug}
              initial={reduced ? false : { opacity: 0, y: 28, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.55, ease: EASE_OUT_SOFT, delay: Math.min(i, 7) * 0.05 }}
            >
              <Link
                href={idea.href}
                className="group flex h-full flex-col overflow-hidden rounded-3xl border border-paper-line bg-card transition-all duration-500 hover:-translate-y-1 hover:border-accent/40 hover:shadow-2xl hover:shadow-ink/10"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-paper-dim">
                  <Image
                    src={idea.src}
                    alt={idea.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11.5px] font-bold text-paper-text">
                    {idea.duration}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <span className="eyebrow text-paper-text-faint">{idea.destination}</span>
                  <h3 className="mt-1.5 font-display text-[19px] font-bold leading-snug text-paper-text">
                    {idea.title}
                  </h3>
                  <p className="mt-1.5 text-[12.5px] text-paper-text-muted">
                    Ideal for {idea.idealFor.slice(0, 2).join(" · ").toLowerCase()}
                  </p>
                  <div className="mt-auto flex items-end justify-between pt-4">
                    <span className="text-[12.5px] text-paper-text-muted">
                      from{" "}
                      <span className="font-display text-[18px] font-bold text-paper-text">
                        {formatINR(idea.price)}
                      </span>
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-paper-line-strong text-paper-text transition-all duration-500 group-hover:-rotate-45 group-hover:border-accent group-hover:bg-accent group-hover:text-white">
                      <ChevronIcon size={14} />
                    </span>
                  </div>
                </div>
              </Link>
            </m.div>
          ))}
        </m.div>
      </AnimatePresence>

      <div className="mt-8 flex justify-center">
        <Link
          href={allHref}
          className="group flex items-center gap-2 rounded-full border border-paper-line-strong px-6 py-3.5 text-[14px] font-bold text-paper-text transition-colors hover:border-ink hover:bg-ink hover:text-ink-text"
        >
          {allLabel}
          <ChevronIcon size={14} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </LazyMotion>
  );
}
