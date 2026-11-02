# Full function test — website + admin panel, in the browser

**Date:** 2026-10-14 · **Asked for:** "Open the website and admin panel on
browser and test each function, check what's working, then create the report
and action plan to fix and complete the project."

> **Update, same day:** all code findings below are fixed — see
> `2026-10-14-fixes.md`. **Correction to F4:** the builder's "Nights" box
> actually stores *days*, so the AI's 7 for a 6N/7D trip was right; the bug was
> the label (now "Days"), plus the travellers default of 0.

## How it was tested

- **Where:** `node scripts/dev-local-store.mjs` (port 3006), driven in the
  built-in browser and with curl. The file store was used on purpose for every
  write: the live Supabase holds real customers, and `.env.local` holds LIVE
  Razorpay keys. Nothing was written to the real database.
- **Who:** a throwaway local admin (`qa-admin@example.test`) seeded into
  `content/users.json`, plus a Sales user created through the real invite →
  accept → approve flow. All test leads use `9000000001–3` and `example.test`.
- **Also:** the live domain (`www.yaadigo.com`), read-only; the public pages
  against the real database (read-only); `vitest run`; `eslint .`; every page
  at 375 px for horizontal overflow.
- **Gaps:** the screenshot side of the browser pane stalled intermittently,
  so most checks after login were made by reading the DOM, not by eye.

## Verdict

**The app is far along and most of it works.** Every public page and every
admin page loads; the core sales loop (enquiry → lead → AI-drafted quote →
customer approves → booking → ops hand-off → invoice) runs end to end, and
seat inventory updates the website live.

**It is not launch-ready for four reasons:** (1) it isn't deployed — the domain
serves a "Coming Soon" page; (2) approving a quote for a lead who already
requested seats creates a second booking and doubles their outstanding
balance; (3) offline payments (bank transfer / GPay — the methods the quote
offers) cannot be recorded anywhere in the UI, so "Collected" stays ₹0;
(4) invoices are raised as GST tax invoices with no GSTIN and no place of
supply. Email isn't configured either, so no customer or staff email is sent.

## What works

| Area | Function | Result |
|---|---|---|
| Public site | All 54 sitemap URLs (home, about, blog ×8, group tours ×14, customized ×20, plan, contact, corporate, legal), 404 page, robots, sitemap, llms.txt, manifest, OG image | ✅ 200, no console errors |
| Public site | Phone width (375 px) on home, trip, plan, contact, admin | ✅ No horizontal overflow |
| AI planner | Home search → 3-step wizard → day-by-day itinerary (6 days, cost band, season advice, "redo this day") | ✅ Works; took ~45–60 s because Gemini returned 503 on two models before a fallback answered |
| AI planner | Download PDF | ✅ 318 KB PDF, 22 s cold |
| AI planner | "Send this plan to the travel desk" | ✅ Lead created with the full itinerary |
| Concierge | "Ask Yaadi" chat | ✅ Answers, shows a real departure card; anonymous asks land in **Leads → Asked Yaadi** |
| Group tour | Departure picker, sharing, joining point, traveller count, price/advance/balance maths | ✅ Correct (₹27,000 × 2 = ₹54,000, ₹10,000 advance) |
| Group tour | "Reserve seats" request | ✅ Lead + booking created, honeypot correctly hidden |
| Contact | Enquiry form | ✅ Lead created |
| Admin auth | Wrong password message; sign in; 12 h signed cookie | ✅ |
| Admin auth | Invite → set password → (blocked until approved) → approve → sign in; invite link single-use | ✅ |
| Permissions | Anonymous → every admin API returns 401; Sales → Team, Pages, Content, Navigation APIs 403 and pages redirect | ✅ |
| Overview | "My day" counts, due list, call links | ✅ (WhatsApp link broken — F5) |
| Leads | Stage change, note, history timeline | ✅ |
| Quotations | AI draft from the enquiry (lines, inclusions, exclusions, "ask them this", assumptions, margin) | ✅ (wrong defaults — F4) |
| Quotations | Save draft (no duplicates on re-save), send → frozen, customer link `/q/[token]` (noindex), approve | ✅ |
| Bookings | Confirm a seat request → "Take 2 seats off this batch?" → seats 14 → 12 on the website and in Departures | ✅ |
| Bookings | Add a service to arrange; hand to operations | ✅ |
| Payments | Razorpay link refuses to run a LIVE key outside production | ✅ guard works (link itself untested — needs test keys) |
| Operations | Handed-over bookings listed, "no travel dates yet" bucket | ✅ |
| Trips | Edit → Save draft → Publish to website → change visible on `/group-tours` and the trip page | ✅ |
| Departures | List, batch detail, holds/waitlist panel, printable manifest | ✅ |
| Invoices | Raise invoice → `YG/26-27/0001`, sequential per FY | ✅ (contents incomplete — F3) |
| Reports | Month KPIs, response times, pipeline, by salesperson, by source | ✅ (numbers inherit F1) |
| Pages | Page list, visual editor (Puck) loads, menu & footer editor | ✅ loads (editing not exercised) |
| Code | `vitest run` 370/370 · `eslint .` clean | ✅ (see F12 for flakiness) |

