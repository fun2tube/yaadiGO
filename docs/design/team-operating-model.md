# The team operating model — who does what, and what the system enforces

**Date:** 2026-10-09 · **Supersedes:** the role sections of `workflows.md` and the
status columns in `feature-matrix.md`, both of which are now stale
**Audience:** super admin, sales, operations, accounts

Status words used throughout, and they are honest:

- **BUILT** — exercised against the running system
- **PARTIAL** — exists, with the gap named
- **MISSING** — does not exist

---

## 0 · The one rule

> **Sales owns the customer until the money is in. Operations owns the trip from
> the money until they come home. Accounts owns the paperwork that proves both.
> The super admin owns none of it and sees all of it.**

Every permission below follows from that sentence. Where a rule is enforced in
code it says so; where it is only a convention, that is a gap, because a
convention is a thing people stop doing in a busy week.

---

## 1 · Roles

Today there are **four** roles in `src/lib/crm/schema.js`: `admin`, `sales`,
`ops`, `manager`. Your description needs a **fifth — Accounts** — which does not
exist. Invoices are currently issuable by anyone with `bookings.write`, which
means every salesperson can raise a tax invoice. That is the single biggest
control weakness in the current setup.

Roles are **presets, not cages**: a role seeds permissions at invite time and the
super admin can tick individual modules afterwards. Permissions are stored
per-person, so changing a preset later cannot silently widen access for people
already approved. That design is BUILT and worth keeping.

### 1.1 Super admin

Sees everything, does everything. The only role that can:

| Capability | Status |
|---|---|
| Invite, approve, suspend staff; set permissions per person | BUILT |
| Set monthly sales targets (`monthly_target_paise`) | BUILT |
| Edit the public website and page layouts | BUILT |
| Edit the trip and destination catalogue | BUILT |
| See margin and cost on every quotation | BUILT |
| Reassign any lead or booking | BUILT |
| **Void or credit-note an invoice** | MISSING — invoices are immutable with no reversal path |
| **Set a discount floor that sales cannot cross** | MISSING |

### 1.2 Sales

Owns the customer from enquiry to paid. Sees **their own pipeline plus
unassigned leads** — scope is enforced in the API, not the UI, so editing the
query string changes nothing. BUILT.

**Working the queue**

| Capability | Status |
|---|---|
| My Day — due today, overdue, chase list | BUILT |
| New lead due today; owner auto-assigned by lightest pipeline | BUILT |
| Filters: date, stage, payment-pending, source, free text | BUILT |
| Transfer a lead, reason required | BUILT |
| SLA escalation — nudge at 4 business hours, escalate at 8 | BUILT (`lib/crm/sla.js`, business-hours aware, 09:00–19:00 IST) |
| Stage-aware WhatsApp and email templates, pre-filled | BUILT (`lib/crm/messages.js`, ten templates) |
| `LOST` cannot be set without a reason from a list | BUILT |
| **Duplicate detection on phone/email** | PARTIAL — dedup exists at capture; two salespeople can still work the same human if they typed the number differently |

**Capturing the brief** — this is where your 2-minute quotation lives or dies

The lead table today holds: `name, phone, email, destination, dates, groupSize,
budget, interests, message, itinerary, source`.

Your list was: *departure date, budget, hotel category, transport, meal plan,
number of people*. Against that:

| Field | Status |
|---|---|
| Number of people (`groupSize`) | BUILT |
| Budget (`budget`) | BUILT — free text band, not a number |
| Destination | BUILT |
| **Date of departure** | PARTIAL — `dates` is free text ("mid-June, flexible"). Not sortable, not filterable, cannot drive a reminder |
| **Hotel category** (3★/4★/5★/homestay) | MISSING |
| **Meal plan** (EP/CP/MAP/AP) | MISSING |
| **Transport** (private cab / tempo / flight inclusive / self-drive) | MISSING |
| **Room configuration** (doubles, triples, extra bed, children with age) | MISSING — and child age changes the price on nearly every Indian package |

**Those five missing fields are the reason a quotation takes longer than two
minutes.** The AI builder cannot prefill what nobody captured, so the
salesperson re-asks the customer or guesses. Fixing capture is worth more to the
2-minute target than any change to the AI itself.

**Quoting**

