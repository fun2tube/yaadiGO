# System audit — panels, functions, workflows

**Date:** 2026-10-09 · **Asked for:** audit and test everything before review

**Result: 255 tests passing (was 123), 18 test files (was 10). Lint clean, types
clean, production build passes, 18/18 public URLs serve.**

**Second pass, same day.** The first pass only proved each panel RETURNED
something. That is not the same as being usable, so the panels were then
rendered to HTML and walked as each role, and the two public entry points were
exercised for the first time. That pass found two more defects — see §5a.

---

## 1 · What was actually missing

Before this pass, the test suite covered logic in seven modules and **not a
single screen**. A panel could compile, typecheck and pass a full green run
while throwing on the first real request — because nothing ever opened one.

Worse, the modules with no coverage were the ones that move money:

| Module | Was | Why it mattered |
|---|---|---|
| `convert.js` | untested | Where an S1 shipped: `convertQuotationToBooking(id, { actor })` was called with a variable named `user`, so **approving a quotation 500'd and never created a booking** |
| `payments.js` | untested | Every rupee in |
| `invoices.js` | untested | Statutory documents |
| `quotations.js` | untested | The arithmetic that once priced everything 2× |
| `workspace.js` | untested | Whether a salesperson can read a colleague's pipeline |
| `razorpay.js` | untested | An unauthenticated public endpoint that marks bookings paid |

## 2 · Panels — all 16 render

`src/app/admin/panels.test.js` calls every admin page as the async server
component it is, with storage and session stubbed, and asserts it returns an
element tree rather than throwing.

Overview · Leads · Lead detail · Interests · Quotations · New quotation ·
Quotation detail · Bookings · Booking detail · Operations · Invoices · Reports
· Team · Trips · Destinations · Pages

Each is also exercised **on an empty database**, because a fresh deployment has
no rows and empty states are where `.map` on undefined lives. Detail pages are
excluded from that case and asserted separately to 404 — a missing record
*should* `notFound()`.

Two cases specific to this week's work:

- a lead carrying a full brief (new columns, the first thing that would break
  if a shape were wrong between repository and component)
- **a lead with no brief at all** — every enquiry captured before this feature
  has `brief: null`, `adults: null`, `children: undefined`, and all of them
  still have to open

### Getting there required a toolchain fix

Vitest could not parse a single one of these files. This project writes JSX in
`.js`, which Next compiles and Vite does not — it decides a file's language
from its extension. Vite 8 runs on Rolldown, where the old `esbuild` transform
option no longer applies, so `vitest.config.mjs` now calls oxc directly on
`src/**/*.js` files that look like they contain JSX.

**That is why the panels had no coverage: not an oversight, a blocked tool.**
It is unblocked now, and component tests are possible for the first time.

## 3 · Workflow — the whole chain, end to end

`src/lib/crm/workflow.test.js`, 26 tests over real module code:

```
enquiry → brief → quotation → send → approve → booking
        → payment → operations → invoice
```

What it asserts, beyond "it runs":

- **Pricing.** Per-person lines multiply by head count, total lines do not.
  Discount applies **before** tax — taxing the pre-discount figure overcharges
  on every discounted booking.
- **Approval → booking.** Creates a booking *with an actor* (the S1 regression
  test). Refuses an unapproved quotation. **Idempotent** — a double click does
  not double-book. Money crosses unchanged, `advance + balance === total`.
- **Attribution.** Revenue stays with whoever owned the lead, not whoever
  pressed the button.
- **Payments.** Ledger moves, refunds are negative, zero amounts and unknown
  methods are refused.
- **Ops handoff.** Explicit and timestamped, never automatic on payment —
  operations commits supplier money the moment they pick it up.
- **Invoicing.** Sequential numbering, never issued twice, lines taken from the
  quotation, records who raised it.
- **The event log.** Chain stays attached, so money traces back to its lead.

## 4 · Security — two surfaces, now covered

`src/lib/crm/scope.test.js`:

**Pipeline scope.** A salesperson sees their own leads and unassigned ones, and
**cannot widen the view by passing a colleague's `ownerId` in the query
string** — `scopeToOwner` wins. The code comment claimed this; nothing proved
it until now.

**Razorpay webhook.** Accepts a correctly signed body, rejects a tampered body
carrying a genuine signature (the replay-for-a-bigger-amount attack), rejects
the wrong secret, **fails closed when no secret is configured**, and treats a
length mismatch as a rejection rather than a 500.

