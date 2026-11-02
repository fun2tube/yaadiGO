# Trip management — one system for trips, departures and sharing

**Date:** 2026-10-10 · **Roles:** CTO → UI/UX → PM · **Status:** approved 2026-10-10 · phases 0 and 1 built (see §8)
**Asked for:** manage fixed departures end to end (add, edit, delete, dates,
inventory, price, itinerary, images, downloadable PDFs, sales sharing);
manage customized trips the same way; let customer-built itineraries and
day-wise quotations become trips, so the website updates regularly. "Don't be
biased to my plan — plan the best way to run the business."

---

## 1 · What exists today (read from the code, not assumed)

| Piece | Where it lives | What an admin can do |
|---|---|---|
| 14 group tours | `src/lib/tours.js` — **a code file** | Edit title, note, duration, group size, advance, published, departures (dates, price, seats). **Cannot** add a trip, delete one, or edit itinerary, inclusions, exclusions, FAQ, pickups, sharing prices. |
| 20 customized trips | `src/lib/packages.js` — **a code file** | Edit title, note, destination, duration, from-price, best time, ideal-for. **Cannot** add, delete, or edit itinerary/highlights/inclusions. |
| Seat counts | JSON overrides in the `documents` table (`tripOverrides`) | Changed by booking status moves (`lib/cms/bookings.js`) **and** by the trip editor. |
| A proper `departures` table | `src/db/schema.ts` with `CHECK (seats_left >= 0)` and a tested `confirmBookingWithSeats()` | **Unused.** Nothing in the app reads or writes it. |
| Quotation library ("templates") | `quotationTemplates` records — itinerary, hotels, lines, inclusions | Save a quotation as reusable; start a new quote from it; ranked suggestions per lead. Internal only — never reaches the website. |
| AI planner itineraries | Saved on the lead (`leads.itinerary`) | Visible to sales; never becomes a trip. |
| Shareable quotation | `/q/[token]` with print → PDF | Per-customer quote only. No share link for a **trip**. |
| Images | `src/lib/media.js` — **a code file** + per-card override | No upload. Adding a photo means a developer. |
| PDFs | Browser "print to PDF" on quotations | No trip brochure, no uploaded PDFs, no file storage. |

### The honest verdict

The admin today is an **override layer on top of a catalogue that lives in
code**. That was right for launch — trips got reviewed in git. It is wrong for
a business that adds and changes trips every week, because every new trip
needs a developer.

## 2 · Problems found while reading — before any new feature

| # | Problem | Severity | Repro |
|---|---|---|---|
| P1 | **The trip editor can silently undo bookings.** It loads seat counts when the page opens and writes them all back on Save. If a booking is confirmed in between, Save puts the seats back — the batch can be sold twice. | **S1** | Open `/admin/trips` → in another tab confirm a booking on that batch (seats 4→2) → back in the editor change a price → Save → seats are 4 again |
| P2 | **Two inventory systems.** The safe one (`departures` table, database-enforced) is unused; the live one is a JSON field. | S2 | `grep -r confirmBookingWithSeats src` → only its own test |
| P3 | **Three names for one idea.** Group tour (code), package (code) and quotation template (database) all describe "a trip with an itinerary" — in three shapes that cannot talk to each other. | S2 | A salesperson's best Spiti quote cannot appear on the Spiti trip page |
| P4 | **No delete, no archive, no history.** A trip that stops running can only be unpublished; nothing records what a booked customer was sold if the itinerary later changes. | S3 | Edit Kashmir's day 3 after a booking — the customer's copy changes too |
| P5 | **Seat count is entered, not derived.** Editors type "seats left". It should be *total − booked − held*, computed. | S2 | Same as P1 |

**P1 should be fixed this week regardless of what else is approved.** It is
small (the editor stops sending seat counts; seats change only through
bookings and an explicit "adjust capacity" action) and it guards money.

---

## 3 · Your plan, criticised

You asked for this directly, so here it is. Most of the plan is right; four
parts would cause trouble as stated.

