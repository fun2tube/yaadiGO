# Backlog

Every item traces to a finding in `docs/reviews/`. Ordered by what unblocks the
business, not by what is pleasant to build.

**Severity:** S1 loses data/money/trust · S2 feature does not work for a real
user · S3 will hurt later · S4 polish

---

## Sprint 1 — make what exists actually usable

| # | Task | Sev | Role | Done when |
|---|---|---|---|---|

| 28 | Browser notifications for new leads | S3 | DevOps | Permission asked on click; fires while a tab is open; UI states the limit |
| 30 | ~~Invoice print view + PDF~~ — **superseded, see Team operating model** | S3 | UI/UX → DevOps | `/invoice/[id]` prints like the quotation does |

## Sprint 2 — move onto Postgres

| # | Task | Sev | Role | Done when |
|---|---|---|---|---|
| 35 | **Move the project to ap-south-1 (Mumbai)** — 335ms → ~40ms per query | S2 | You | Admin pages in ~300ms instead of ~1.45s |
| 12 | Remove the file store | S3 | CTO | `content/*.json` no longer read by any module |

## Sprint 3 — the revenue levers

| # | Task | Sev | Role | Done when |
|---|---|---|---|---|
| 15 | WhatsApp notifications live | S2 | DevOps | Customer gets the quotation link on WhatsApp |
| 16 | ~~Supplier rate cards~~ — **superseded by #111** | S3 | CTO → DevOps | Quotation lines pull real cost instead of being typed |
| 17 | Profile screen — change own password and name | S3 | DevOps | The existing API is reachable |
| 18 | Outbox screen | S3 | DevOps | Admin can see what was sent, pending and failed |

| 33 | File + PDF upload (Supabase Storage) — **promoted S3→S2**; from the quotation builder straight onto a hotel row, leg or gallery; HEIC and large phone JPEGs downscaled on the way in; flight tickets are often PDFs | S2 | DevOps | A salesperson attaches the photo a hotel just sent on WhatsApp. Photos already RENDER (`hotel.imageId`/`imageUrl`, galleries) — only the upload path is missing |
| 34 | Verify template print output on a real printer | S4 | PM | A 12-day Detailed prints without a split card |

## Sprint 4 — growth

| # | Task | Sev | Role | Done when |
|---|---|---|---|---|
| 21 | Reports: date range, CSV export | S4 | DevOps | Any month selectable; export works |
| 22 | ~~Planner itinerary → quotation draft, one tap~~ — **superseded, see Team operating model** | S3 | DevOps | Planner output pre-fills the builder without retyping |

## Blocked on facts only the business has

Not development tasks. Each one is a real-world fact that is not inventable, and
each blocks something already built and waiting for it. See
`docs/reviews/2026-09-30-content-and-design.md`.

| # | Needed | Sev | Blocks |
|---|---|---|---|
| 53 | **Groq API key** (free — console.groq.com/keys) | S2 | Gemini's free tier is 20 generations/day/model, ~100 across the ladder. Fine now, will not survive traffic. `AI_PROVIDER=groq` is already supported. |
| 50 | CIN + GSTIN — **duplicate of #89 / #97** | S3 | Footer and About; a corporate finance team looks for both |
| 51 | Instagram + LinkedIn URLs — **superseded by #87** (Instagram + YouTube) | S3 | `sameAs` schema, and the entire video distribution plan |
| 52 | Real reviews, with written permission | S2 | `Testimonials` is built and renders nothing; the only honest route to competing on social proof |

## From the brochure — what is still needed

| # | Task | Sev | Role | Done when |
|---|---|---|---|---|
| 87 | **Instagram + YouTube handles** | S2 | You | Paste the URLs into SOCIAL in lib/site.js and reel links into VIDEOS; the components are built and waiting |
| 88 | **Confirm the cancellation wording** | S1 | You | The brochure says "Above 30 days – 70% of the package rate" without saying whether 70% is the refund or the charge. I encoded it verbatim. This is a money term — it needs to be unambiguous before it goes to a customer. |
| 89 | GSTIN and CIN | S2 | You | Footer, About and invoices; a corporate finance team looks for both |
| 92 | `ADMIN_EMAIL` still says .com while the site says .in — the login and the public address disagree | S3 | You | One of them changes; they should match |
| 93 | Audit every jsonb-ish field against the schema | S2 | DevOps | Four fields have now been written to columns that did not exist. A one-off check would have caught all four. |
| 91 | Real trip photography to replace stock | S2 | You/Ops | 36 licensed stock images today; none are YaadiGo trips |

## Homepage bet — measure it

| # | Task | Sev | Role | Done when |
|---|---|---|---|---|
| 85 | Measure the one-question homepage against the old one | S2 | You/PM | Every competitor believes dense homepages work. This does the opposite deliberately — it needs numbers, not opinion. Keep the dense version reachable until they exist. |
| 86 | Voice on a real mid-range Android | S3 | You | en-IN recognition of Indian place names is the claim; it has not been tried on a real device |

## Editor coverage — what is still uncovered

| # | Task | Sev | Role | Done when |
|---|---|---|---|---|
| 84 | `/plan` and `/blog` have no editable fields | S3 | DevOps | The planner is a client component and blog copy lives in posts.js, so neither is reachable by wrapping JSX — both need a different approach |

## Data layer

| # | Task | Sev | Role | Done when |
|---|---|---|---|---|
| 31b | Domain layer in integer paise | S4 | CTO | Measured drift today is sub-paisa and only on fractional prices, which this desk rarely quotes. A bigint rewrite of every module is not yet worth its risk — revisit if fractional pricing becomes normal. |
| 82 | Drop the unused `catalogue_overrides` table | S4 | DevOps | Superseded by `documents`; never held a row |