| Capability | Status |
|---|---|
| AI quotation draft — priced lines, day-by-day itinerary, cost, confidence | BUILT |
| Grounded in the real catalogue; anchor-drift warning on over-price | BUILT |
| Double-count guard on per-person quantities | BUILT |
| Three templates — Simple, Modern, Detailed | BUILT |
| Full brochure blocks — packing list, declaration, cancellation, how to book, bank/GPay | BUILT |
| Revisions with a version chain | BUILT |
| Customer approves at a tokenised link (`/q/[token]`, `noindex`) | BUILT |
| Approval creates the booking automatically | BUILT |
| **Load the customer's own itinerary into a draft, one tap** | MISSING — backlog #22. This is the itinerary-builder path you described and it is the biggest single gap in the sales flow |
| **Discount floor / approval above a threshold** | MISSING |

**Taking money**

| Capability | Status |
|---|---|
| Generate a Razorpay payment link | BUILT |
| Webhook verifies HMAC over the raw body and records the payment | BUILT — but the webhook is **not registered in the Razorpay dashboard** (#68), so nothing arrives yet |
| Record an offline payment (bank transfer, GPay, cash) | BUILT |
| Booking stage follows the ledger, not a dropdown | BUILT |
| **Balance reminder at T-21 days** | MISSING — backlog #70 |

**Sales cannot:** issue a tax invoice, see another rep's pipeline, edit a
booking after handover to ops, or change a price after the customer approved.
The first of those is currently **not enforced** — see 1.4.

### 1.3 Operations

Owns the trip from money-in to homecoming. Sees **confirmed bookings only** —
never the pipeline, never margin.

| Capability | Status |
|---|---|
| Operations board of confirmed bookings | BUILT |
| Service list per booking — hotel, transport, guide, activity, flight — with supplier, reference, cost, dates, assignee | BUILT (`booking_services`) |
| Handover from sales is explicit and timestamped (`handedToOpsAt`, `opsOwnerId`) | BUILT |
| Undated bookings surface rather than disappearing | BUILT |
| **Booking confirmation voucher** | MISSING — the words appear in a WhatsApp template; no document exists. This is the artefact the customer actually carries to the hotel |
| **Service checklist template per trip type** | MISSING — backlog #67 |
| **Day-of-travel timeline / departure sheet** | MISSING |
| **Supplier rate cards** | MISSING — backlog #16 |

**Ops cannot:** see gross margin or cost price, edit the customer's price, or
see a lead that has not been booked.

### 1.4 Accounts — **this role does not exist yet**

Everything in this section is MISSING unless marked. The capability exists; the
*separation* does not.

| Capability | Status |
|---|---|
| Sequential, immutable, financial-year-scoped invoice numbering | BUILT |
| Invoice carries seller, customer, place of supply, tax percent, line items | BUILT |
| **Only accounts may issue an invoice** | MISSING — today anyone with `bookings.write` can, which is every salesperson and manager |
| **Credit note / void with reason** | MISSING |
| **Payment reconciliation** — gateway settlement against bank credit | MISSING |
| **Refund against the cancellation policy** (the 70/50/nil ladder) | MISSING — refunds are computed by hand today |
| **GST output register / GSTR-1 export** | MISSING |
| **Invoice print view + PDF** | MISSING — backlog #30 |

**Accounts cannot:** edit a lead, build or alter a quotation, or change a
booking's price. They record what happened; they do not decide it.

### 1.5 Manager

Everything operational plus reports — not the team, not the website. BUILT and
unchanged.

---

## 2 · The two enquiry shapes

You named both, and they need different handling.

### 2.1 Plain enquiry (contact form, phone, WhatsApp, Ask Yaadi)

```
Enquiry → dedup → owner assigned → NEW (due today)
       → sales calls, fills the brief (the 9 fields in 1.2)
       → AI draft → review → send → approve → pay
```

The salesperson is **building** the trip. The AI draft is the first artefact the
customer sees.

### 2.2 Itinerary-builder enquiry — **the gap**

```
Customer builds an itinerary on /plan
       → lead arrives WITH `itinerary` attached          ← BUILT
       → sales opens it, talks to the customer, adjusts   ← MISSING
       → one tap: that itinerary becomes a priced draft   ← MISSING (#22)
       → send → approve → pay
```

Today the customer's itinerary is stored on the lead and **visible**, but there
is no path from it into the quotation builder. The salesperson reads it on one
screen and retypes it on another. That is the difference between a two-minute
quotation and a twenty-minute one, and it throws away the single most valuable
thing the customer gave us: a statement of exactly what they want.

**This is the highest-value build on the whole list.**

---

## 3 · The money path

```
Quotation approved
   → booking created automatically                    BUILT
   → advance due (flat ₹5,000/person, per the brochure)
   → payment link OR offline record                   BUILT
   → payment recorded → booking stage follows ledger  BUILT
   → sales assigns ops, handover timestamped          BUILT
   → ops builds services, issues voucher              VOUCHER MISSING
   → accounts issues tax invoice                      NO ACCOUNTS ROLE
   → balance at T-30 (50%) and T-7 (50%)              REMINDERS MISSING
```

Two things break this chain in production right now:

1. **The Razorpay webhook is not registered** (#68). Links generate; nothing
   comes back. Every online payment must be recorded by hand until it is.
2. **`SMTP_URL` is not set** (#56). The outbox correctly *skips* channels with no
   provider rather than burning retries, so nothing is lost — but no email has
   ever been sent.

---

## 4 · Notifications

Staff notifications are BUILT: an in-app inbox, an outbox with backoff
(`[0, 1, 5, 20, 60, 360, 1440]` minutes, 6 attempts), and channels that are
skipped rather than attempted when unconfigured.

**Customer notifications are MISSING entirely.** `lib/crm/notifications.js` is
staff-facing throughout. Everything a customer receives today is a human
pressing a WhatsApp template by hand.

The matrix that should exist:

| Moment | Team | Customer |
|---|---|---|
| Enquiry received | owner + admin — BUILT | acknowledgement — MISSING |
| Lead untouched 4h / 8h | owner, then admin — BUILT | — |
| Quotation sent | — | link + summary — MISSING |
| Quotation viewed by customer | owner — MISSING | — |
| Quotation approved | owner + admin — BUILT | confirmation — MISSING |
| Payment received | owner + accounts — PARTIAL | receipt — MISSING |
| Handed to ops | ops owner — BUILT | "meet your trip coordinator" — MISSING |
| Voucher ready | — | voucher — MISSING |
| T-21 balance due | owner — MISSING | reminder — MISSING |
| T-7 final documents | ops — MISSING | tickets, vouchers, driver — MISSING |
| Trip ends | owner — MISSING | review request — MISSING |

The last one matters more than it looks: **the site publishes no reviews at all**
(#52), and no review request is ever sent. That is also what Google's
Misrepresentation flag asks for — see the note at the end of this document.

---

## 5 · What to build, in order

Ordered by what unblocks the most, not by what is easiest.

| # | Build | Why first |
|---|---|---|
| 1 | **Structured brief fields** — departure date, hotel category, meal plan, transport, room config with child ages | Nothing downstream can be fast until capture is complete. Prerequisite for 2 and 3 |
| 2 | **Itinerary → quotation, one tap** (#22) | The single biggest time sink in sales; throws away the customer's own words today |
| 3 | **Accounts role + invoice gated behind it** | A salesperson who can raise a tax invoice is a real control weakness, not a theoretical one |
| 4 | **Property/supplier master** (#111, was #16) — name, city, category, room classes, seasonal rates, photos | Hard dependency of the two-minute target; without it steps 4 and 5 of §7 cannot be done at all |
| 5 | **Image + PDF upload** (#33) — Supabase Storage | Photos already render; there is no way to get a file in. Blocks hotel options being persuasive |
| 6 | **Hotel options, two or three with a recommendation** (#112) | Turns a take-it-or-leave-it document into a choice; needs 4 and 5 first |
| 7 | **PDF renderer** (#113) — headless Chrome over the existing page; serves quotation, voucher and invoice | Asked for directly. One renderer for all three documents; picking it early stops the voucher and invoice each inventing their own |
| 8 | **Two more templates** (#114) — Group departure, Corporate/MICE | Cheap once the first seven are in; the existing three are BUILT and the mechanism works |
| 9 | **Policy editing UI** (#115) — the six policy blocks become editable in the builder | Smallest item on this list and the most embarrassing gap: the code claims they are editable and the product has no inputs |
| 10 | **Policy library** (#116) — named sets, admin-managed, picked per quotation, "modified from" marker | **Blocked on #88** — do not seed four sets from an ambiguous cancellation sentence |
| 11 | **Booking confirmation voucher** | The artefact the customer physically needs at the hotel; currently does not exist |
| 12 | **Customer notification track** | Eleven moments, zero of them automated |
| 13 | **Balance reminders at T-21 / T-7** (#107) | Money that arrives late is money chased by hand |
| 14 | **Invoice PDF + credit note** (#108) | Accounts cannot close a month without both |
| 15 | **Refund calculator against the 70/50/nil ladder** | Computed by hand today, against terms that are ambiguous (#88) |

Items 1–2 should ship together: 1 alone changes nothing a salesperson notices,
and 2 without 1 inherits the same empty fields.

---

## 6 · The brief — field spec for #102

Answered 2026-10-09. Two things need separating first, because conflating them is
how this breaks later.

### 6.1 The brief is not the price

They are different objects and only one of them is missing.

| | What it is | Status |
|---|---|---|
| **The brief** | What the customer wants: who is travelling, which cities, what standard of hotel, which room plan, how they move between places | **MISSING** — this is #102 |
| **The price** | What it costs: priced lines with a kind, unit price, quantity and a per-person flag | **BUILT** |

The ten line kinds already in `QUOTE_LINE_KINDS` are `hotel, flight, transport,
activity, meal, guide, permit, insurance, service, other`. So every extra charge
you listed is **already expressible today**: paragliding, scuba, rafting, boating
and cruise tickets are `activity`; monument entry is `permit`; toll and parking
are `transport`. Nothing to build there.

**GST is the exception, and it must not become a line.** Tax is already modelled
at document level (`taxPercent`, defaulting to 5 for a tour package, with margin
measured pre-tax). Adding a GST line would double-count it on every quotation.
Note that the rate for a package differs from the rate on hotel accommodation
sold on its own, and the hotel slab depends on room tariff — confirm the current
rates with your CA rather than hard-coding them, since they were restructured
recently.

### 6.2 Travellers — adults and children are priced differently

You are right that one number cannot work. Hotels charge by child age and
whether a bed is needed; airlines use their own bands entirely.

```
adults      integer, min 1
children    [{ age }]        -- per child, not a count
infants     integer          -- under 2, usually lap, no seat
```

Per child, not a count, because two children aged 4 and 11 do not price the
same and a count cannot tell them apart. The usual Indian hotel breaks are
**under 5** (free, no bed), **5–12** (charged, with or without bed) and **12+**
(adult rate) — but these vary by property, so the field stores the **age** and
the pricing decision stays with the salesperson.

### 6.3 Room — three axes, not one

Your list mixed two separate things. *Single, couple, family, extra mattress* are
**occupancy**. *Deluxe, premium, business, suite* are **class**. A real hotel
line is both at once — "Deluxe room, double occupancy, one extra mattress" — and
a single flat enum cannot express it. This is confirmed by how booking sites
model it: occupancy is how many people the room sleeps, while deluxe and suite
describe size and amenities, and a suite can be booked for one guest or several.

```
roomClass      standard | deluxe | super-deluxe | premium | business
               | suite | cottage | tent
occupancy      single | double | triple | quad
extraMattress  integer, default 0
rooms          integer           -- how many of this configuration
```

A stay segment can hold several room rows, which is how you express "two deluxe
doubles and one family room with an extra mattress" for a group.

### 6.4 Hotel category — the standard the customer is buying

```
budget | 3-star | 4-star | 5-star | resort | villa | homestay | campsite
```

Your eight, unchanged. Note these are not a single ladder — a Spiti campsite and
a Goa villa are not "below 3-star", they are a different kind of stay — so this
drives the brief and the filter, never a quality sort.

### 6.5 Meal plan

```
EP   Room only
CP   Room + breakfast
MAP  Room + breakfast + one other meal (lunch or dinner)
AP   Room + all three meals
```

You named CP, MAP and AP. **EP is added** because room-only is common on
customised trips where guests want to eat out, and without it a salesperson has
to misuse CP. Shown to the customer as plain English with the code in brackets —
staff know the codes, customers do not, and the quotation is a customer
document.

Which meal MAP includes varies by property, so it is captured per segment rather
than assumed.

### 6.6 Transport — legs, not a setting

```
car | bus | train | flight | ferry | self-drive
```

`ferry` is added because Andaman and Alleppey both need it, and it is not a bus.

### 6.7 Per segment — the structural point

You said the salesperson should be able to define **each segment**, and that is
the part that changes the shape of the data. A trip is not one hotel category
and one transport mode; it is a sequence.

```
stays: [
  { city, checkIn, nights, hotelCategory, mealPlan,
    rooms: [{ roomClass, occupancy, extraMattress, count }],
    namedHotel?, confirmed? }
]

legs: [
  { mode, from, to, date, time?, operator?, class?, reference? }
]
```

A Spiti trip is then Shimla 1N → Kalpa 2N → Kaza 3N → Chandratal 1N, with six
legs between them, each priced separately — which is exactly how the brochure
quotation already reads.

**This is also what makes the 2-minute quotation possible.** Once the brief
holds segments, the AI builder has somewhere to put its output and somewhere to
read its input from: each stay becomes a `hotel` line, each leg a `transport` or
`flight` line, and the salesperson adjusts rather than types.

### 6.8 Budget and dates

- **Budget** — keep the free-text band *and* add an optional number with a
  per-person / total flag. The band holds "around 40–50k, flexible", which is
  what people actually say; the number makes the pipeline sortable by size.
- **Departure date** — a real date **plus a `flexible` flag**, never a bare date.
  "Mid-June, flexible" is the most common answer and a bare date cannot hold it.
  Storing a date makes T-21 and T-7 reminders possible, which free text never
  could.

### 6.9 Photos — rendering is built, uploading is not

The quotation already renders images in three places:

| Where | Field | Status |
|---|---|---|
| Per hotel, in the Detailed template | `hotel.imageId` or `hotel.imageUrl` | BUILT |
| Stay and transport galleries | `stayPhotos[]`, `transportPhotos[]` | BUILT |
| Hero and route map | `heroImageId`, `routeMapId` / `routeMapUrl` | BUILT |

So "show the customer a photo of the hotel" is a solved problem **once the file
exists somewhere**. What is missing is the way to get it there: the media
library is a static 36-entry file (`src/lib/media.js`), so an image must either
be committed to the repo or pasted in as an external URL. A salesperson cannot
upload the photo a hotel just sent them on WhatsApp.

**That is backlog #33, and it is the real blocker.** It needs object storage
(Supabase Storage is already in the stack). Scope for the quotation use case:

- upload from the quotation builder, straight onto a hotel row, a leg or a gallery
- accept what a phone camera and WhatsApp actually produce — HEIC and large JPEGs — and downscale on the way in
- flight tickets and vouchers are often **PDFs**, not images, so the same uploader has to take a PDF and show it as an attachment rather than try to render it inline
- never block sending a quotation on a missing photo

### 6.10 Hotel options — two or three for the customer to choose

Today `content.hotels` is a flat list: these are your hotels. There is no way to
offer a choice, and offering a choice is how a quotation stops being
take-it-or-leave-it.

```
stays: [
  {
    city, checkIn, nights, mealPlan,
    options: [
      { label, hotelCategory, roomClass, occupancy,
        photos: [], priceDelta, recommended? }
    ],
    chosenOptionId?        -- set when the customer picks
  }
]
```

Three rules that keep this honest:

1. **One option is the baseline and carries the quoted price; the others carry a
   delta.** Showing three absolute totals invites the customer to compare the
   wrong numbers, and it means three recalculations every time anything changes.
2. **Mark one `recommended`.** A choice of three with no steer is work handed
   back to the customer. The brochure voice is "here is what we would book, and
   here is what else is possible".
3. **The customer's pick is recorded on approval** and flows into the booking,
   so ops confirms the hotel the customer actually chose. Without this the
   choice is decorative and someone books the wrong property.

This also changes the approval page (`/q/[token]`): it currently approves a
fixed document, and it will need to carry the selection. Worth scoping together
with #105 (the voucher), since both touch what the customer finally agreed to.

## 7 · The two-minute quotation — where the time actually goes

You have said this twice, so treating it as a hard constraint rather than an
aspiration. Here is the honest budget, and what breaks it.

| Step | Target | Today |
|---|---|---|
| Open the lead, read the brief | 15s | **Minutes, or a phone call** — the brief is free text and half the fields do not exist |
| Generate the draft | ~10s | **10s — BUILT and measured** |
| Adjust lines and itinerary | 45s | 45s, if the draft is close |
| Pick hotels, attach photos | 20s | **Not possible** — no property master, no upload |
| Review and send | 10s | 10s — BUILT |
| **Total** | **~100s** | **10–20 minutes, or two days if a call is needed** |

**The AI is not the bottleneck.** It already drafts in about ten seconds. Three
other things are:

1. **An incomplete brief** turns a two-minute job into a callback. Fixed by #102.
2. **Retyping the customer's own itinerary** costs ten to twenty minutes. Fixed
   by #103.
3. **No saved property or supplier data.** If a salesperson types "Hotel Snow
   Crest, Shimla, deluxe double, ₹4,500" from memory on every quotation, two
   minutes is arithmetically impossible — and the hotel photos and rate bands
   have nowhere to live between quotations.

Point 3 is the one that is currently mis-ranked. **Supplier rate cards (#16) are
sitting at S3 as a nice-to-have, and they are actually a hard dependency of the
two-minute target.** A property record holding name, city, category, room
classes, rate bands by season and a few photos turns the slowest step into a
dropdown, and it is what makes 6.9 and 6.10 usable rather than theoretical.

Promoted to **S2** and added to the build order below as #111.

## 8 · Quotation PDF and templates

### 8.1 Template choice — built, needs widening

Template selection already works. `TEMPLATES` in `lib/crm/quote-content.js`
defines three, and each one switches real behaviour rather than just styling:
`hero`, `dayImages` and `flights` are booleans the blocks read.

| Template | Shows | Status |
|---|---|---|
| **Simple** | One page, price first. For a repeat customer, or someone who has decided | BUILT |
| **Modern** | Hero image, day cards, flights. The everyday quotation | BUILT |
| **Detailed** | Per-day images, hotels with photos, flights, full policy. For big trips | BUILT |

You asked for three to five. Two to add, chosen because each answers an enquiry
shape the current three handle badly:

| Template | Why it earns a slot |
|---|---|
| **Group departure** | A fixed departure is a different document: batch dates, seats left, a per-person price that does not vary by room, and a shared-room note. Running it through Modern produces a private-trip layout with the wrong emphasis |
| **Corporate / MICE** | The corporate desk needs the GST number, a PO reference, a billing entity distinct from the traveller, cost-per-head, and no lifestyle photography. Finance reads this, not a honeymooner |

That gives five. I would not go past five: every template is a layout to
maintain, and the brochure blocks (packing list, declaration, cancellation,
payment options) already vary by content rather than by template.

### 8.2 PDF — a real download, not Ctrl+P

Today `/q/[token]` has a **print button** and print CSS (13 `print:` rules in
the quotation blocks, plus `@media print` in `globals.css`). You have asked for
a direct download instead, which is the right call: browser print gives the
customer a file with a header, a footer and a URL stamped on it, and whatever
page size the machine happened to be set to.

**Target:** a Download PDF button in the admin panel that returns a correctly
paginated A4 file named something like
`YaadiGo-Spiti-Valley-Sharma-2026-10-09.pdf`.

There is no PDF dependency in the project today, so this is a real decision.
Two credible routes:

| Approach | Upside | Downside |
|---|---|---|
| **Headless Chrome** (Playwright, or Puppeteer with `@sparticuz/chromium` on serverless) renders the existing `/q/[token]` page | **One rendering path.** The PDF is the page. A fix to a block fixes both | Heavy dependency; Chromium does not fit in a default Vercel serverless function without the slim build, and cold starts are slow |
| **`@react-pdf/renderer`** — rebuild the blocks in PDF primitives | Light, fast, no browser | **Two renderers that will drift.** Every block written twice, and this codebase has already shipped four silent field-drop bugs from exactly that class of duplication |

**My recommendation: headless Chrome against the existing page.** The drift risk
is not hypothetical here — `unitCost`, `itinerary`, `revisionOf` and `content`
all silently diverged in this repo already, and a quotation that renders one
price on screen and another in the PDF is the worst possible version of that
bug. One source of truth is worth the heavier dependency.

Two things to settle before building:

1. **Where it runs.** Chromium needs a runtime that can host it. If deployment
   is Vercel serverless this needs `@sparticuz/chromium`; a small always-on
   container is simpler. This interacts with the Mumbai move (#35) and should
   be decided alongside it.
2. **Print CSS stays.** The existing `print:` rules are what will make the PDF
   paginate correctly — `print:break-inside-avoid` on hotel and day cards is
   already doing the right thing. Headless Chrome uses the same stylesheet, so
   that work is not thrown away.

The same renderer then serves the invoice PDF (#108) and the booking voucher
(#105), which is the other reason to pick the path that only has to be built
once.

## 9 · Policies — booking, payment, terms

Partly built, and the gap is not where it looks.

### 9.1 What exists

One default of each is defined in `lib/crm/quote-content.js`, seeded onto every
quotation by `defaultContent()` and stored in that quotation's `content`:

| Policy | Default | Status |
|---|---|---|
| Payment schedule | ₹5,000 per person advance, 50% at T-30, 50% at T-7 | BUILT |
| Payment options | Bank transfer, payment link (2.5% fee stated), Google Pay | BUILT |
| How to book | Four steps | BUILT |
| Cancellation | The 70 / 50 / no-refund ladder, advance non-refundable, flights per airline | BUILT |
| Terms | Six clauses | BUILT |
| Declaration | Condensed from the brochure | BUILT |

All six are taken from YaadiGo's own brochure, so a salesperson in a hurry
already sends a complete, correct document. That part is genuinely done.

### 9.2 What is missing — two things, one of them embarrassing

**There is no UI to edit any of them.** `quote-builder.js` has twelve inputs and
**not one** of them touches `cancellation`, `paymentSchedule`, `paymentOptions`,
`howToBook` or `termsList`. The data layer stores per-quotation overrides and the
blocks render whatever they are given — but nothing in the product lets a
salesperson actually change the text. The comment at the top of
`quote-content.js` claims "every one is editable per quotation"; that is true of
the schema and false of the application. Corrected in the source.

**There is only one set of each, and it lives in code.** You asked for a choice
of predefined policies. Today there is exactly one cancellation ladder, and
changing it needs a developer and a deploy. A domestic weekend, a fixed
departure, an international trip with non-refundable airfare and a peak-season
Spiti circuit cannot honestly share one policy.

### 9.3 The spec

```
policy_sets
  id, kind            -- payment | cancellation | terms | how-to-book
  name                -- "Domestic standard", "International with airfare",
                      -- "Fixed departure", "Peak season"
  body                -- the structured rows the blocks already render
  isDefault           -- one per kind
  archivedAt          -- never delete; old quotations still reference it
```

Behaviour:

1. **Admin manages the library.** Sales choose from it; they do not create
   policy. A sales team inventing cancellation terms is how a company ends up
   unable to answer "what did this customer actually agree to".
2. **Sales pick a set per quotation**, and may edit the copy for that one
   quotation. An edited set is marked **"modified from Domestic standard"** on
   the quotation and in the audit trail, so a variation is visible rather than
   silent.
3. **Sending snapshots the text.** The quotation already stores `content`
   per-row, so this mostly works today — but it must stay true: changing the
   library next month must never alter what a customer already approved.
   Whatever the customer saw at approval is what they agreed to.
4. **Never delete, only archive.** A cancellation dispute six months from now
   needs the exact wording that was on the document.

Suggested starting library — four sets, matching how the catalogue actually
splits:

| Set | Differs because |
|---|---|
| Domestic standard | The current brochure ladder |
| Fixed departure | Seats are held against a batch; the advance behaves differently |
| International with airfare | Airfare is non-refundable once ticketed, and that dominates the cancellation maths |
| Peak season / festival | Hotels take non-refundable deposits, so our terms have to match theirs |

### 9.4 Blocked first

**Do not build the library until #88 is answered.** The current cancellation
default reads *"More than 30 days before departure — 70% of the package rate"*,
and it is genuinely ambiguous whether 70% is the refund or the charge. Those are
opposite contracts. Seeding four policy sets from a sentence that can be read
two ways multiplies the problem by four, and it is already going out on live
quotations.

## Note — the Google Merchant Center warning

The "Misrepresentation / prevents from showing in India" notice is almost
certainly **not about this site**. Merchant Center serves product feeds for
retail; YaadiGo has no feed, no products, no `/cart` and no `/checkout`, and
nothing in this repository has ever submitted to it. It reads like it belongs to
the ecommerce property the earlier SEO brief was written for.

If it *is* meant for YaadiGo, the four things that policy asks for map cleanly
onto gaps already listed above and in `seo-reports/manual-tasks.md`: visible
business identity and contact details (#89 GSTIN/CIN, #98 postal code),
reviews or seals (#52 — the site shows none), a professional store with SSL, and
complete Merchant Center business information. Worth confirming which property
it refers to before anyone acts on it.
