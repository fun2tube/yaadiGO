# Homepage motion and imagery redesign

**Date:** 2026-10-09 · **Asked for:** "not happy with the design — add images,
framer motion, dramatic transitions and transformations on scroll, make it
interactive, a modern travel website."

**Result:** homepage rebuilt around photography and scroll-driven scenes; a
route-change curtain on every public page; photographic parallax headers on
`/group-tours` and `/customized-tours`. Lint clean, 306/306 tests, production
build passes. Walked at 1440×900 and 375×812 on a running server.

**This reverses a standing decision.** `docs/design/motion.md` set the motion
voice as "calm, deliberate — not a theme-park ride" and listed letter reveals,
3D tilt and page splashes as explicit don'ts. The owner has now asked for the
opposite. The performance and accessibility rules in that document still hold
and were all kept; the *voice* rules are superseded. See the addendum there.

---

## 1 · The critique — what was wrong with the old homepage

1. **A travel site with no travel on its first screen.** The hero was a dark
   canvas with a constellation animation. 36 licensed destination photos sat
   in `public/media/` and the homepage used them only inside 300px tour cards.
   Travel is bought on imagery; the old page asked visitors to imagine it.
2. **Seven identical beats.** Every panel was 100vh with the same composition —
   eyebrow, heading, paragraph, button — alternating ink and paper. The
   rhythm never changed, so nothing felt more important than anything else.
3. **Motion you could not see.** The only scroll motion was a 26px fade-up.
   Nothing was scroll-*linked*; the page did not respond to the reader.
4. **Scroll-snap fought the reader.** The reel snapped panel to panel, which
   makes pinned or scrubbed sections impossible and feels like a slideshow on
   desktop.
5. **No way to browse places.** The site's core inventory — 20 customizable
   trips — had no presence on the homepage apart from a text ticker.
6. **SaaS-template sections.** "How it works" and "Why us" were grids of
   bordered text cards with small icons, indistinguishable from any B2B
   landing page.
7. **Headline orphan.** "Where do you want to / go?" at desktop width.

## 2 · What was built

All new components live in `src/components/motion/`.

| Section | Component | What it does |
|---|---|---|
| Hero | `cinematic-hero.js` | Six full-bleed destination slides, cross-fade with a slow Ken Burns push-in, a slide timer that doubles as a picker. On scroll the frame shrinks into a rounded card while the photo keeps zooming and the copy lifts away. Headline words rise out of masks (CSS, so it plays from server HTML). |
| Where to next | `horizontal-gallery.js` | Pinned section: scrolling down moves a rail of nine destination cards sideways. Rail skews with scroll velocity; each photo drifts inside its frame. Progress bar along the bottom. |
| AI planner | `zoom-reveal.js` | Three-beat pinned scene: a small photo window between "The whole trip, / written down." opens to full screen as the words fly apart; then the copy rises in and a sample itinerary assembles one day at a time. |
| Group tours | `TiltCard` | Cards tilt toward the cursor with a moving light (mouse only). Magnetic "View all" button. |
| Places | `velocity-marquee.js` | Two rows of giant destination names, opposite directions; scrolling speeds them up, flips them to your direction and skews the type. Every name is a link. |
| Customized | `stack-cards.js` | The four steps as photo cards that pin and stack; each covered card shrinks and dims, like a dealt deck. |
| Corporate | `ShutterImage`, `Parallax` | Photo opens like a shutter as it scrolls in; two floating status chips move at different speeds. |
| Why us | `parallax-mosaic.js` | Twelve photos in three columns travelling at different speeds beside the four proof points. |
| Close | `ParallaxBackdrop` | Full-bleed Himalaya with parallax, centred CTA. |
| Every route | `src/app/template.js` | Ink curtain with the wordmark sweeps up while the page rises in. Admin keeps the old 10px fade. |
| Listing pages | `ParallaxBackdrop` | `/group-tours` (Spiti) and `/customized-tours` (Bali) open on photography instead of a flat text band. |

CSS reveal variants were added (`data-reveal="clip" | "zoom" | "left" | "right"
| "img"`) on the same single IntersectionObserver.

