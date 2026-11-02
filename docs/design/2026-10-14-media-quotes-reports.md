# Media library, quotation register, reports — and the admin papercuts

**Asked for (2026-10-14):** a gallery of hotel / trip / activity images to pick
or upload instead of pasting links; the "Preview what the customer sees" 404;
a register of every quotation sent (visible to ops and admin) with daily /
weekly / monthly counts and value; a proper report system for sales
performance and business growth; Trips not visible in the admin; the sticky
price bar hiding the form; "easy to operate for admin, sales, ops".

## Root causes found before designing

| Complaint | Cause |
|---|---|
| Preview 404 | The link opens the customer URL `/q/<token>`, which deliberately refuses drafts — and drafts are when a salesperson previews. |
| Trips not visible | Below 1024 px the panel shows five bottom tabs. The nav comment promises "the More sheet"; it was never built. Trips, Departures, Pages, Invoices, Reports and Team are unreachable on a phone or a narrow window. |
| Image links only | No object storage was configured, so the editor said "paste a link". The renderer already accepts a library id **or** a URL on hero, hotels, flights, highlights, stay/transport galleries and the route map. |
| Highlights could not be saved | `setPresentation` did not whitelist `highlights`. |
| Price bar | The builder's whole totals card is `sticky bottom-0`; on a phone it covers half the screen. |

## CTO — decisions

**Storage adapter (`src/lib/media-store.js`).** Supabase Storage (REST, no new
dependency) when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set — a
public bucket `media` (created on first upload). Otherwise the local disk
(`uploads/` at the project root, served by `/api/media/file/...`), with the
same "not durable on serverless" warning the record store shows. Supabase was
chosen at the architecture stage partly for this (memory: yaadigo-architecture).

**Records.** `mediaLibrary` document collection (Postgres `documents`, no
migration): `{ id, storagePath, url, width, height, bytes, title, alt,
category, tags[], destination, archived, uploadedById, uploadedByName }`.
Categories: `hotel · destination · activity · transport · flight · map ·
other`. The 36 built-in site photos are listed alongside as read-only
"Website photos".

**Uploads.** Downscaled in the browser to ≤ 2000 px, JPEG 0.82 (a phone photo
is 4–12 MB; Vercel's request limit is 4.5 MB). The server checks the magic
bytes (JPEG/PNG/WebP), refuses > 4 MB, and never trusts the file name. HEIC is
refused with an instruction (browsers cannot decode it to canvas).

**How a quote refers to an image.** A built-in photo is stored as its id (as
today); an uploaded one as its URL plus `mediaId`. The renderer needs no
change and the PDF needs no lookup — a quotation keeps rendering even if the
image is later archived. Archive, never delete: a sent quotation may show it.

**Permissions.** Viewing the library: any staff. Uploading / editing:
`quotations.write`, `catalogue.write` or `content.write`. Ops gets
`quotations.read` in its preset (read-only register, no margins; existing ops
users get it from Team).

**Register and reports read records + the event log** exactly as reports
already do: "what happened" from events (`quotation.sent` carries amount and
owner at the time), "how it stands" from records. Periods are IST.

## UI/UX

- **More sheet** on the phone bar: a sixth "More" tab opening a bottom sheet
  with every other section the person can open. Sidebar unchanged.
- **Media page** `/admin/media`: upload zone (drag-drop or tap, many at once,
  per-file progress/error), category chips, search, grid; tap a photo to edit
  title/alt/category/tags or archive. Empty, uploading, error, not-durable
  states.
- **Picker** (modal, used everywhere an image goes in a quotation): tabs by
  category, search, "Upload new" inline, select one or many; "or paste a link"
  kept behind a disclosure. Shows the current image with Change / Remove.
- **Presentation editor** gains: hotel/flight images via picker, a
  **Highlights / activities** editor (title, one line, image), **stay photos**
  and **transport photos** galleries, **route map**.
- **Preview**: `/admin/quotations/[id]/preview` — the customer document with a
  "Preview — draft, not sent" band; no approve buttons. Works for any status.
- **Price bar**: one slim sticky line (total · per person · margin) with
  Save / Send; the breakdown opens on tap. The bar never covers more than
  64 px.
- **Register** (`/admin/quotations`): period chips (Today · 7 days · 30 days ·
  This month · Last month · Custom), status and salesperson filters, search
  (customer, phone, destination, title); KPI row (sent n / ₹, approved n / ₹,
  conversion, average quote, awaiting decision ₹); one-series bar chart of
  value sent per day / week / month; table: customer, trip, v, status, value,
  sent, valid until, salesperson, link. CSV export.
- **Reports**: period picker + previous-period comparison (▲▼ %), funnel,
  12-month trend (small multiples: enquiries, quotes ₹, bookings ₹, collected
  ₹), sales scorecard (assigned, median first response, quotes n/₹, approved,
  booked ₹, collected ₹, win rate, average deal, target %), source and
  destination tables, lost reasons, CSV export, integrity check kept.

## PM — acceptance criteria

1. On a 375 px screen every section a person may open is reachable in ≤ 2 taps.
2. Upload 3 phone photos → they appear in the library under the chosen
   category and can be picked as a hotel image, a highlight image and a stay
   photo; the customer page and PDF show them.
3. Preview opens for a draft and for a sent quote; the customer link for a
   draft still 404s.
4. Register: "7 days" shows only quotes sent in the last 7 IST days, KPI sums
   equal the table; ops sees it without cost/margin; CSV matches the table.
5. Reports: changing the period changes every figure; comparison shows the
   previous equal period; per-person rows sum to the headline.
6. Price bar ≤ 64 px collapsed; nothing in the form is unreachable.
7. Tests for storage validation, period maths, register aggregation, report
   aggregation; vitest, eslint, next build clean.

## Needs the owner

`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` on the host, or uploads stay on
the local disk (fine for a long-lived server, lost on Vercel).