| You proposed | Keep / change | Why |
|---|---|---|
| Add, edit, delete trips; dates, price, inventory, itinerary, images | **Keep** | This is the core gap. |
| **Delete** trips | **Change → Archive** | A trip with bookings, invoices or Google rankings must never vanish. Archive hides it, keeps history, and 301-redirects its URL to the closest live trip. Hard delete only for drafts that were never published. |
| PDFs to download | **Keep, but generate them** | A PDF typed separately from the web page goes stale the day a price changes. Generate the brochure *from* the trip data; allow an uploaded PDF only for extras (visa checklist, packing list). |
| Sales share the same itinerary | **Keep and extend** | Share links should carry *who shared them*, show live seats, and open a WhatsApp message ready to send. That turns sharing into attributed leads. |
| Customer-built AI itineraries become trips | **Change** | AI itineraries are unchecked (wrong timings, closed roads, invented hotels). Publishing them puts our name on promises nobody verified. They should become **leads with a draft attached** — which already happens — and reach the website only through the quotation path below. |
| Every day-wise quotation can be published as a trip | **Change → "Propose as trip", with review** | Quotations carry customer names, dates, negotiated prices and one-off hotels. Publishing them directly leaks data, and 40 near-identical "Kashmir 5N" pages hurt Google (duplicate content) and confuse customers. Instead: one click strips the customer data, checks for an existing trip on the same route, and creates a **draft** that an admin approves. Best of all: promote quotes **after the trip has actually run** — "based on a trip we ran in October" is the strongest proof we can show. |
| Website should update regularly | **Keep, automate it** | Freshness should come from *departures* (new dates, seats selling, "filling fast", new season), not from adding pages. Departures that pass their cut-off should close themselves. |

## 4 · The recommended design

### 4.1 One "Trip", two kinds, three visibility levels

Replace tours.js + packages.js + quotation templates with a single **Trip**:

```
Trip
 ├─ kind:        group | customized
 ├─ status:      draft → internal → published → archived
 │                (internal = sales library only, never on the website)
 ├─ content:     title, route, region, theme, occasions, duration,
 │               summary, highlights, day-by-day itinerary, inclusions,
 │               exclusions, FAQ, know-before, terms
 ├─ media:       cover photo, gallery, attachments (PDFs)
 ├─ pricing:     group → per departure · customized → "from ₹" + quote lines
 ├─ source:      manual | quotation | planner | imported   (+ link back)
 └─ versions:    every publish saves a snapshot; bookings point at one
```

- **The quotation library becomes Trips with status `internal`.** One library
  for the website and the sales desk; nothing is maintained twice.
- **Versioning** solves P4: a booking stores the trip version it was sold on,
  so editing day 3 changes the website, not what Mr Sharma bought. The admin
  is told "4 booked customers are on the old version — notify them?"

### 4.2 Departures and inventory (group trips only)

One source of truth: the existing **`departures` table**, extended.

| Field | Purpose |
|---|---|
| start, end, price per person, early-bird price + date | Pricing per batch |
| capacity (total seats), **booked and held are computed** | Seats left = capacity − booked − active holds. Never typed. |
| minimum to run, status: open · filling · **guaranteed** · closed · sold out · cancelled · completed | "Guaranteed departure" once the minimum books — a strong selling point |
| booking cut-off (e.g. 7 days before) | Auto-close; no last-minute sales nobody can operate |
| pickup and sharing price deltas | Already exist in code; move here per trip |
| trip leader, vehicle, hotel room blocks | For operations |

New behaviour:
- **Seat holds** — a salesperson holds 2 seats for a lead for 48 hours; the
  website counts them as taken; they release themselves if not confirmed.
- **Waitlist** — a sold-out batch takes names; a cancellation offers the seat
  to the first in line.
- **Manifest** — per departure: travellers, rooming, pickup point, payments
  due. Printable for the trip leader.
- All seat changes go through `confirmBookingWithSeats()` (already written and
  tested, enforced by the database).

### 4.3 How a trip gets created — four doors, one review