Every CMS `Editable` id on the homepage was kept, so admin text overrides
still apply. The Puck-built homepage path (`BuiltHome`) is untouched.

## 3 · Rules kept from motion.md

- **Nothing hidden in server HTML.** Every scroll-linked hidden-at-rest style
  is gated behind `useHydrated()`. Verified by grepping the served HTML: the
  only `opacity:0` elements are decorative overlays; all copy is present.
- **Reduced motion.** Every component checks `useReducedMotion()`. The gallery
  becomes a native swipe row, the planner renders its finished frame, the
  slideshow stops, magnetic and tilt switch off, the curtain is skipped.
- **Mouse-only effects stay mouse-only** via `(hover: hover) and (pointer: fine)`.
- **`LazyMotion` + `m` + `domAnimation`** everywhere; no `domMax` added.
- **Weight, measured on a production build:** homepage 293 KB of JS gzipped
  vs 279 KB for `/about`, so the whole motion layer costs about 14 KB.

## 4 · Defects found while building, and fixed

| # | Found | Cause | Fix |
|---|---|---|---|
| a | Planner scene fired at the wrong scroll positions — split headline still visible at 91% through | motion v13 hands range-mapped scroll values on `opacity`/`clip-path` to native ScrollTimeline with offsets captured once; the pinned gallery above grows the page by ~3,350px after it measures, so every accelerated value below it was stale | `useLiveTransform()` in `shared.js` forces the JS path for those values |
| b | Section headings with `data-reveal="clip"` never appeared | Chrome's IntersectionObserver honours the target's own `clip-path`; clipped to nothing, it never intersects | Clip moved to the child; the observed element stays unclipped |
| c | Phone: planner itinerary card cut off by the pinned screen | Copy + card taller than 100svh | Card (decorative, `aria-hidden`) shown from `lg` only |
| d | Route curtain froze over the page when the tab was hidden | motion animations are rAF-driven | Curtain and page entrance moved to CSS keyframes; page wrapper ends with no transform so `position: fixed` children stay pinned (verified: nav top = 0 after) |
| e | Tabbing into the pinned gallery scrolled the clipped box sideways and desynced the rail | Browser focus-scroll on an `overflow: hidden` ancestor | Focus handler resets the box and scrolls the page to the card. Verified with real Tab presses: card at x=317, box scrollLeft 0 |
| f | Light band between hero and the dark gallery while the hero shrinks | Hero backed by paper | Backed by ink |
| g | `quality={70}` etc. had no effect | Next 16 defaults `images.qualities` to `[75]` | Removed |

## 5 · Open findings — not fixed in this pass

| # | Finding | Sev | Repro |
|---|---|---|---|
| 1 | **Source photos are 1,400px wide; the hero is full-bleed.** On a 1440px retina screen the browser wants ~2,900px, so the hero and listing headers render visibly soft. | S3 | Open `/` on a MacBook; compare hero sharpness with a tour card |
| 2 | **Not measured on a mid-range Android.** motion.md requires it. The pinned gallery, mosaic and marquee all run scroll-linked transforms; a Redmi-class phone may drop frames. | S3 | Chrome DevTools → Performance, 4× CPU throttle, scroll the homepage |
| 3 | **The homepage is long** — ~16,000px at 1440×900, of which ~3,350px is the pinned gallery. Someone who wants the tours has to scrub through it. | S4 | Scroll from top to Group Tours |
| 4 | **The close section and the footer both say "Tell us where you want to go."** Pre-existing, now more obvious because the close is a full-bleed scene. | S4 | Scroll to bottom of `/` |
| 5 | **Gallery card photos are chosen by slug.** "Kashmir, Family Pace" shows a grass close-up, not a Kashmir view. | S4 | `/` → gallery card 05 |
| 6 | **Curtain and reduced-motion paths not checked in a real browser with the OS setting on** — verified by code reading only; the test browser cannot emulate `prefers-reduced-motion`. | S3 | macOS → Accessibility → Reduce motion, open `/` |
| 7 | **The other public pages** (trip detail, about, contact, corporate, blog) still have the old flat headers. | S4 | Open `/about` |
