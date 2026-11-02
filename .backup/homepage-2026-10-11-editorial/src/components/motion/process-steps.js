"use client";

import { useEffect, useRef, useState } from "react";
import { LazyMotion, domAnimation, m, useReducedMotion, useScroll, useSpring } from "motion/react";
import { useHydrated } from "./shared";

/**
 * The four steps of a customized trip, set as a numbered sequence that
 * follows the reader: a hairline down the left draws itself with the scroll,
 * and whichever step is crossing the middle of the screen lights up — its
 * outlined numeral fills, its text comes to full strength.
 *
 * Every step is fully readable in the server HTML; the "active" state only
 * dims the others a little, and is never applied without JavaScript or under
 * reduced motion.
 *
 * `steps` items: { n, title: node, detail: node, note }.
 */
export default function ProcessSteps({ steps }) {
  const ref = useRef(null);
  const rows = useRef([]);
  const reduced = useReducedMotion();
  const hydrated = useHydrated();
  const on = hydrated && !reduced;
  const [active, setActive] = useState(-1);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 60%", "end 60%"] });
  const line = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });

  // One observer, a thin band across the middle of the viewport: the row
  // inside that band is the active one.
  useEffect(() => {
    if (!on) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number(entry.target.dataset.step));
        }
      },
      { rootMargin: "-48% 0px -48% 0px" }
    );
    rows.current.forEach((row) => row && io.observe(row));
    return () => io.disconnect();
  }, [on]);

  return (
    <LazyMotion features={domAnimation} strict>
      <ol ref={ref} className="relative">
        <span aria-hidden="true" className="absolute bottom-0 left-0 top-0 w-px bg-ink-line" />
        {on && (
          <m.span
            aria-hidden="true"
            className="absolute bottom-0 left-0 top-0 w-px origin-top bg-accent-bright"
            style={{ scaleY: line }}
          />
        )}

        {steps.map((step, i) => {
          const lit = !on || active === -1 || active === i;
          return (
            <li
              key={step.n}
              ref={(el) => (rows.current[i] = el)}
              data-step={i}
              data-reveal="soft"
              className="relative grid grid-cols-[auto_1fr] gap-x-6 py-12 pl-8 sm:gap-x-10 sm:pl-12 sm:py-16"
            >
              <span
                aria-hidden="true"
                className={`display-light text-[64px] leading-[0.85] transition-[color,-webkit-text-stroke-color] duration-700 sm:text-[96px] ${
                  active === i
                    ? "text-accent-bright [-webkit-text-stroke:1px_var(--color-accent-bright)]"
                    : "text-transparent [-webkit-text-stroke:1px_var(--color-ink-text-faint)]"
                }`}
              >
                {String(step.n).padStart(2, "0")}
              </span>

              <div className={`min-w-0 transition-opacity duration-700 ${lit ? "opacity-100" : "opacity-45"}`}>
                <span className="eyebrow text-accent-bright">{step.note}</span>
                <div className="mt-3 font-display text-[26px] font-light leading-[1.1] tracking-[-0.02em] text-ink-text sm:text-[36px]">
                  {step.title}
                </div>
                <div className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-text-muted">
                  {step.detail}
                </div>
              </div>

              {i < steps.length - 1 && (
                <span aria-hidden="true" className="absolute bottom-0 left-8 right-0 h-px bg-ink-line sm:left-12" />
              )}
            </li>
          );
        })}
      </ol>
    </LazyMotion>
  );
}
