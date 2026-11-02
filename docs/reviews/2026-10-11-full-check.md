# Full check — homepage redesign + PDF downloads, against the live database

**Date:** 2026-10-11 · **Asked for:** "Check all of it and update also."
**Covers:** `2026-10-10-homepage-premium.md`, `2026-10-10-pdf-downloads.md`.
**Tested on:** Supabase back up; `next build` + `next start` with the real
`DATABASE_URL`; fresh `next dev`; `vitest run` (370 tests); eslint.

## What was re-verified

| Area | Result |
|---|---|
| Database | `select 1` answers again (3.2 s incl. connect). Yesterday's S1 (#140) was an outage, not the code |
| Production pages, real data | `/` 3.2 s cold-ish, 1.9–2.1 s warm; `/about` 2.2 s; `/blog` 1.8 s; `/customized-tours` 3.6 s; `/plan` 2.4 s. First `/group-tours` after start 34 s (see F5) |
| Homepage, production build | Desktop + 375 px: renders, live counts (21 departures, 13 trips), no horizontal overflow, Lenis on desktop / off on touch, noscript fallback present, close label now editable |
| Lenis + scrollable panels (#141) | **Verified.** Lenis leaves wheel events over a scrollable box alone (native scroll), and cancels them over page content (its own smooth scroll) — control included |
| PDF, real quotations | Sent Detailed "Spiti" (6 pages, 498 KB) and approved "Dubai" (450 KB) download from the customer link via the production server. Cold 27–33 s, warm 8.3 s |
| Tests / lint | 370/370, clean |

## Findings

| # | Finding | Sev | Status |
|---|---|---|---|
| F1 | **Production build failed with the real database.** 7 prerender workers × a pool of 10 hit the Supabase pooler at once; with queries at 0.8–4 s from here, pages queued past the 60 s limit and the build exited. Every earlier "build passes" in these reviews used the file store. | **S1** | **Fixed** — `next.config.mjs`: 2 workers, concurrency 2, 180 s per page. Build passes in 72 s, 64/64 pages |
| F2 | **A sent quotation shows the wrong trip.** "Spiti Valley — 6 Nights / 7 Days, ex Shimla" (v2, sent) has a Leh–Nubra–Pangong *Ladakh* day-by-day. The customer can see this now. | **S1** | Open → #151 (owner) |
| F3 | Quotation PDFs left page 1 blank when there was no hero: `section { break-inside: avoid }` pushed the whole day-by-day to page 2. | S2 | **Fixed** — sections flow, cards stay whole |
| F4 | Itineraries printed "Afternoon: Not applicable / Evening: Not applicable" (web and PDF, planner and quotations). | S3 | **Fixed** — `lib/slot-text.js` (+ test) hides placeholder slots |
| F5 | After a database outage the long-running dev server's pool stayed wedged — every page hung until restart. The same would apply to `next start` on a server; Vercel recycles functions. | S3 | Open → #152 |
| F6 | Hero image printed with square bottom corners (#149). | S4 | **Fixed** — cap on the frame, not the image |
| F7 | "Talk to us" label not editable (#144). | S4 | **Fixed** |
| F8 | PDF render time warm 8.3 s on the production build locally, most of it the page's own database reads at Sydney latency. Moving the database (#35) is the real fix. | S3 | Feeds #146 |
| F9 | The test quotations from yesterday (#150) were in the local file store only. | S4 | **Removed** |

Still **not verified** and still owed: PDF downloads on Vercel itself (#145),
the admin download buttons with a signed-in session (#147), reduced motion with
the OS setting on (#129), a mid-range Android profile (#118).

## Verdict

Locally, against the live database, both features work. The two S1s were not
in either feature: the build (fixed) and a quotation's content (needs the
owner, #151).