## Findings

| # | Finding | Sev | How to reproduce |
|---|---|---|---|
| F1 | **Approving a quote creates a second booking for a lead that already has one.** The seat request YG26-XRD2X (₹54,000) and the quote booking YG26-3ZOWR (₹64,155) both exist; the lead shows Booked/Outstanding **₹1,18,155**, Reports shows the same, and both appear under Invoices "awaiting". `convert.js` only de-duplicates per quotation, not per lead/request. | **S1** | Reserve seats on any group tour → Draft quotation from that lead → Send → approve at `/q/…` → open the lead |
| F2 | **Offline payments cannot be recorded.** The quote tells the customer to pay by bank transfer or Google Pay, but the booking screen only offers "Create link" (Razorpay). `POST /api/admin/payments` exists and nothing in the UI calls it, so "Collected" stays ₹0 and every report of money received is wrong. | **S1** | Open any booking → there is no "Record payment" |
| F3 | **Invoices are issued with no seller GSTIN, no place of supply, no SAC code, no customer address**, and there is no invoice view, PDF, email or credit note. A GST tax invoice without the supplier's GSTIN is not valid. | **S1** | Invoices → Raise invoice → inspect the record; the row has no link |
| F4 | **AI quote defaults are wrong:** Travellers = 0 (lead says 2) and Nights = 7 (trip is 6N/7D). With 0 travellers, per-person lines count as zero — the draft showed ₹42,473 instead of ₹64,155. Send is disabled at 0, so it is caught, but a salesperson trusting the total is misled. | S2 | Draft quotation from the seat-request lead without saving the brief first |
| F5 | **WhatsApp buttons in the admin open the wrong number.** Six places build `wa.me/<raw digits>`; a 10-digit Indian mobile becomes `wa.me/9000000001` with no `91`. `lib/crm/messages.js` already normalises correctly — those screens don't use it. | S2 | Overview / lead / booking → WhatsApp |
| F6 | **Sales users see every booking and customer phone number.** Leads are scoped to their owner; `GET /api/admin/bookings` and `/admin/bookings` are not. | S2 | Sign in as Sales → Bookings shows the admin's customers |
| F7 | **Advance amount disagrees.** The customer's quote says advance ₹10,000; the bookings board says "₹16,039 advance confirmed but not yet received" (hard-coded 25% in `convert.js:40`). The quote's payment schedule also labels the balance "50%" when it is ₹22,077 of ₹64,155. | S2 | Approve a quote → compare `/q/…` with `/admin/bookings` |
| F8 | **A quote approval marks the booking "Confirmed" with ₹0 paid, no dates and no departure**, while the quote says "your booking is confirmed once we receive the advance". Ops receives it as "Dates to confirm"; its "2 seats held" are not held on any batch. | S2 | Same as F1 → open YG26-3ZOWR |
| F9 | **The domain is not running this app.** Every path on `www.yaadigo.com` returns the same nginx "Coming Soon" page. | S1 (launch) | `curl https://www.yaadigo.com/group-tours` |
| F10 | **No email provider.** `RESEND_API_KEY` is unset: invites are copy-paste links, and customers/staff get no mail. | S2 | Team page banner |
| F11 | Invoices list an unconfirmed seat **request** as "awaiting an invoice". | S3 | Invoices after any seat request |
| F12 | Tests time out under load: 3 then 1 failures (5 s limit, `trip-seats.test.js` and two others) while a dev server was running; 370/370 when idle. | S3 | `npx vitest run` with `next dev` running |
| F13 | Seat request brief isn't pre-filled: the quote builder reports "Not confirmed: departure date, number of adults" although the request carries both. | S3 | Draft quotation from a seat-request lead |
| F14 | Frozen (sent) quotation still shows active **Save draft / Send to customer** buttons; URL stays on `/quotations/new` after saving. | S3 | Send a quote and look at the builder |
| F15 | The site's floating "Edit page · Dashboard · Sign out" bar shows inside admin screens and covers content (e.g. the AI "What it assumed" box). | S3 | Any admin page |
| F16 | The planner ignores the number of days typed in the home search ("Manali 4 days" → 6-day plan). | S3 | Home search "Manali 4 days" |
| F17 | Gemini primary models returned 503; the planner waited ~45–60 s on fallbacks. Backlog #53 (second provider) matters now, not later. | S3 | Server log `[ai] … unavailable (503)` |
| F18 | Overview says "3 due today" while each card says "tomorrow". | S4 | Overview after hours |
| F19 | Group-tour day-by-day has text on day 1 only (Kashmir); departures already under way (12 Oct) still count as "Upcoming". | S4 | Kashmir trip page; Departures |
| F20 | `next/image` warns quality 78 is not in `images.qualities`. | S4 | Console on trip pages |
| F21 | Emails are `@yaadigo.in` on a `yaadigo.com` site — confirm that is intended. | S4 | Contact page |

