# Motion — what to animate, and what to leave alone

**Date:** 2026-10-01 · **Role:** UI/UX
**Library:** `motion` v13 (the package formerly published as `framer-motion`;
both names now resolve to the same version)

## Addendum 2026-10-10 — premium, not busy

The owner found the 10-09 motion "not rich and premium". The voice is now
slow and weighted rather than springy: inertial scroll (Lenis, desktop only),
curtain wipes, masked word rises, a scroll-lit step sequence and a context
cursor. Magnetic buttons, velocity skew and `StackCards` are gone. Details and
measurements: `docs/design/homepage-premium.md`.

## Addendum 2026-10-09 — the voice changed

The owner asked for a dramatic, image-led site: "great framer motions,
transformation motions, dramatic transitions … on scroll". That supersedes the
**voice** rules below ("calm, deliberate", no letter reveals, no 3D tilt, no
page splash). It does **not** supersede the engineering rules: rule 0 (nothing
hidden in server HTML), `LazyMotion`/`m`, transform and opacity only,
reduced motion, and measure on a real phone all still apply and were followed.

What exists now is in `src/components/motion/` and is described in
`docs/reviews/2026-10-09-motion-redesign.md`. Two lessons from building it,
both now encoded in code:

- **Range-mapped scroll values on `opacity`/`clip-path` are accelerated by
  motion v13 onto native ScrollTimeline, with offsets captured once.** Anything
  below a section that changes height after mount fires at the wrong place. Use
  `useLiveTransform()` from `motion/shared.js` for those properties.
- **Chrome's IntersectionObserver honours the target's own `clip-path`.** Never
  clip the element `Reveal` observes; clip its child.

Read the rest of this document as history plus the rules that still hold.

## The finding that shapes everything below

**This site already has a good motion system, and most of it should not be
replaced.**

What exists, and it is better than most:

- `Reveal` drives every `[data-reveal]` element with **one** IntersectionObserver,
  unobserves each after it fires, clears `will-change` on `transitionend`, and
  picks up streamed content with a MutationObserver.
- Two easing tokens that already define a house feel —
  `--ease-out-soft: cubic-bezier(0.16, 1, 0.3, 1)` and `--ease-spring`.
- `NeuralField` stops its loop out of view and on tab hide, clamps DPR to 2 and
  scales node count to area.
- `prefers-reduced-motion` handled thoughtfully: movement stripped, **opacity
  kept**, with a comment explaining that a fully static page reads as broken.

Framer's `whileInView` would replace that one shared observer with a motion
component per element. **That is a downgrade**, and it is the single most common
way adding this library makes a site slower rather than smarter.

So: **selective adoption.** `motion` goes in only where it does something CSS
genuinely cannot. CSS stays the default.

---

## The brand question, before the technical one

Motion is a voice. The positioning is *"the whole trip, written down before you
pay a rupee"* — honesty, specificity, calm competence. The visual system is flat
colour, hairline rules, no gradients anywhere.

**So the motion language is: calm, deliberate, weighty. Not bouncy, not
playful, not AI-sparkle.** A competent person telling you the truth, not a
startup being excited at you.

In practice:

| Do | Don't |
|---|---|
| 400–750ms on content, one axis, short distance | Spring overshoot on anything carrying information |
| Reuse `--ease-out-soft` — the house ease already exists | Invent a second easing vocabulary in JS |
| Animate to **reveal information** | Animate to decorate |
| `--ease-spring` only on small UI feedback (a toggle, a tap) | Letter-by-letter text reveals — reads as a portfolio site |
| Motion the eye can follow | 3D tilt cards (dated, and wrong on touch) |

Framer config must import the house ease rather than redefining it:
`transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}`.

---

## Tier 1 — where `motion` genuinely earns its weight

These are impossible or miserable in CSS. Each one is worth the bytes.

### 1 · The filtering catalogue — `layout`

