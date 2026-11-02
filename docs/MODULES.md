# Modules

Status is deliberately harsh. A module is **Done** only against the checklist in
`PROCESS.md` — back end alone is **Partial**, and Partial is not progress you can
bank.

| Status | Meaning |
|---|---|
| **Done** | Full checklist passed, both reviews signed off |
| **Partial** | Works, but a checklist item is missing — usually UI or a failure path |
| **Skeleton** | Back end exists, no usable screen |
| **Not started** | — |

---

## 1. Identity & access — **Partial**

Staff accounts, invite → set password → admin approves → active. Per-module
permissions, Google sign-in, password reset.

**Built:** scrypt hashing, HMAC sessions, invite/reset with hashed single-use
tokens, Google OAuth with signed state and verified-email check, per-module
permission grid, last-admin lockout guard, brute-force brake.
**Verified:** 20 checks including suspension biting mid-session, identical
replies from the forgot-password form, single-use tokens.
**Missing:** no profile screen (change your own password, name) — the API
exists, nothing calls it. No session list / revoke. No MFA.

## 2. Leads — **Partial**

Capture from six sources, auto-assign, stages, notes, timeline.

**Built:** `captureLead` with least-loaded assignment, seven stages, lost
reasons enforced, notes, event emission on every change.
**Verified:** all six public forms create leads and render in the inbox.
**Missing:** no lead *detail* page — `getLeadDossier` exists and nothing renders
it, so quotations and bookings attached to a lead are invisible from the lead.
The inbox still uses a 5-status list while the schema has 7 (`qualified` and
`negotiating` cannot be set from the UI). No SLA timer or escalation.

## 3. Quotations — **Partial**

Versioned, priced, immutable once sent. AI draft. Customer link with approve /
decline and print-to-PDF.

**Built:** line-item builder with per-person vs per-group, server-recomputed
totals, cost and margin, AI drafting grounded in the real catalogue, version
supersede, customer view, decision endpoint, conversion to booking.
**Verified:** pricing exact, group costs not multiplied by headcount, draft link
404s, sent quotation immutable, approve → booking, double-approve refused.
**Missing:** no revision flow — "create v2 from v1" is described in the error
message but not implemented. No expiry job. No follow-up automation.

## 4. Bookings — **Partial**

Fixed-departure seat holds and customised bookings from quotations.

**Built:** seat hold/release with oversell refusal, payments, stage machine,
`convertQuotationToBooking`, `handToOperations`.
**Verified:** confirm/pay/cancel/delete cycle, oversell refused with a readable
message, seats returned on cancel.
**Missing:** no booking *detail* page. `handToOperations` is written and
**nothing calls it** — the ops handover cannot be triggered from any screen.
Payments have no UI.

## 5. Operations — **Partial**

Flights, hotels, cabs, the day-by-day timeline.

**Built:** ops board grouped by urgency (undated / needs attention / in progress
/ upcoming / travelling), service list with kind, supplier, reference, dates and
cost, progress counting confirmed only, explicit handover from sales with the
outstanding balance stated.
**Verified:** services added and confirmed with a real PNR, board grouping,
sales refused `services.write` (403), handover 200.
**Missing:** no per-day timeline view (services are a flat sorted list). No
supplier directory. No traveller-facing itinerary.

## 6. Catalogue — **Partial**

Fixed departures with inventory; customised destinations, enquiry only.

**Built:** trip editor with departure CRUD, publish toggles, merged catalogue
recomputing every derived field, destination editor.
**Verified:** unpublish removes a trip from nav, listings, homepage and sitemap;
edited prices propagate.
**Missing:** no supplier rate cards, so every quotation's cost is typed by hand.

## 7. Notifications — **Partial**

In-app bell, email, WhatsApp — all driven by event subscriptions.

**Built:** the subscriber model (no module calls notifications directly), in-app
records, outbox with honest `pending` status when a provider is missing,
Resend and WhatsApp Cloud API adapters.
**Verified:** one enquiry fans out to the right staff and queues both customer
channels.
**Missing:** no outbox screen. No retry worker. Neither provider has been
exercised against a live account.
**Closed 2026-09-28:** the bell and panel now exist; isolation verified with a
second account.

## 8. Reports — **Partial**

Pipeline, revenue, per-person attribution, speed, reconciliation.

**Built:** derived from the event log, per-salesperson attribution taken from
events (so re-assignment cannot rewrite history), first-response median and p90,
quote turnaround, lost reasons, sources, and a reconciliation check that states
on its own face when the numbers do not agree.
**Verified:** reconciliation caught two real defects on its first runs.
**Missing:** no date-range picker (this month only). No export. No CAC/LTV.

## 9. Website & content — **Partial**

Public marketing site, AI planner, Yaadi concierge, inline CMS.

**Built:** 14 fixed departures, 20 destinations, planner, concierge with 6
tools, admin editing agent, media library with licensing.
**Missing:** from the SEO audit — OG images on trip and blog pages, `FAQPage`
schema on trips, two `h1→h3` heading skips. No `llms.txt`.

## 10. Data layer — **Partial**

**Built:** Postgres schema REVISED against what the modules actually store (13
tables), Drizzle migrations, money in paise, seat-inventory transactions with a
`FOR UPDATE` lock, a repository implementing the record-store interface so no
module changed, `db:setup` doctor script, **37 tests** against real Postgres via
PGlite.
**Verified:** whole chain lead → quotation → booking → payment → invoice lands
and links; constraints fire; the app still works with no database at all.
**LIVE on Supabase since 2026-09-30** — 13 tables, 66 CHECK constraints, every
module verified against the real database. The data-loss risk is closed.
**Missing:** the project is in ap-southeast-2 (Sydney) at 335ms per query; it
belongs in ap-south-1 (#35). The app layer still
uses float rupees above the repository (#31). Catalogue not yet ported (#32).