## Sales desk — what the consultant needs

From `docs/reviews/2026-10-01-sales-desk-gap-analysis.md`. Ranked by revenue
impact per unit of work. Phone and email are now live: **+91 73737 34778** and
**info@yaadigo.com**.

| # | Task | Sev | Role | Done when |
|---|---|---|---|---|
| 56 | **`SMTP_URL`** — a Google app password for info@yaadigo.com | S1 | You | The customer actually receives the quotation link. SMTP delivery is built and waiting on this one line. WhatsApp Cloud API deferred by decision. |
| 64 | UTM + referrer capture through to the lead | S3 | DevOps | Revenue reportable by campaign; impossible to backfill later |
| 66 | Customer booking status page (token, like the quote) | S3 | DevOps | "What's happening with my booking?" is a link, not a phone call |
| 67 | ~~Ops service checklist template per trip type~~ — **superseded, see Team operating model** | S4 | PM → DevOps | A Dubai visa or a Ladakh permit is an unticked row, not a surprise |
| 68 | Razorpay webhook registered in the dashboard + `RAZORPAY_WEBHOOK_SECRET` | S2 | You | The code is built and tested; the gateway needs pointing at `/api/webhooks/razorpay` |
| 70 | ~~Balance reminder at T-21 days~~ — **superseded, see Team operating model** | S3 | DevOps | Outstanding balances chase themselves |

## Page editor — coverage, not capability

The editor already supports **text, images, style tokens and hide/show**. The
problem is that almost nothing is wrapped: 8 fields, all on the homepage, all
headings. Everything else on every page has nothing to click.

| # | Task | Sev | Role | Done when |
|---|---|---|---|---|
| 74 | Editable lists — add/remove/reorder a proof point or a WHY card | S3 | CTO → DevOps | The store holds text/image/style/hidden per id; a list needs a new override kind |
| 75 | `(site)` route group so the root layout holds no customer chrome | S3 | CTO | `PublicChrome` can stop excluding itself by pathname |

## From the end-to-end flow test

From `docs/reviews/2026-10-01-end-to-end-flow.md`. The two S1 faults it found
are already fixed and closed below; these are what it left open.

| # | Task | Sev | Role | Done when |
|---|---|---|---|---|
| 54 | Automated test for the enquiry form | S3 | DevOps | The only entry point for every lead is covered; curl cannot reproduce the Server Action bound-arg encoding, so this needs a different harness |
| 55 | Rename booking `balance` — it is `total − advance`, not outstanding | S4 | DevOps | No field named balance can be mistaken for what is owed |

## Sprint 5 — the website as an answer engine

From `docs/design/ai-and-video-website.md`. Ordered so the cheapest
differentiation ships first and the expensive moat starts capturing immediately.

| # | Task | Sev | Role | Done when |
|---|---|---|---|---|
| 36 | **Start capturing trip footage** — ops checklist per departure | S2 | You/Ops | Every departure returns 20+ vertical clips; nothing to build first |
| 39 | Yaadi tools return UI actions, not prose | S2 | CTO → DevOps | "Ladakh under 40k in June" re-renders the grid |
| 40 | Clip library — tagged store + `showClips` tool | S2 | DevOps | Yaadi answers a hotel question with that hotel's clip |
| 41 | Comparison card — two trips, one recommendation | S3 | UI/UX → DevOps | Ends with one pick and a reason, never a list of ten |
| 42 | Trip Card — share + print, no signup, video summary | S3 | DevOps | Survives a WhatsApp forward |
| 43 | Capture under the finished plan + voice-note enquiry | S2 | DevOps | Lead lands in the CRM with the recording attached |
| 44 | Mobile video budget — poster, lazy, one at a time, data-saver | S3 | DevOps | Measured on a mid-range Android, not a laptop |
| 45 | Answer pages (decision queries) + voice-shaped FAQ | S3 | PM | Each page paired with its clips |
| 46 | Programmatic destination × month × traveller pages | S4 | DevOps | Generated from real departures with real seat counts |
| 47 | Trip diaries published from operations | S4 | PM | Publishing is a by-product of running a trip |

---

## SEO & AI search

From `seo-reports/`. Phase 1 (audit) and Phases 2–5 (indexing, structured data,
crawler policy, on-page) are done — see `seo-reports/02-changes.md`. What is
left is blocked on a decision, an asset, or a field measurement.

| # | Task | Sev | Role | Done when |
|---|---|---|---|---|
| 94 | Decide the AI **training**-crawler policy (M1) | S3 | You | `AI_TRAINING_AGENTS` in `src/app/robots.js` is allow or disallow on purpose, not by default |
| 95 | Field Core Web Vitals, not lab (M7, audit B5) | S2 | DevOps | Homepage LCP measured from the deployed build on a mid-range Android; the 364 KB / 3.9 s figure is dev-server lab data and must not be optimised against |
| 96 | Verify + submit sitemap in Search Console (M7) | S2 | You | 54 URLs submitted; `TouristTrip` confirmed detected on `/customized-tours/*`, which it never was before |
| 97 | GSTIN + CIN on `/about` and in the footer (M5, #89) | S2 | You | `REGISTRATION` filled; corporate finance teams stop asking |
| 98 | Postal code + registered street address (M6) | S3 | You | `ADDRESS.postalCode` set from the CIN certificate |
| 99 | Decide whether `/credits` should be indexed (M8) | S4 | You | Either `noindex` on exactly that one URL, or left as is deliberately |
| 100 | Confirm the "draft itinerary within hours" claim (M9) | S3 | You/Ops | The desk can hold to it, or the line comes off `/customized-tours` |
| 101 | `git init` so phases are reviewable as diffs (M4) | S3 | DevOps | Several bugs here were silent field drops a diff would have caught |

Already tracked elsewhere and blocking SEO work: **#87** (Instagram/YouTube handles →
`sameAs`, footer, video reel), **#91** (real trip photography → per-trip `og:image`,
`TouristTrip.image`), **#35** (414 ms Sydney database, underneath every page-speed number).

