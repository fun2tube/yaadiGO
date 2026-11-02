# Homepage — premium redesign

**Date:** 2026-10-10 · **Roles:** CTO → UI/UX → PM · **Status:** built, reviewed
(`docs/reviews/2026-10-10-homepage-premium.md`)
**Asked for:** "Not happy with the homepage design and motions and animations —
it does not look rich and premium. Think something premium and redesign it."

Scope: the **visual and motion layer** of `/` only. The content plan approved
the same day (`homepage-content-strategy.md`) is unchanged — same sections,
same order, same copy, same CMS ids, same live data, same Puck override path.

---

## 1 · Why the previous page read as "busy", not "premium" (UI/UX)

| Signal | What it was | Why it cheapened the page |
|---|---|---|
| Type | Fraunces **900** on every heading | Heavy display weight reads retail/promotional. Luxury travel (Aman, Belmond, Black Tomato) sets light serif large, with italic for emphasis. |
| Density | Hero: pill + headline + lede + 3 CTAs + 3 stats + caption + 5 bars + scroll cue | Ten things competing on the first screen. Premium = few things, lots of air. |
| Shape | 28–32px radii, pill chips, boxed cards with borders and shadows | App/SaaS vocabulary, not editorial. |
| Motion | Magnetic buttons, velocity skew, spring overshoot, rotating word-rise | Quick and springy reads as playful. Nothing gave the scroll itself weight. |

## 2 · Direction — "quiet luxury, editorial"

- **Type:** Fraunces **300** at 88–128px desktop, `-0.035em` tracking;
  `*asterisked*` words in italic 300. Mono eyebrows kept, now numbered
  `(01) — Two ways to travel` like a contents list.
- **Colour:** tokens unchanged; no gradients. Clay is now used for marks and
  italics, not for big filled buttons. Primary CTA is bone on ink.
- **Shape:** 3px image corners, hairlines (`border-*-line`) instead of boxes,
  pill buttons kept but quieter. 1400px max width, 12-column grid, asymmetry
  (second "way" column dropped 192px; trip grid staggered).
- **Motion vocabulary** — slow, weighted, one axis at a time:

| Motion | Where | How |
|---|---|---|
| Inertial scroll | whole page, **fine pointer only** | Lenis 1.3.26 (`motion/smooth-scroll.js`), off on touch and reduced motion |
| Window-to-full-bleed open | hero photo on load | CSS `hero-open` clip + `hero-settle` scale — plays from server HTML |
| Masked word rise | every section heading | `EditorialHeading`, `[data-reveal="words"]`, 1.3s editorial ease |
| Curtain wipe | way photos, journal photos | `[data-reveal="wipe"]`: clip from bottom + inner 1.28→1 scale |
| Opposed type band | between "ways" and departures | `PlaceBand`, scroll-linked x, never clock-driven |
| Gallery walk | departures | pinned horizontal rail kept; skew removed; photo drift kept |
| Lit step | "how it works" | `ProcessSteps`: scroll-drawn hairline; the step crossing mid-screen fills its outline numeral |
| Context cursor | cards and photos | `CursorLabel`: "View / Explore / Read" disc **beside** the native cursor |
| Label roll, underline redraw | buttons, text links | CSS only |

**Removed:** `Magnetic`, velocity skew, `StackCards` (file deleted; backup in
`.backup/homepage-2026-10-10/`).

## 3 · Engineering rules (CTO) — unchanged and followed

- Nothing hidden in server HTML by motion: hero entrance is CSS; scroll-linked
  hidden-at-rest styles gated on `useHydrated()`.
- `LazyMotion` + `m` + `domAnimation` only; transform/opacity/clip-path only.
- Reduced motion: every new reveal variant is listed in the reduced-motion
  block; Lenis, cursor and step highlighting do not start.
- New: a `<noscript>` stylesheet in the root layout shows every
  `[data-reveal]` element when JavaScript does not run (site-wide gap found in
  review; predates this work).
- `EditorialHeading` honours the override store (text, hidden, style) and
  writes `data-cms-source` so the inline editor edits the raw text with its
  asterisks.

## 4 · Acceptance criteria (PM)

1. Desktop 1440×900: hero shows light serif headline with italic second
   clause, two CTAs + one text link, three stats, slide credit. ✅
2. Phone 375×812: all three hero CTAs above the bottom bar; no horizontal
   scroll (`scrollWidth === 375`). ✅
3. "See upcoming departures" lands on `#departures` with Lenis on. ✅ (3401/3402px)
4. Occasion filter changes the grid; cursor disc reads "Explore" over a card. ✅
5. No console errors or hydration warnings. ✅
6. `vitest run` green; `next build` succeeds. ✅ (364 tests; build after fixing a pre-existing type error)
7. Smooth scroll is off on touch. ✅ (`html.lenis` absent at 375px)
8. Reduced motion and mid-range Android — **not verified**, see backlog #129 / #118.

## 5 · Cost

| Item | Size |
|---|---|
| Homepage client chunk incl. Lenis, cursor, steps, band | 12.6 KB gz |
| Fraunces italic 300 (latin) | +41.8 KB — narrowed from 81.5 KB by requesting one italic weight |
| Fraunces roman 300–900 | 67.3 KB — same file size as the old 500–900 |