**Not verified:** a Razorpay link and webhook (needs test keys); the public
site against the live DB — the dev server took 2–2.5 min per page (#152, known
dev-only wedge; `next start` must be checked instead); the visual page editor's
save/publish; PDFs on the real host (#145).

## Action plan

### Phase 1 — money and data correctness (before any real customer)

1. **F1 + F8** — one booking per trip: when a lead already has an open booking,
   quote approval updates/links it (price, travellers, departure) instead of
   creating a second; a quote approval sets status "awaiting advance", not
   "confirmed". Add a test for request → quote → approve.
2. **F2** — "Record payment" on the booking (amount, method, reference, date)
   calling the existing `/api/admin/payments`; show the ledger.
3. **F7** — one advance rule, stored on the quotation/trip and used by the
   customer page, the board and the payment link; fix the schedule labels.
4. **F3** — block invoicing until GSTIN/address are set (needs #89 from the
   business); add SAC 998555, place of supply, CGST/SGST vs IGST split,
   customer address/GSTIN, an invoice page + PDF (renderer already exists),
   and a credit note (#108).
5. **F4 + F13** — the quote builder takes travellers/dates/nights from the lead
   and its booking request; nights = days − 1 from the trip.

### Phase 2 — make it usable by the team

6. **F5** — route all six WhatsApp links through the `messages.js` normaliser.
7. **F6** — scope bookings (list + API) to the owner unless `team.read`;
   decide whether Sales may see company-wide Reports and Invoices.
8. **F10** — set `RESEND_API_KEY` and a verified sender; then quote-sent,
   invite, approval and payment emails start working.
9. **F14, F15, F11, F18** — UI fixes in the builder, admin chrome, invoices
   list and overview.

### Phase 3 — go live

10. **F9** — deploy to Vercel with the production env, point `www` and
    `corporate` DNS at it, then run backlog #145/#146 (PDFs on Vercel) and a
    full smoke test with `next start` + real DB.
11. Razorpay: test keys locally, register the webhook in production, run one
    real ₹1 payment end to end.
12. **#35** — move Supabase to Mumbai; today's Sydney latency is the single
    biggest speed cost.
13. **F17 / #53** — second AI provider key so the planner survives a Gemini
    outage.

### Phase 4 — content and polish

14. Business facts: GSTIN, CIN, reviews, photos (#52, #89, #97).
15. **F16, F19, F20, F21, F12** — planner day parsing, missing day text,
    image config, email domain, test timeouts.
16. The open S1 from the last review, **#151** (wrong itinerary on a sent
    Spiti quotation), is still open and is the owner's to fix.

## Test data left behind

All in `content/*.json` (local file store only, never read when
`DATABASE_URL` is set): 3 test leads, 2 bookings, 1 quotation, 1 invoice, 2
test users, and the Goa trip tagline edited to end in "QA-EDIT". Delete the
`content/*.json` files to return the local store to empty.