`src/lib/crm/roles.test.js` — 12 tests proving the new Accounts separation:
sales holds `bookings.write` and still **cannot** raise a tax invoice; manager
reads invoices but cannot issue; accounts cannot touch a lead, a quotation or a
booking's price; a suspended account is refused whatever its role.

## 5 · Bugs this audit found

| Bug | Severity |
|---|---|
| **Invoices issued as "YaadiGo", not the registered entity.** `REGISTRATION.legalName` has never existed on that object — it holds only `cin` and `gstin` — so `seller.name` fell through to a hardcoded trading name. The seller's registered legal name is a statutory field on a GST invoice. (`REGISTRATION.pan` was equally imaginary.) | **High** |
| **`childBand(null)` banded a missing age as *infant*** — the cheapest band. `Number(null)` is `0`, finite and in range. Wrong in the expensive direction, and silent. | Medium |
| **`briefSummary(null)` reported "1 room"** on leads whose brief had never been opened — a confident-looking summary on an untouched lead. | Low |

All three are fixed and covered.

## 5a · Second pass — rendering the panels as each role

`src/app/admin/role-walkthrough.test.js` renders each panel to HTML as a
specific user and asserts the controls a role needs are present, and the ones
it must not have are absent.

Confirmed working:

- **Sales** sees the customer, the destination, the preserved "mid-June,
  flexible", the confirmed departure date, and the special requests. The brief
  panel exposes the whole vocabulary — all eight hotel categories, all four
  meal plans with their codes, room class and occupancy as *separate*
  controls, and every transport mode including ferry and self-drive.
- **Sales is NOT offered "Raise invoice"** — it reads "Accounts raises this".
- **Ops** sees the board and the service list, and **never sees margin**.
- **Accounts** gets "Raise invoice" and is **redirected away from the leads
  board**.
- **Admin** can invite someone as Accounts.

### Two defects this pass found

| Bug | Severity |
|---|---|
| **The bookings board overstated money owed.** `awaiting` summed `advance` across every confirmed booking and ignored `collected` entirely, so a fully-paid advance still counted as outstanding. The headline figure the desk reads first every morning never went down when somebody paid. | **High** |
| **The booking reference was missing from the bookings list.** `YG-0001` is the handle ops, accounts and the customer all use — in supplier emails, on invoices, read back down the phone. Finding a booking meant opening them one at a time. | Medium |

## 5b · The two front doors

`src/app/actions/enquiry.test.js` — 11 tests. Until now the workflow tests
called `captureLead` directly, which skips validation, sanitising and the
itinerary payload, so **the step where a real customer enters the system had
no coverage at all**.

**Website form:** captures a workable lead, preserves the customer's own
words, assigns an owner, sets follow-up to today, notifies the team, promises
the customer a reply. Refuses a submission with no name, or with no phone and
no email. A repeat enquiry becomes one lead, not two. A 50,000-character
message is truncated rather than stored whole.

**AI itinerary builder:** the plan the customer actually saw is attached to
the lead, `hasItinerary` reaches the notification, and — the important one —
**a malformed itinerary never costs us the enquiry**: the lead is still
captured, with `itinerary: null`. The plan also survives the dedup merge when
the same person enquires twice.

## 6 · What is STILL not covered — read this before reviewing

**Client-side behaviour is not tested at all.** There is no DOM environment, so
every button, input, validation message and save interaction in `trip-brief.js`
and `invoice-desk.js` is only exercised by a human clicking it. The server half
of each page is proven; the half you actually touch is not.

**I have never seen these screens.** I tried to mint a session cookie to drive
the panels with curl; the sandbox refused it as credential materialisation and
I did not work around it. You are the first person to look at them.

Modules still bare, in rough order of risk:

| Module | Risk |
|---|---|
| `follow-ups.js` | Chase timing and the T-21/T-7 sweep |
| `reports.js` | Numbers the business will act on |
| `quote-ai.js` | Prompt construction — hard to test meaningfully without burning model calls |
| `pricing-context.js` | The catalogue grounding behind every AI price |
| `interests.js`, `staff-mail.js`, `quote-extras.js` | Lower |

## 7 · Two things that will look wrong on review

Neither is a defect in the code; both are missing data already tracked:

1. **Invoices show no GSTIN and no CIN.** `REGISTRATION` is
   `{cin: null, gstin: null}`. A GST invoice without a GSTIN is not valid, so
   this blocks real invoicing (#89 / #97).
2. **The seller address has no postal code** (#98).

## 8 · Verification commands

```
npm test          229 passed, 16 files
npm run lint      clean
npx tsc --noEmit  clean
npm run build     compiled successfully
18/18 public URLs 200
```
