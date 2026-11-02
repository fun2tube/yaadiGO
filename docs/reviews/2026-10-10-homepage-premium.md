# Review — homepage premium redesign

**Date:** 2026-10-10 · **Spec:** `docs/design/homepage-premium.md`
**Tested on:** `next dev` with `DATABASE_URL` empty (local file store) at
1440×900 and 375×812; `vitest run`; `next build`.

## PM review — used, not read

| Check | Result |
|---|---|
| Walk all eight sections at 1440×900 | Pass — screenshots taken per section |
| Phone 375×812, hero and rail | Pass after correction C2 |
| Hero CTA → `#departures` under Lenis | Pass (3401 of 3402px) |
| Occasion filter + cursor disc | Pass |
| Console errors / hydration warnings | None |
| Concierge panel scroll under Lenis | **Not verified** — panel had no overflow to scroll (#141) |
| Reduced motion with the OS setting on | **Not verified** — cannot emulate here (#129) |

## CTO review — correct and safe

| # | Finding | Sev | Status |
|---|---|---|---|
| F1 | **The Supabase database is not answering.** From this machine `select 1` is cancelled by `statement_timeout` (57014) in 2.8s, and every page rendered against `DATABASE_URL` hangs until the client gives up (3–4 min). TCP to the pooler connects in ~1s, so it is the database, not the network. Predates this work. | **S1** | Open → #140 |
| F2 | Production build failed type-check at `src/db/booking-records.test.ts:79` (`reference` on a union type). Predates this work; blocked every deploy. | S2 | **Fixed** — narrowed in the test |
| F3 | With JavaScript blocked, every `[data-reveal]` element stayed hidden — most headings, photos and copy on every public page. Predates this work, but the new variants depended on it too. | S3 | **Fixed** — `<noscript>` stylesheet in root layout |
| F4 | Inline editor drafted from `textContent`, so editing an `EditorialHeading` would have silently dropped its `*italic*` markers on save. | S3 | **Fixed** — `data-cms-source` read first |
| F5 | Slideshow could cross-fade to a slide whose photo was still downloading — a black hero for seconds on slow 4G (seen in testing on slide 2). | S3 | **Fixed** — advances only to loaded slides |
| F6 | The roll-label copy was CSS `content: attr()` — some screen readers announce generated content, so buttons would read twice. | S3 | **Fixed** — real `aria-hidden` span |
| F7 | Hero's open animation (1.9s) can finish before the first photo arrives on a slow connection; the photo then pops in un-animated. | S4 | Open → #142 |
| F8 | Italic font adds 41.8 KB on first visit. | S3 | Mitigated (was 81.5 KB); measure with #118 |
| F9 | Page grew from ~14,200px to ~15,200px at 1440 (type band, wider spacing). | S4 | Feeds #120 |
| F10 | The nav bar is still the old system — numbered links, "Desk open", "Yaadi Ctrl K", "For business", "Talk to us" — and is the busiest thing on the new hero. | S3 | Open → #143 |
| F11 | "(07) Talk to us" label above the close is not CMS-editable. | S4 | Open → #144 |

## Corrections made during review

- C1 Close section text contrast over the bright Ladakh photo: veil 55→65%, text 75→90%.
- C2 Phone hero pushed the second CTA under the bottom bar: tightened headline size and spacing below `sm`.
- C3 Fixed F2–F6 above.

## Verdict

PM: pass, with two checks owed (#129, #141). CTO: pass for the homepage; **F1
is the most important thing in this review** and is not a homepage problem.