```
 1. Admin writes it        ─┐
 2. Duplicate a trip        ├─→  DRAFT  →  review  →  PUBLISHED
 3. Quotation → "Propose"   │     (admin or     (website + sales library)
 4. AI planner → lead → quote ┘     content lead)
                                    └─→ INTERNAL (sales library only)
```

- **Door 3** strips name, phone, dates and negotiated prices automatically,
  and warns "a published trip already covers Srinagar · Gulmarg · Pahalgam —
  update that one instead?" Duplicates are the main risk; this check is the
  main defence.
- **Door 4** never publishes directly. The customer's AI plan lands on the
  lead, sales turns it into a quote, and door 3 applies.
- After a trip **operates**, ops can attach real photos and a short note, and
  publish it with a "We ran this in Oct 2026" badge. Over time this replaces
  stock photography with proof.

### 4.4 Sharing kit for sales

On every trip and every departure, a **Share** button gives:

1. A link with the salesperson in it — `yaadigo.com/t/kashmir?by=priya` —
   so any enquiry from it is auto-assigned to Priya and counted for her.
2. A ready WhatsApp message: trip, next dates, **live** seats, price, link.
3. A **PDF brochure** generated from the trip (itinerary, inclusions, dates,
   prices, salesperson's name and number on the cover).
4. "Quote this for a customer" — opens a quotation pre-filled from the trip
   (this already exists as `applyTemplate`; it gets pointed at Trips).
5. For group trips: "Hold seats for this lead" (see 4.2).

### 4.5 Who does what

| Role | Trips | Departures | Publish | Share / hold |
|---|---|---|---|---|
| Admin | Create, edit, archive | All | Yes | Yes |
| Content / product lead | Create, edit | View | Yes | Yes |
| Operations | Add photos after a trip | Capacity, leader, manifest, close | No | No |
| Sales | Propose from a quotation | View, hold seats | No | Yes |

Checked on the server per action, like every other module.

### 4.6 What the customer sees (unchanged URLs)

- Trip pages read from the database instead of code — same URLs, same layout.
- Live seats, "guaranteed" and "filling fast" badges, waitlist button on
  sold-out batches, "Download itinerary (PDF)" on every trip.
- Archived trips redirect; nothing 404s.

---

## 5 · Screens (UI/UX)

Mobile-first, because the desk works from phones (`DESIGN-SYSTEM.md`).

1. **Trips list** — filter by kind and status; each row shows next departure,
   seats left, last edited, source. Empty: "No trips yet — create one or
   propose one from a quotation."
2. **Trip editor** — tabs: *Overview · Itinerary · Inclusions · Media · Departures
   (group only) · SEO · History*. The itinerary is a day list: add, reorder,
   duplicate a day. Autosaved draft; **Publish** is a deliberate button that
   shows what changed and who is affected.
3. **Departures board** — every batch across all trips, calendar or list,
   colour by status. Tap a batch → seats, holds, waitlist, manifest.
4. **Review queue** — proposed trips waiting for approval, side by side with
   the closest existing trip.
5. **Share sheet** — the five actions in 4.4, one tap each.

Every screen covers empty, loading, error and "no permission" states.

---

## 6 · Delivery plan (PM)

Ordered by what protects money first, then what saves the most staff time.

| Phase | What | Done when | Size |
|---|---|---|---|
| **0 — now** | Fix P1: the editor stops writing seat counts; seats move only through bookings and an explicit capacity change | The repro in §2 leaves seats correct; a test covers it | ~1 day |
| **1** | Trips in the database (`trips`, `trip_versions`), seeded from `tours.js` and `packages.js`; website reads the database; full trip editor including itinerary; archive with redirect | An admin creates a new trip from a phone and it is live with no developer | ~1.5 weeks |
| **2** | Departures on the `departures` table; computed seats; holds; waitlist; cut-offs; departures board; manifest | Two simultaneous bookings on the last seat → exactly one succeeds | ~1.5 weeks |
| **3** | Media upload (Supabase Storage — also backlog #33), generated PDF brochure, uploaded attachments | A new trip gets photos and a downloadable PDF with no developer | ~1 week |
| **4** | Share kit with attribution; quote-from-trip; quotation library merged into Trips | A shared link's enquiry lands assigned to the sharer | ~1 week |
| **5** | Propose-from-quotation with duplicate check and review queue; "ran this trip" publishing from operations | A quote becomes a reviewed, published trip in under 5 minutes, with no customer data on it | ~1 week |

Each phase goes through this project's full cycle (UI/UX → PM → DevOps → PM
review → CTO review) and is not "done" until it is reachable from the admin
navigation, permission-checked on the server, and tested on a running server.

## 7 · Decisions needed from the owner

1. Approve **archive instead of delete** for anything ever published?
2. Approve **review before publish** for trips proposed from quotations?
3. Who reviews — you only, or a named content lead?
4. Seat-hold length for sales (suggested **48 hours**) and booking cut-off
   (suggested **7 days** before departure)?
5. Start with **Phase 0 + 1** now?

---

## 8 · Build notes — phases 0 and 1 (2026-10-10)

**Owner decisions:** archive instead of delete; review before publishing
quotation-sourced trips (reviewers = anyone with `catalogue.write` for now);
48-hour seat holds and a 7-day cut-off (phase 2); start with phases 0 + 1.

### Phase 0 — the editor can no longer undo bookings (#130)

- The editor now sends the seat count it loaded (`seatsLeftWas`) with the
  one typed; the server applies only the **difference**, inside the row lock,
  to the live count (`lib/cms/departure-edits.js`).
- A batch with confirmed travellers cannot be removed from the editor.
- Tests: `departure-edits.test.js` (7 rules) and `trip-seats.test.js` (the
  original repro, end to end). The repro test was run against the old
  behaviour and **failed**, then passed with the fix.

### Found while building — a worse, older defect (S1, fixed)

**`mutateBy` did not work on Postgres for document records.** It looked for
a `slug` column that documents do not have, so the SQL was `where  = $1`
and every call threw. Seat moves use it — so **confirming a group-tour
booking on the live database has been failing**. Earlier tests replaced
storage with a stand-in, which is why nothing caught it. Fixed in
`db/repository.ts` (find by `documents.key`, merge into `data`), with a
real-Postgres test (`db/documents-mutate.test.ts`, PGlite) that failed
before the fix and passes after.

### Phase 1 — trips managed in the admin (#131)

- **Storage:** `trips` and `tripVersions` document collections — no
  database migration needed. Coded trips are copy-on-write: they keep
  rendering from code until first edited here.
- **Lifecycle:** draft → publish to website / to sales only → archive (with
  a 301 to another trip or listing) → restore (as sales-only). Delete only
  for never-published drafts. Every publish stores a version.
- **Editor** (`/admin/trips/[slug]`): Overview, Itinerary (add, reorder,
  duplicate days), Inclusions & FAQ, Photo (cover from the media library),
  Departures (the booking-safe panel), History. Save never changes the
  website; Publish checks the trip is complete enough to sell first.
- **List** (`/admin/trips`): both kinds, filters, search, "+ New trip".
  The old "Places" screen redirects here.
- **Website:** listings, trip pages, metadata, nav, sitemap, `llms.txt` and
  the AI concierge all read the merged catalogue, so a trip created in the
  admin appears everywhere once published.
- **Tests:** `trips.test.js` (14 lifecycle cases), panel render tests for
  the list and both editor kinds. 334 tests in total, lint clean.

### Not verified, and why

The admin screens were **not clicked through in a browser**: signing in
needs the owner's real admin password, and the local site writes to the
live Supabase database, so a test trip would land in production. Covered
instead by render tests and lifecycle tests. **Owner to click through**
(PM review step) before this is called done.

### Deferred to phase 2

- Bookings do not yet store the trip version they were sold on — `bookings`
  is a real table and needs a migration for the column.
- Share-card images (`opengraph-image.js`) still read the code catalogue on
  purpose (crawler-facing, avoids a database call); a trip created in the
  admin gets the generic share card until that is revisited.
- The concierge's theme filter lists themes from code; a brand-new theme is
  searchable by text but not by the theme filter.
- No photo upload yet (phase 3); the cover is chosen from existing photos.
