# PDF downloads — itineraries and quotations

**Date:** 2026-10-10 · **Roles:** CTO → UI/UX → PM
**Asked for:** "Save as PDF for the itinerary builder for the customer, or if a
salesperson creates a quotation it should be saved as PDF — without the print
command."

## 1 · Decision (CTO)

**Render the existing pages to PDF on the server with headless Chromium**
(`puppeteer-core` 25.11.0 + `@sparticuz/chromium` 153.0.0 on Vercel; the
machine's own Chrome/Edge in development).

| Option | Verdict |
|---|---|
| Headless Chromium printing our own HTML | **Chosen.** One source of truth: the three quotation templates (19 blocks) and the planner's day cards are already designed for print. The PDF is the page the customer sees, so a template change can never make the PDF disagree with the web copy — the drift `templates.js` was written to prevent. |
| `@react-pdf/renderer` | Rejected: every block re-drawn a second time in another layout system. The costing and cancellation tables would exist twice, and the copy that drifts is the one a customer holds you to. |
| `html2canvas` + jsPDF in the browser | Rejected: a screenshot in a PDF — unselectable text, blurry type, large files. Not a document. |

Costs accepted: ~65 MB Chromium in the server function, a cold start of
2–4 s on the first PDF after idle, ~1 GB memory during a render. Pinned
versions are an exact pair (puppeteer 25.11 targets Chrome 153).

## 2 · How it works

```
button → GET/POST /api/…/pdf  ──(auth, rate limit)──► lib/pdf/render.js
                                                        │ launches Chromium (reused while warm)
                                                        ▼
                         Chromium opens /pdf/quotation/[id]?exp&sig   (signed, 5-minute link)
                                     or /pdf/itinerary  (data injected into the page, never in a URL)
                                                        │ print media, fonts + every image loaded
                                                        ▼
                                              application/pdf, attachment
```

- **`/pdf/*` pages are render targets, not pages.** No nav, footer, WhatsApp
  button or concierge. `noindex`. A quotation render target needs an HMAC
  signature (`ADMIN_SESSION_SECRET`) that expires in five minutes, so the
  route cannot be used to read a quotation without going through an endpoint
  that already checked who is asking.
- **The itinerary is never stored.** The planner holds it in the browser; the
  endpoint validates it against `ItinerarySchema` and injects it into the
  headless page before load. No database row, nothing in a URL.
- **SSRF:** the headless browser only navigates to an allow-listed origin
  (localhost in dev, the site's own hosts in production), never to whatever
  `Host` header arrived; requests to any other origin are blocked except
  images, fonts and stylesheets.

## 3 · Screens (UI/UX)

| Where | Control | States |
|---|---|---|
| Planner, after a plan finishes | **Download PDF** (replaces "Save as PDF") | idle · "Preparing PDF…" (disabled, spinner) · done (file downloads) · error: plain sentence + "Print instead" fallback |
| Customer quotation `/q/[token]` | **Download PDF** top right | same four states |
| Admin quotation `/admin/quotations/[id]` | **Download PDF** in the actions card, drafts included | same; a draft's PDF carries a "Draft — not sent to the customer" band so it cannot be mistaken for the final |

File names: `YaadiGo-<trip-title>.pdf`, `YaadiGo-Quotation-<title>-v<version>.pdf`.

## 4 · Acceptance criteria (PM)

1. Planner: generate a plan → Download PDF → a `.pdf` downloads with no print dialog; title, every day, packing list and watch-outs present; text selectable.
2. Customer link: Download PDF → same template the page shows (Simple/Modern/Detailed), no approve/decline buttons in the file.
3. Admin: Download PDF works for a draft (with the draft band) and for a sent quotation (without).
4. Unauthorised: `/api/admin/quotations/[id]/pdf` without a session → 401/403; `/pdf/quotation/[id]` with a missing, wrong or expired signature → 404.
5. Abuse: the public itinerary endpoint is rate-limited and rejects bodies that fail the schema or exceed 200 KB.
6. Failure is honest: with no browser available the button says so and offers Print instead — never a dead button.
7. Page numbers in the footer; A4; backgrounds printed.
