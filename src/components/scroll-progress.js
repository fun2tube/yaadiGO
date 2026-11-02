"use client";

import { LazyMotion, domAnimation, m, useScroll, useSpring, useReducedMotion } from "motion/react";

/**
 * A hairline at the top of the page showing how far through you are.
 *
 * Earns its place on the long pages — a 12-day itinerary, a detailed
 * quotation, a trip page with inclusions and policies — where "how much more
 * of this is there" is a real question. It is the cheapest thing on the site
 * that reads as considered rather than assembled.
 *
 * Scroll-LINKED, not scroll-triggered, which is the distinction that makes it
 * feel attached to the page rather than animating at it. CSS scroll-driven
 * animations can do this now, but Safari support is still behind and this
 * audience is half iPhone.
 *
 * `scaleX` on a full-width bar rather than animating `width`: transform is
 * composited, width triggers layout on every frame. That is the difference
 * between a smooth bar and a janky one on a mid-range Android.
 */
export default function ScrollProgress() {
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();

  // A spring, lightly damped. Raw scroll progress is technically accurate and
  // feels twitchy on a trackpad; the spring makes it read as weight.
  const width = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 30,
    restDelta: 0.001,
  });

  // A bar that tracks scroll is not a vestibular trigger — it is feedback, and
  // the reduced-motion guidance is about travel, not about removing every cue.
  // But the spring overshoot is movement for its own sake, so that goes.
  const value = reduced ? scrollYProgress : width;

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        aria-hidden="true"
        style={{ scaleX: value }}
        className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-accent print:hidden"
      />
    </LazyMotion>
  );
}