**The highest-value motion on the site.** When Yaadi filters the grid ("Ladakh
under 40k in June"), cards currently snap to new positions. With `layout` they
travel there.

This matters beyond polish: it is what makes **the AI's effect on the page
legible**. You watch the catalogue respond to what you said. It is the whole
premise of the answer-engine plan made visible, and CSS cannot do FLIP.

Paired with `AnimatePresence` so removed cards fade and shrink out rather than
vanishing and dropping everything below them upward.

### 2 · The itinerary writing itself — `AnimatePresence`

Days already stream in. What is missing is that each arrival **reflows the stack
smoothly** instead of jolting it, and the next day's skeleton can pulse in place
(the `placeholder-pulse` keyframe already exists).

This is the moment the UI/UX plan identifies as the one that earns a phone
number. It should be the most carefully animated thing on the site.

### 3 · Trip card → trip page — `layoutId`

The card's image and title **morph** into the detail page hero. One shared
element, two routes.

This is the single biggest "premium brand" signal available and it is flatly
impossible without a layout-animation library. Neither Pickyourtrail nor
TripClap does it.

### 4 · Prices that change — animated digits

When a filter changes a "from ₹" figure, the digits roll rather than swap. Tiny,
and exactly the sort of detail that reads as expensive. `CountUp` already does
this on mount; this extends it to **value changes**.

### 5 · Drag with velocity — quotation templates, trip galleries

`drag` with momentum and a spring settle, instead of scroll-snap. Reads as a
native app rather than a web page, which is the bar on a phone.

## Tier 2 — scroll-linked, used sparingly

### 6 · `useScroll` parallax on the hero field

The `NeuralField` is currently static relative to scroll. A **small**, one-axis
offset tied to scroll progress gives the hero depth. Small: 30–60px over the
whole panel, not a theme-park ride.

### 7 · Reading progress on long pages

A hairline bar tied to scroll progress on trip detail and quotation pages. Reads
as considered, and genuinely helps on a 12-day itinerary.

## Tier 3 — explicitly not doing

- **Not** replacing `data-reveal`. The shared observer is better than
  `whileInView`.
- **Not** animating the marquee with JS. A CSS keyframe that the compositor
  handles is correct.
- **Not** a page-load splash. The one-question homepage must paint immediately;
  an entrance animation in front of it is a tax on every visit.
- **Not** animating the `NeuralField` nodes with `motion`. It is canvas, and
  canvas is the right tool.
- **Not** letter-by-letter headline reveals. Wrong voice, and it delays reading.

---

## The performance rule, which is not optional

The audience is mid-range Android in India, and this site's competitive argument
is that it is faster and calmer than two 19-section competitors. So this is
measured, not estimated.

**Measured on a production build, 2026-10-01**, after wiring the filtered
catalogue:

```
motion chunk            130KB raw · 42KB gzipped
loaded by               /customized-tours only
loaded by /             NO  — homepage pays nothing
loaded by /group-tours  NO
total app JS            457KB gzipped across all chunks
```

**Correcting an earlier claim in this document:** I first wrote that
`LazyMotion` costs "~6KB initial". That is true of `domAnimation`. **Layout
animation requires `domMax`, which measures 42KB gzipped** — seven times the
figure. The number is still acceptable because it is code-split to the one route
that uses it, but the estimate was wrong and the measurement is what counts.

The rule that follows: **42KB is the price of `layout` on a route.** Worth it on
a filtering catalogue where the motion carries meaning. Not worth it to fade a
heading in.

So:

```jsx
// NOT this — pulls the whole library into the first load
import { motion } from "motion/react";

// This — ~6KB initial, features loaded on demand
import { LazyMotion, domAnimation, m } from "motion/react";
```

`m` is the stripped component; `LazyMotion` with `domAnimation` loads only what
is used. `domMax` adds drag and layout animation and should be loaded **only on
the routes that need it** (the catalogue, the trip detail), never globally.

Rules:

0. **`initial={false}` on anything server-rendered.** With
   `initial={{ opacity: 0 }}`, motion writes `style="opacity:0"` into the SSR
   HTML — which made all 20 cards on the destinations page invisible until
   hydration, and permanently invisible with JS blocked. Caught by grepping the
   served HTML, not by looking at the page in a fast browser. Entrances stay on
   the CSS layer, where they degrade safely; `motion` does only `layout` and
   `exit`.
1. `m` + `LazyMotion`, never the bare `motion` import.
2. Animate `transform` and `opacity` only. Anything touching layout — `width`,
   `top`, `height` — is a frame-rate bug with a nice API.
3. Every `motion` surface respects `prefers-reduced-motion`. The CSS layer
   already does; the JS layer must be made to.
4. **Measure before and after on a real mid-range Android**, not a laptop. The
   earlier lesson in this project stands: an "optimisation" made `/admin`
   slower, and only measurement caught it.

---

## Order of work

| # | Motion | Tier | Why this position |
|---|---|---|---|
| 1 | Filtering catalogue (`layout` + `AnimatePresence`) | 1 | Makes the AI's effect on the page visible — the core product idea |
| 2 | Itinerary arrival | 1 | The moment that converts |
| 3 | Card → page shared element | 1 | Biggest brand signal, uncontested by competitors |
| 4 | Animated price changes | 1 | Cheap, reads expensive |
| 5 | Hero scroll parallax | 2 | Depth on the first screen |
| 6 | Drag galleries | 1 | Native feel on a phone |
| 7 | Reading progress | 2 | Polish, genuinely useful on long itineraries |

## What Magic UI is actually for here

The MCP server is installed. Useful for **reading component source** through
`getRegistryItem` and taking the parts worth having — its number-ticker and
animated-list implementations are a good reference for items 2 and 4.

Dropping its components in wholesale is the wrong move: they are built for a
gradient-and-glow aesthetic that this design system explicitly rejects
("no gradients anywhere on the site"). Read them, port the mechanics, keep the
house look.
