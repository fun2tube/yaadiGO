"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { ArrowIcon } from "../icons";

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
 * Plain pills with a count, plain cards. The grid is keyed on the active
 * filter, so a change cross-fades the set instead of cards jumping around.
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
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-[14.5px] font-semibold transition-colors ${
                on
                  ? "bg-ink text-ink-text"
                  : "bg-white text-paper-text ring-1 ring-paper-line-strong hover:ring-paper-text"
              }`}
            >
              {o.label}
              <span className={`text-[12.5px] tabular-nums ${on ? "text-ink-text-muted" : "text-paper-text-faint"}`}>
                {o.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Keyed on the filter: a change cross-fades the set, so the visitor
          sees that their choice did something. That is the only motion. */}
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={active}
          className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? undefined : { opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {shown.slice(0, SHOWN).map((idea) => (
            <Link
              key={idea.slug}
              href={idea.href}
              className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-paper-line transition-shadow hover:shadow-[0_20px_50px_-28px_rgb(26_25_23/0.35)]"
            >
              <div className="relative aspect-[4/3] bg-paper-dim">
                <Image
                  src={idea.src}
                  alt={idea.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover"
                />
                <span className="absolute left-3 top-3 rounded-lg bg-white px-2.5 py-1 text-[12.5px] font-bold text-paper-text shadow-sm">
                  {idea.duration}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <span className="text-[13px] font-medium text-paper-text-muted">{idea.destination}</span>
                <h3 className="mt-1 text-[17px] font-bold leading-snug text-paper-text group-hover:text-accent-deep">
                  {idea.title}
                </h3>
                {idea.idealFor.length > 0 && (
                  <p className="mt-1 text-[13.5px] text-paper-text-muted">
                    Great for {idea.idealFor.slice(0, 2).join(" & ").toLowerCase()}
                  </p>
                )}
                <p className="mt-auto pt-4 text-[14px] text-paper-text-muted">
                  from <span className="text-[18px] font-extrabold text-paper-text">{formatINR(idea.price)}</span> /person
                </p>
              </div>
            </Link>
          ))}
        </m.div>
      </AnimatePresence>

      <div className="mt-10 flex justify-center">
        <Link
          href={allHref}
          className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-bold text-paper-text ring-1 ring-paper-line-strong transition-colors hover:bg-ink hover:text-ink-text hover:ring-ink"
        >
          {allLabel} <ArrowIcon size={16} />
        </Link>
      </div>
    </LazyMotion>
  );
}
