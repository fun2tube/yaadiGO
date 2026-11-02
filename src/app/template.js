"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";

/**
 * Has the visitor navigated yet, within this page session?
 *
 * MODULE scope, deliberately. A template REMOUNTS on every navigation, so
 * component state resets each time and could never tell "first paint" from
 * "third page". This survives those remounts and resets on a full reload,
 * which is exactly the lifetime needed.
 *
 * Why it matters: with `initial={{ opacity: 0 }}` motion writes
 * `style="opacity:0;transform:translateY(10px)"` into the SERVER-RENDERED
 * html — so **every page on the site was invisible until hydration**, and
 * permanently invisible with JS blocked. The same fault I had already found
 * and documented on the destinations grid, repeated here on a surface a
 * hundred times larger: not twenty cards, but all content on all pages.
 *
 * The first paint therefore renders plainly, with the CSS reveal system doing
 * the entrance as it always has. The route transition applies only to
 * navigations, which is the only place it was ever needed.
 */
let hasNavigated = false;

/**
 * The transition between pages.
 *
 * Why this exists: the first two motion pieces built — the filtering catalogue
 * and the streaming itinerary — are both correct and both **invisible unless
 * you interact**. One needs a filter changed, the other needs an itinerary
 * generated. Someone simply browsing the site saw no motion at all, which was
 * a fair complaint: "modern" is mostly what you feel on arrival and between
 * pages, not what you unlock by clicking.
 *
 * `template.js` rather than `layout.js` is the whole trick: Next re-mounts a
 * template on every navigation and keeps a layout mounted. So this is the one
 * hook in the App Router that fires per route change.
 *
 * `domAnimation`, NOT `domMax` — this needs opacity and transform, not layout
 * projection or drag, so it costs roughly a sixth of what the catalogue does.
 * That matters because this one loads on EVERY route including the homepage,
 * which the motion plan says must stay light.
 *
 * The public site gets a 250ms fade on navigation (CSS, so it finishes even
 * in a background tab). It once had a dramatic ink curtain; that was removed
 * on 2026-10-11 with the rest of the decorative motion.
 *
 * The admin keeps the old 10px / 320ms fade. A desk working leads between
 * calls switches screens dozens of times an hour; a curtain there is a tax.
 */
export default function Template({ children }) {
  const reduced = useReducedMotion();
  const pathname = usePathname() ?? "";
  const admin = pathname.startsWith("/admin");

  // Read BEFORE the effect sets it, so the first paint sees false.
  const animate = hasNavigated;

  useEffect(() => {
    hasNavigated = true;
  }, []);

  // No wrapper at all when motion is off — not a zero-duration animation.
  // An extra div around every page is worth avoiding when it buys nothing.
  if (reduced) return children;

  if (admin) {
    return (
      <LazyMotion features={domAnimation} strict>
        <m.div
          initial={animate ? { opacity: 0, y: 10 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </m.div>
      </LazyMotion>
    );
  }

  // CSS animations, not motion, for the public branch: they are time-based,
  // so a navigation that happens in a background tab still finishes. A
  // rAF-driven curtain stays parked over the page until the tab is focused.
  if (!animate) return children;

  // A short fade, nothing more (2026-10-11). The ink curtain that used to
  // sweep across every navigation was removed with the other decorative
  // motion: a visitor moving between pages wants the next page, not a show.
  return <div className="animate-page-in">{children}</div>;
}