---

## Team operating model — the admin panel build

From `docs/design/team-operating-model.md`, written 2026-10-09 against an audit of
the running system. Ordered so each item unblocks the next. **#102 and #103 ship
together** — #102 alone changes nothing a salesperson notices, and #103 without
#102 inherits the same empty fields.

| # | Task | Sev | Role | Done when |
|---|---|---|---|---|
| 102 | ~~**Structured brief fields** — departure date + flexible flag, hotel category, meal plan, transport, room config with child ages~~ — **DONE 2026-10-09** | S1 | CTO → DevOps | A salesperson never re-asks the customer something the form already took; blocked on the five decisions in §6 |
| 103 | ~~**Itinerary → quotation draft, one tap** (was #22)~~ — **DONE 2026-10-09** | S1 | DevOps | The itinerary the customer built on `/plan` becomes a priced draft without retyping |
| 104 | ~~**Accounts role; invoice gated behind it**~~ — **DONE 2026-10-09** | S2 | CTO → DevOps | A salesperson can no longer raise a tax invoice; `ROLES.accounts` exists with its own permission set |
| 105 | **Booking confirmation voucher** | S2 | UI/UX → DevOps | The customer has a document to show at the hotel; today only the word exists, in a WhatsApp template |
| 106 | **Customer notification track** — 11 moments, currently zero | S2 | DevOps | Acknowledgement, quote sent, approved, receipt, ops intro, voucher, T-21, T-7, review request |
| 107 | Balance reminders at T-21 and T-7 (was #70) | S3 | DevOps | Money stops being chased by hand |
| 108 | Invoice PDF + credit note / void with reason (was #30) | S3 | DevOps | Accounts can close a month; an invoice can be reversed without editing an immutable row |
| 109 | Refund calculator against the 70/50/nil ladder | S3 | DevOps | Blocked on #88 — the cancellation wording is ambiguous |
| 111 | **Property / supplier master** (was #16, promoted S3→S2) — name, city, category, room classes, seasonal rate bands, photos | S2 | CTO → DevOps | A salesperson picks a hotel from a dropdown instead of typing it. **Hard dependency of the two-minute quotation** — see `team-operating-model.md` §7 |
| 112 | **Hotel options in a quotation** — 2–3 per stay, one marked recommended, others as a price delta; the customer's pick recorded on approval | S2 | UI/UX → DevOps | The quotation stops being take-it-or-leave-it, and ops confirms the property the customer actually chose |
| 113 | **Quotation PDF download** — headless Chrome over the existing `/q/[token]` page, not browser print; same renderer later serves the voucher (#105) and invoice (#108) | S2 | CTO → DevOps | A Download PDF button returns a paginated A4 file. Decide the runtime alongside #35 — Chromium needs `@sparticuz/chromium` on Vercel serverless |
| 114 | **Two more quotation templates** — Group departure, Corporate/MICE | S3 | UI/UX → DevOps | Five total. The mechanism is BUILT (`TEMPLATES` with `hero`/`dayImages`/`flights` flags); these are layouts, not plumbing |
| 115 | **Policy editing UI** — cancellation, payment schedule, payment options, how-to-book, terms, declaration become editable in the quotation builder | S2 | DevOps | `quote-builder.js` has 12 inputs and none touch policy. The schema already stores overrides; only the UI is missing |
| 116 | **Policy library** — named sets per kind (Domestic standard / Fixed departure / International with airfare / Peak season), admin-managed, picked per quotation, edits marked "modified from X", archived never deleted | S3 | CTO → DevOps | **Blocked on #88.** Sending snapshots the text so an approved quotation never changes retroactively |
| 110 | Discount floor + approval above a threshold | S4 | CTO | Sales cannot quote below margin without a manager |

Superseded by the above: **#22** (now #103), **#30** (now #108), **#70** (now #107),
**#67** (folded into #105), **#16** (now #111). **#33** promoted S3→S2 and restated
against the quotation builder.

---

## Motion redesign — follow-ups (review 2026-10-09-motion-redesign)

| # | Task | Sev | Role | Done when |
|---|---|---|---|---|
| 117 | ~~Source hero photography at ≥2,800px~~ — **done 2026-10-10** (Unsplash, 2,800px heroes) | S3 | UI/UX | Hero is sharp on a 1440px retina screen |
| 118 | Profile the homepage on a mid-range Android (4× CPU throttle at minimum) | S3 | DevOps | Scroll through pinned gallery, mosaic and marquee holds ~60fps, or the heaviest effect is cut |
| 119 | Check reduced-motion and the route curtain in a real browser with the OS setting on | S3 | PM | Gallery is a swipe row, planner is static, no curtain |
| 120 | Decide homepage length — ~16,000px today; consider a shorter gallery or a "skip to tours" link | S4 | UI/UX | Owner has chosen |
| 121 | ~~Remove the duplicated closing line~~ — **done 2026-10-10** ("Not sure yet? Ask a person.") | S4 | UI/UX | One of the two says something else |
| 122 | ~~Pick a deliberate card photo for each trip~~ — **done 2026-10-10** (33 replaced) | S4 | UI/UX | No gallery card shows a close-up that doesn't read as the place |
| 123 | Roll the photographic `ParallaxBackdrop` header to trip detail, about, contact, corporate and blog | S4 | UI/UX → DevOps | No public page opens on a flat text band |

## Trip management (docs/design/trip-management.md, 2026-10-10)

| # | Task | Sev | Role | Done when |
|---|---|---|---|---|
| 130 | ~~**Trip editor can undo confirmed bookings**~~ — **done 2026-10-10** (difference applied under lock; tests) | **S1** | DevOps | Confirm a booking while the editor is open, then Save — seats stay correct; test covers it |
| 131 | ~~Trips managed in the admin~~ — **built 2026-10-10**, awaiting owner click-through (PM review) | S2 | CTO → DevOps | Admin creates a trip from a phone, live with no developer |
| 132 | Departures on the `departures` table: computed seats, holds, waitlist, cut-off, board, manifest | S2 | DevOps | Two bookings on the last seat → exactly one succeeds |
| 133 | Media upload + generated PDF brochure + attachments (with #33) | S2 | DevOps | New trip gets photos and a PDF with no developer |
| 134 | Share kit with salesperson attribution; quote-from-trip; quotation library merged into Trips | S3 | DevOps | Shared link's enquiry is auto-assigned to the sharer |
| 135 | Propose-as-trip from a quotation: strip customer data, duplicate check, review queue | S3 | PM → DevOps | Quote → reviewed published trip in < 5 min with no customer data |
| 136 | ~~**mutateBy broken on Postgres for documents** — confirming a group booking threw~~ — **fixed 2026-10-10** (PGlite test) | **S1** | DevOps | Seat moves work on the live database |
| 137 | Owner click-through of /admin/trips: create, save, publish, sales-only, archive with redirect, restore, delete draft, departures | S2 | You | Each action behaves as the editor says |
| 138 | Migration: `bookings.trip_version`; record it on every booking (part of #132) | S3 | DevOps | A booking shows the version it was sold on |
| 139 | Check production bookings confirmed before 2026-10-10 — seat moves were failing (#136); reconcile seat counts against bookings | **S1** | You → Ops | Every confirmed booking's seats are actually off its batch |

## Homepage content strategy — follow-ups (2026-10-10)

| # | Task | Sev | Role | Done when |
|---|---|---|---|---|
| 124 | Delete the 33 unreferenced Wikimedia photos in `public/media/` (~20MB) — owner to confirm | S4 | You | Folder holds only referenced files |
| 125 | Replace the Kaziranga and corporate-page photos | S4 | UI/UX | No remaining Wikimedia photo reads weaker than its neighbours |
| 126 | Re-apply any admin-edited homepage copy that lived under the retired ids (`home.planner.*`, `home.corporate.*`, `home.ask.*`, `home.custom.*`) | S3 | PM | Owner confirms nothing they edited went missing |
| 127 | Show "For business" at 1024–1279px too (compact) | S4 | UI/UX | Corporate is one click from the header at every desktop width |
| 128 | Collect real group-trip photos with written consent; swap the hero and "Two ways" cards first | S3 | You | Hero shows a real YaadiGo group |
| 129 | Check the new homepage on a mid-range Android and with reduced motion on | S3 | PM | Smooth scroll; reduced motion shows a static page |

## Homepage premium redesign — follow-ups (review 2026-10-10-homepage-premium)

| # | Task | Sev | Role | Done when |
|---|---|---|---|---|
| 140 | ~~**Supabase is not answering** — `select 1` cancelled by statement timeout (57014); every DB-backed page hangs. Check the live site and the Supabase dashboard (paused project, exhausted pooler, long-running query)~~ — **resolved 2026-10-11: an outage; `select 1` answers, production pages 2–3 s** | **S1** | You → DevOps | `select 1` returns in < 1s and `/` renders against `DATABASE_URL` |
| 141 | ~~Verify the concierge panel scrolls by wheel under Lenis with a long conversation~~ — **verified 2026-10-11 (review 2026-10-11-full-check)** | S3 | PM | Wheel over the panel scrolls the panel, not the page |
| 142 | Start the hero open animation on the first photo's load, not on first paint | S4 | DevOps | On throttled 4G the photo is never revealed into an empty frame |
| 143 | Redesign the nav to the editorial system — fewer items, quieter chrome over the hero | S3 | UI/UX → DevOps | Nav is no longer the busiest element on the hero |
| 144 | ~~Make the close section's "Talk to us" label editable~~ — **done 2026-10-11** | S4 | DevOps | Editable in the page editor |

## PDF downloads — follow-ups (review 2026-10-10-pdf-downloads)

| # | Task | Sev | Role | Done when |
|---|---|---|---|---|
| 145 | **Verify PDF downloads on Vercel production** — planner, customer link, admin draft. Function memory ≥ 1 GB; preview deployments need a Deployment Protection bypass | S2 | DevOps | Each of the three downloads a correct file on the live domain |
| 146 | Measure PDF time in production, cold and warm | S3 | DevOps | Numbers recorded; cold < 10 s, warm < 4 s, or the slow step named |
| 147 | Owner click-through: Download draft PDF and Download PDF in /admin/quotations | S3 | You | Draft file shows the draft band; sent file does not |
| 148 | Halve Detailed-quotation PDF size (print photos at 1×, lower quality) | S4 | DevOps | A 7-day Detailed is under 1.5 MB |
| 149 | ~~Print hero image fills its rounded frame (pre-existing `.quote-doc img` max-height rule)~~ — **done 2026-10-11** | S4 | UI/UX | Bottom corners print rounded |
| 150 | ~~Delete the three test quotations in `content/quotations.json` (local file store only)~~ — **done 2026-10-11** | S4 | You | File removed |

## Full check — follow-ups (review 2026-10-11-full-check)

| # | Task | Sev | Role | Done when |
|---|---|---|---|---|
| 151 | **Sent quotation "Spiti Valley — 6 Nights / 7 Days, ex Shimla" (v2) carries a Ladakh day-by-day** (Leh, Nubra, Pangong). Revise it (Create v3) with the right itinerary and tell the customer | **S1** | You | The customer's link shows a Spiti itinerary |
| 152 | **`next dev` with the live database wedges within minutes** (2026-10-11: two requests fine, then every page hangs; seen again with the database healthy, so not only after an outage). `next start` stays healthy, though one cold first request took > 90 s. Add a query timeout / connection health check in `src/db/index.ts` | S3 | DevOps | Kill the DB, restore it — pages recover without restarting the server |
| 153 | Find why some quotations had an itinerary for a different destination (AI draft? library copy?) and stop it at the source | S2 | CTO | A quotation's itinerary cannot disagree with its destination without a warning |

## Full function test — follow-ups (reviews 2026-10-14-full-function-test, 2026-10-14-fixes)

Code items #154–#168 were fixed 2026-10-14 and moved to Done. What is left needs the owner:

| # | Task | Sev | Role | Done when |
|---|---|---|---|---|
| 157 | **Deploy the app to the domain (F9)** — Vercel with production env (incl. `COMPANY_GSTIN`); `www` and `corporate` DNS; then #145/#146 | **S1** | DevOps + You | `www.yaadigo.com/group-tours` serves the trip list, not "Coming Soon" |
| 169 | **Apply migration 0005 to Supabase** (`npm run db:migrate`): `accounts` role, `credit_notes`, invoice SAC/split/state code. Until then Accounts invites fail on Postgres and credit notes cannot be issued | **S1** | You | `select unnest(enum_range(null::role))` lists accounts; a credit note issues on the live DB |
| 170 | **Company GSTIN** — set `COMPANY_GSTIN` on the host (or `REGISTRATION.gstin`); invoices are refused until then (#89) | **S1** | You | Invoices desk shows "Raise invoice" |
| 171 | Check the live DB for invoices issued before 2026-10-14 without GSTIN/SAC; credit-note and re-issue them | S2 | You + Accounts | None left without a GSTIN |
| 162 | Email provider (F10): `RESEND_API_KEY` + verified sender | S2 | You → DevOps | An invite email arrives; a sent quotation emails the customer |
| 172 | Razorpay **test** keys locally, webhook registered in production, one ₹1 real payment end to end (the gateway path now records money on unconfirmed seat requests without moving seats) | S2 | You → DevOps | Ledger shows the ₹1 with its Razorpay id |
| 173 | Have the CA confirm SAC 998555, 5% without ITC, and the place-of-supply default (supplier's state for unregistered customers) | S2 | You | Written confirmation |
| 53 | Second AI provider key — Gemini returned 503 on two models during every test today; the quote draft now times out cleanly instead of hanging | S2 | You | `AI_PROVIDER=groq` set, draft < 30 s |
| 174 | Kashmir Valley Escape: text for days 2–7; confirm `@yaadigo.in` addresses on a `yaadigo.com` site | S4 | You | Done |
| 175 | **Supabase Storage keys for photo uploads** — `SUPABASE_URL` (https://fgffhgstimvluokewukm.supabase.co) + `SUPABASE_SERVICE_ROLE_KEY` on the host; the `media` bucket is created on first upload. Then upload one photo on the live site | **S1** (go-live) | You → DevOps | A photo uploaded on the deployed site shows on a customer quotation |
| 176 | Tick "Quotations" (read) for existing Operations users in Team — the preset now includes it for new ones | S3 | You | Ops opens the register |
| 177 | Decide whether Sales should see the whole-team scorecard in Reports (they hold `reports.read`) | S3 | You | Decided |
| 178 | Record `lostAt` when a lead is marked lost (reports use the last update today) | S4 | DevOps | Lost-in-period counts by the date it was lost |
| 179 | **Live database unreachable**: Supabase answers `tenant/user postgres.fgffhgstimvluokewukm not found` for every query, so every DB page returns 500. Check whether the project is paused or deleted, or the password changed, and update `DATABASE_URL` (review 2026-11-02-for-corporate-tab, F1) | **S1** | You | `/` renders against the real `DATABASE_URL` |
| 180 | If a menu was saved in Admin → Navigation, add "For Corporate" (`/corporate`) to its phone extras. The saved menu overrides the coded one (F2) | S2 | You | Phone menu lists For Corporate on the live DB |
| 181 | Choose one corporate page: `/corporate` (lead form) or `/corporate-travel` (CMS). Redirect the other (F3) | S3 | CTO + You | One corporate URL in the sitemap |
| 182 | Check saved page edits on `/contact` and `/corporate-travel` for "Corporate Travel Desk" and rename them to For Corporate (F4) | S3 | You | No "Corporate Desk" wording on the live site |
| 184 | **Nightly Postgres backups off the VPS**: the database now lives on one machine (docs/deploy-vps.md). Schedule `pg_dump` and copy it to storage on another machine | **S1** | DevOps | A restore from last night's dump works on a scratch database |
| 183 | Fix the failing `trip-seats.test.js` › "the editor cannot shrink a batch below what is booked" (F5) | S2 | DevOps | vitest all green |

## Done

| Task | Finding | Closed |
|---|---|---|
| **"For Corporate" tab**: header, phone menu and footer link to the existing `/corporate` lead page (the subdomain had no DNS, so "For business" went nowhere); segment renamed to For Corporate everywhere a visitor sees it | User request | 2026-11-02 |
| **Media library + quotation register + reports** — photo library with upload (shrunk in the browser, type checked by bytes) and a picker on every image slot in a quotation (cover, hotels, flights, activities, stay/transport galleries, route map); staff preview for drafts (the 404); quotation register with periods, filters, KPIs, charts, CSV, ops read-only; reports rebuilt (any period, like-for-like comparison, funnel, 12-month trend, team scorecard + CSV, sources, destinations, integrity incl. duplicate bookings); More sheet on the phone nav (six sections were unreachable); slim price bar | User request | 2026-10-14 |
| **#154–#168 from the function test**: one booking per lead (quote approval updates the seat request), approval → `requested`, one advance rule (schedule row 1), balance row a remainder; Record a payment + ledger; GST invoices (GSTIN gate, SAC, place of supply, CGST/SGST/IGST, invoice page, credit notes); quote builder defaults, Days label, URL, frozen buttons; seat requests pre-fill the brief; WhatsApp normaliser everywhere; bookings scoped to the salesperson; invoices only for sold bookings; no editor bar in admin; planner reads "N days"; IST day buckets; ended departures leave Upcoming; image quality 78; test timeouts | Function test | 2026-10-14 |
| Found while fixing: board "Advance paid" set paid-in-full with no money; payments and quote merges moved seats without the trip lock; `accounts` missing from the Postgres role enum (migration 0005); Gemini `abortSignal` ignored + no timeout (draft hung 5 min); lite models rejected thinkingBudget 0; seat requests had no salesperson; refunds reopened cancelled bookings; bookings page had no permission check | Fixes review | 2026-10-14 |
| Production build passes against the live database (prerender concurrency); quotation PDFs no longer leave page 1 blank; "Not applicable" slots hidden | Full check | 2026-10-11 |
| PDF downloads without the print dialog — planner itinerary, customer quotation, admin quotation (drafts included) | User request | 2026-10-10 |
| Homepage premium redesign; build type error; no-JS reveal fallback; editor keeps *italic* markers | User request + review | 2026-10-10 |
| **Quotation presentation was silently dropped** — `content` was never a column, so a salesperson choosing the Detailed template sent the Modern one. Fourth instance of this pattern after unitCost, itinerary and revisionOf | Brochure work | 2026-10-08 |
| **Brochure blocks added (#90)** — packing list by destination, stay/transport galleries, route map, declaration, bank + GPay payment options | Brochure work | 2026-10-08 |
| **Email domain was wrong** — site said info@yaadigo.com, the company brochure says .in; every customer reply would have bounced | Brochure audit | 2026-10-05 |
| **Quotation shipped invented policies** — 25/50/25 schedule and a made-up cancellation ladder; replaced with the real ₹5,000 advance and the actual windows | Brochure audit | 2026-10-05 |
| Social video embeds (Instagram/YouTube), click-to-load so no third-party JS until played | Brochure audit | 2026-10-05 |
| Registered address added from the brochure (Kalkaji, New Delhi) | Brochure audit | 2026-10-05 |
| **Yaadi failed 3 requests in 5** — `streamWithTools` had no retry while the planner did; first-turn ladder added, now 4/5 | System audit | 2026-10-05 |
| **Homepage 9.6s → 2.5s** — 56 `<Editable>` fields each made their own DB round trip at 414ms; `getOverrides`, `getTrips`, `getNavigation` now request-cached | System audit | 2026-10-05 |
| **One-question homepage (#37)** — a single input above the fold, straight into the planner with the destination filled in | Growth plan | 2026-10-05 |
| **Voice input (#38)** — Web Speech API on en-IN, transcript always shown and editable, mic hidden where unsupported | Growth plan | 2026-10-05 |
| **Card art editable (#72)** — resolved server-side in the catalogue, so client-side listings can still render an admin-chosen photo; 34 cards selectable | Editor coverage | 2026-10-05 |
| **Body copy wrapped on every public page (#73)** — contact, corporate, customised, group tours | Editor coverage | 2026-10-05 |
| **Page-editor content on Postgres** — `store.js` wrote with fs.writeFile, bypassing the record layer; every text edit would have been lost on a serverless deploy | File store | 2026-10-05 |
| **Stale `content/*.json` removed (#83)** — files had diverged from Postgres (6 leads on disk, 1 in the database); the no-DB path remains for local work | File store | 2026-10-05 |
| `describeStorage()` now asks the record layer instead of assuming a file | File store | 2026-10-05 |
| **Catalogue, pages, menu and interests on Postgres (#32)** — new `documents` table; they were in content/*.json, which a serverless deploy discards | Data layer | 2026-10-04 |
| **Quotation arithmetic exact to the paisa (#31, scoped)** — measured drift was sub-paisa on fractional inputs, so the fix is at the multiply/sum, not a bigint rewrite | Data layer | 2026-10-04 |
| `npm run db:apply` — applies a migration and reports what landed, after drizzle-kit once applied nothing and exited 0 | Data layer | 2026-10-04 |
| **Revision chain persists (#13)** — `revisionOf` had no column and was silently dropped; migration applied and verified | Revision work | 2026-10-03 |
| **Discard an unsent draft (#13)** — the error message said "finish or discard it" and no discard existed, so a stale draft blocked every future quotation on a lead | Revision work | 2026-10-03 |
| **Outbox retry worker (#11)** — exponential backoff, 6 attempts, distinct `abandoned` state; pending messages wait for a provider without burning attempts | Outbox work | 2026-10-03 |
| **Ask Yaadi captures demand (#57)** — `capture_interest` tool, interests kept off the leads board, promoted to a real lead when a contact is added | Lead leak | 2026-10-03 |
| Lead value now reads a conversational budget ("30000 each", "2 lakh total") — band lookup still wins, caught by an existing test | #57 work | 2026-10-03 |
| **Nested containers (#77)** — Band and Columns with Puck slots; columns always stack on a phone | Builder tranche 4 | 2026-10-03 |
| **About / contact / corporate-travel buildable (#78)** — one shared page-shell, so a new buildable page is two lines | Builder tranche 4 | 2026-10-03 |
| **Footer columns editable (#79b)** — rename, reorder, add, remove; independent of the menu | Builder tranche 4 | 2026-10-03 |
| **Mobile preview in the builder (#81)** — 360/768/1280 viewports, iframe canvas so breakpoints resolve honestly; phone is the default | Builder tranche 3 | 2026-10-03 |
| **Menu editor (#79)** — drag to reorder, rename, add, remove; coded menu is the fallback and one button returns to it | Builder tranche 3 | 2026-10-03 |
| **Real YaadiGo sections as blocks (#76)** — Hero/NeuralField, live trip rail, proof panel, banner; live data via Puck metadata, not baked into the layout | Builder tranche 2 | 2026-10-03 |
| **Visual image picker (#80)** — thumbnail grid with search, replacing the slug text box | Builder tranche 2 | 2026-10-03 |
| Built pages render through `@measured/puck/rsc` — visitors never download the editor | Builder tranche 2 | 2026-10-03 |
| **Visual page builder, tranche 1 (Puck)** — drag-and-drop blocks, draft/publish/revert, constrained size steps | User decision | 2026-10-02 |
| uuid vuln from Puck pinned via npm override rather than downgrading | Builder work | 2026-10-02 |
| **Editor coverage (#71, #73)** — homepage 8 to 45 fields; about 0 to 17; heroes and headings wrapped on every public page | User report | 2026-10-01 |
| Route transitions + scroll progress — the first visible motion on the site | User report | 2026-10-01 |
| **template.js shipped every page with opacity:0** — whole site invisible without JS; caught and fixed | Self-review | 2026-10-01 |
| **Public bottom bar + WhatsApp + Yaadi rendered on the CRM too** — two nav bars at once on a phone | User report | 2026-10-01 |
| **Editor image control was unreachable** — Inspector had the field; nothing ever emitted `data-cms-kind="image"` | User report | 2026-10-01 |
| Itinerary arrival animated — days no longer jolt the column as each replaces a skeleton | Motion plan | 2026-10-01 |
| Filtered catalogue animates with `layout`; SSR-invisible-cards regression caught and fixed | Motion plan | 2026-10-01 |
| **SLA escalation on untouched leads (#63)** — business-hours aware, nudge at 4h, escalate at a working day, each sent once | Sales gap analysis | 2026-10-01 |
| **Payment-link button on the booking screen (#69)** — generates, then hands over a pre-written WhatsApp message | Sales gap analysis | 2026-10-01 |
| Cron runs both jobs independently — one failing no longer cancels the other | SLA work | 2026-10-01 |
| **SMTP email delivery implemented** — nodemailer, pooled, sends from info@yaadigo.com; the SMTP_URL branch used to throw | Email enabled | 2026-10-01 |
| **Structured call outcomes (#59)** — six outcomes, each setting the next follow-up; wrong-number clears it | Sales gap analysis | 2026-10-01 |
| **Message templates (#61)** — ten stage-aware wa.me/mailto templates, no Business API needed | Sales gap analysis | 2026-10-01 |
| wa.me dropped India trunk-prefix numbers (098765…) — caught by its own test | Template tests | 2026-10-01 |
| **Razorpay payment links + webhook (#58)** — signature verified, replay-safe, live-key guard; booking auto-advanced to part-paid | Sales gap analysis | 2026-10-01 |
| **Duplicate lead detection (#60)** — phone across formats, email case-insensitive, 90-day window, open leads only | Sales gap analysis | 2026-10-01 |
| **Estimated lead value at capture (#62)** — budget band × pax, null when unstated | Sales gap analysis | 2026-10-01 |
| `SMTP_URL` no longer reported as a configured email provider (#65) | Sales gap analysis | 2026-10-01 |
| **CRM layer is testable** — `server-only` aliased in vitest; 13 tests over lead capture, the first on this layer | Coverage gap | 2026-10-01 |
| Workflow charts + feature matrix per team | Requested | 2026-10-01 |
| **Every AI quotation priced ~2× too high** — `quantity` undocumented, so the model put the headcount there and it was multiplied again | Quotation review | 2026-10-01 |
| **Quotations carried no day-by-day plan** — templates rendered one, the AI drafter never produced one | Quotation review | 2026-10-01 |
| AI ignored our published prices (1.8× over); anchor drift now checked and flagged | Quotation review | 2026-10-01 |
| `itinerary` declared on the API DraftSchema — zod would have stripped it, like `unitCost` before it | Quotation review | 2026-10-01 |
| `grounding` returned by the draft route instead of discarded | Quotation review | 2026-10-01 |
| Phone + WhatsApp live site-wide (+91 73737 34778), `info@yaadigo.com` as enquiry address | User supplied | 2026-10-01 |
| **Approving a quotation always 500'd — booking never created** (`actor` undefined) | E2E test | 2026-10-01 |
| **AI quotation builder rejected by Gemini on every request** (unsupported JSON Schema keywords) | E2E test | 2026-10-01 |
| `no-undef` enabled in eslint — the rule that would have caught the above | E2E test | 2026-10-01 |
| **AI planner dead — 3 stacked faults** (wrong model masked as 503, free-tier stream truncation, per-model quota) | AI review | 2026-09-30 |
| Homepage h1 sold three businesses in one sentence | Content pass | 2026-09-30 |
| Three unverifiable homepage stats, one of them wrong | Content pass | 2026-09-30 |
| No social proof anywhere; `Testimonials` + `TrustStrip` imported by no page | Content pass | 2026-09-30 |
| Only 3 blog posts, 2 of them B2B — 5 decision-query posts added | Content pass | 2026-09-30 |
| Post renderer supported flat paragraphs only; FAQPage schema added (part of #19) | Content pass | 2026-09-30 |
| **CRM live on Supabase (#8)** — data-loss risk closed | Sprint 2 | 2026-09-30 |
| `max: 1` hung every admin page on a long-running server | Live failure | 2026-09-30 |
| `drizzle-kit migrate` exited clean applying nothing | Live failure | 2026-09-30 |
| Doctor rejected the correct session-pooler URL | Live failure | 2026-09-30 |
| An "optimisation" that made /admin slower, reverted | Measurement | 2026-09-30 |
| Accounts role; invoice gated behind `invoices.write` (#104) | Team operating model §1.4 | 2026-10-09 |
| `/admin/invoices` desk — the accounts role had nowhere to work | Team operating model §1.4 | 2026-10-09 |
| Trip brief wired into the AI quotation prompt (#103) | Team operating model §7 | 2026-10-09 |
| One-tap "Draft quotation" from a lead (#103) | Team operating model §2.2 | 2026-10-09 |
| Structured brief: dates, adults/children-with-ages, rooms, meal plan (#102) | Team operating model §6 | 2026-10-09 |
| `childBand(null)` banded a missing age as *infant* — the cheapest band | Caught by new tests | 2026-10-09 |
| `FAQPage` on group-tour pages — FAQ was visible but unmarked (#19) | Backlog reconciliation | 2026-10-08 |
| og:image on trip + blog pages — shares were a grey box | SEO audit A1 | 2026-10-08 |
| `TouristTrip` + `Offer` on 13 customized-tour pages | SEO audit B1 | 2026-10-08 |
| `/llms.txt` + explicit crawler policy in `robots.txt` | SEO audit A2, A3 | 2026-10-08 |
| `ItemList` on both listing pages; `/manifest.webmanifest` | SEO audit C1, C4 | 2026-10-08 |
| Thin titles/descriptions on `/blog`, `/about`, `/contact`, `/` | SEO audit B2 | 2026-10-08 |
| Banner block read `/media/<id>.jpg` by hand — would 404 on any PNG | SEO audit B4 | 2026-10-08 |
| `formattedAddress()` documented as a string, returns an array | Found while writing llms.txt | 2026-10-08 |
| `eslint-disable-next-line` that never reached its `<img>` | Lint, social-video.js | 2026-10-08 |
| Quotation templates — simple / modern / detailed | User request | 2026-09-29 |
| Quote follow-up automation + Chase bucket (#14) | Sprint 3 | 2026-09-29 |
| Reminders catch up on age, so nothing goes cold unchased | CTO review | 2026-09-29 |
| Booking statuses: one source of truth (#7) — part-paid was unreachable | CTO review | 2026-09-29 |
| Quotation revision flow (#29) | Error message promised it, nothing did it | 2026-09-29 |
| A bad DATABASE_URL now explains itself instead of a bare 500 | Live failure | 2026-09-29 |
| Schema revised against reality — every table had drifted | CTO review | 2026-09-29 |
| Postgres repository; modules unchanged (#9, #10) | Sprint 2 | 2026-09-29 |
| Invoice uniqueness enforced by the database | CTO review | 2026-09-29 |
| Sales workspace — My day, follow-ups (#23) | lead-workspace spec | 2026-09-28 |
| Lead filters, URL-persisted (#24) | lead-workspace spec | 2026-09-28 |
| Lead detail page (#4) | Full-system review | 2026-09-28 |
| All seven lead stages settable (#5) | Full-system review | 2026-09-28 |
| Lead transfer with mandatory reason (#25) | lead-workspace spec | 2026-09-28 |
| Payments — stage follows the ledger (#6, #26) | Full-system review | 2026-09-28 |
| Invoicing, sequential + immutable (#27) | lead-workspace spec | 2026-09-28 |
| Unassigned leads: list/detail scope drift | CTO review | 2026-09-28 |
| Operations board + service list (#2, S1) | Full-system review | 2026-09-28 |
| Hand to operations (#3, S1) | Full-system review | 2026-09-28 |
| Nav/page permission drift on Ops | CTO review | 2026-09-28 |
| Undated bookings invisible on the ops board | CTO review | 2026-09-28 |
| Test DB boots once per file, not per test (73s → 17s) | CI failure | 2026-09-28 |
| Notification bell + panel (#1, S1) | Full-system review | 2026-09-28 |
| Approved quotation creates a booking | Reconciliation, 2026-09-27 | 2026-09-28 |
| `unitCost` accepted by the API (was silently dropped) | Testing with real numbers | 2026-09-28 |
| Unknown margin reports `null`, not 100% | CTO review | 2026-09-28 |
| Every lead gets an owner (admin fallback) | Reconciliation | 2026-09-28 |
| Team page built; nav is permission-driven | User report | 2026-09-27 |
| `/admin/login` redirect loop | Route warming | 2026-09-27 |
| Conversation jam after a failed AI turn | User screenshot | 2026-09-26 |
