# Review — PDF downloads (itinerary + quotations)

**Date:** 2026-10-10 · **Spec:** `docs/design/pdf-downloads.md`
**Tested on:** `next dev` (local file store, local Chrome), `vitest run`,
`next build`. Three seeded quotations — Simple/draft, Modern/sent,
Detailed/approved — in `content/quotations.json` (local only, see #150).

## PM review — used, not read

| # | Criterion | Result |
|---|---|---|
| 1 | Planner plan → PDF, no print dialog | **Pass** — 3-page A4, every day, packing, watch-outs, selectable text, ₹ renders, page numbers |
| 2 | Customer link → PDF in its template, no approve/decline buttons | **Pass** — Modern 4 pages / 1.7 MB, Detailed 7 pages / 3.0 MB; approval link printed instead of buttons |
| 3 | Admin: draft (with band) and sent | **Partly verified** — the draft render shows the "Draft — not yet sent" band with Simple template; the button itself not clicked with a signed-in session (#147) |
| 4 | Unauthorised access | **Pass** — admin endpoint 401 without session; render target 404 with no/forged signature; customer link for a draft 404 |
| 5 | Abuse | **Pass** — schema-invalid body 400, 250 KB body 413; rate limit 20/hour/IP on both public endpoints |
| 6 | Honest failure | **Pass by code** — 503 with a sentence; the button shows it with "Print instead". Not exercised against a missing browser |
| 7 | A4, footer page numbers, backgrounds | **Pass** |

Timing on the dev server: 7.7 s warm for a quotation (dev compiles on demand).
Production not measured (#146).

## CTO review — correct and safe

| # | Finding | Sev | Status |
|---|---|---|---|
| F1 | **Not yet run on Vercel.** Chromium is traced into the three routes (verified in `.nft.json`), but the Lambda runtime, memory and cold start are untested. Preview deployments behind Vercel Deployment Protection will answer the headless browser's `/pdf/*` request with 401 — test on the production domain or with a protection bypass. | S2 | Open → #145 |
| F2 | Cold start launches Chromium (2–4 s) before the render; first PDF after idle may take ~6–10 s. The button shows "Preparing PDF…" throughout. | S3 | Open → #146 (measure) |
| F3 | The download rate limiter is in-memory per instance (the planner's existing pattern), so on serverless it is per instance, not global. | S4 | Accepted; noted |
| F4 | Detailed quotations are ~3 MB because photos print at screen resolution. Fine for WhatsApp and email; could be halved by printing images at 1× with lower quality. | S4 | Open → #148 |
| F5 | Pre-existing print rule `.quote-doc img { max-height: 62mm }` shortens the hero image inside its rounded frame, so the bottom corners print square. | S4 | Open → #149 |
| F6 | Render targets are under `/pdf/*` and need the site chrome suppressed; `PublicChrome` now excludes the prefix. A future public page under `/pdf` would lose its chrome too — don't put one there. | S4 | Documented here |
| F7 | `[data-reveal]` elements below the fold printed invisible (no observer on paper). Fixed for all printing, not only PDFs, with a print-media rule. | S3 | **Fixed** |

Security notes: the render target accepts only a five-minute HMAC signature
scoped to `pdf:quotation:<id>` (tests in `lib/pdf/sign.test.js`); the
headless browser navigates only to an allow-listed origin and may fetch only
images, fonts and stylesheets from elsewhere; injected itinerary text is
rendered by React, so it can add words, not markup.

## Verdict

PM: pass locally, with the admin click-through and production timing owed.
CTO: pass; **#145 must be done before telling the desk this works in production.**
