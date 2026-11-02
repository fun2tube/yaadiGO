# Review — full system

**Date:** 2026-09-28 · **Reviewers:** CTO, PM · **Scope:** everything built to date

Findings are evidenced, not impressions. Each one became a task in `BACKLOG.md`.

---

## PM review — does it work for a real user?

### S1 · Notifications are written and never shown

`inboxFor` and `markRead` have **zero callers outside their own module**. Every
event fans out correctly and lands in `content/notifications.json`, and no
human can see any of it. There is no bell, no list, no unread count.

This is the same defect class as the Team module shipping without a page, and it
is the third time in this project. The notification system is, from a user's
point of view, not built.

*Reproduce:* submit any enquiry → `notifications.json` gains rows → sign in →
nothing anywhere in the UI.

### S1 · Operations cannot be handed a booking

`handToOperations` is written, tested in isolation, and **called from nowhere**.
The ops role exists, has permissions, and has no screen. A booking reaches
`paid` and stops. The entire post-sale half of the business has no software.

### S2 · A lead has no detail page

`getLeadDossier` assembles the lead with its quotations, bookings and full
timeline. Nothing renders it. From the inbox you cannot see what was quoted, or
that a booking exists, or the history — which is exactly what a salesperson
needs before picking up the phone.

### S2 · Two lead stages are unreachable

The schema defines seven stages. `lead-inbox.js` offers five: `qualified` and
`negotiating` cannot be set by a human. The reports page draws a pipeline with
two bars that will read zero forever.

Worse, the customer decline path *does* set `negotiating` — so a lead can enter
a stage the desk cannot then move it out of through the normal control.

### S2 · A booking has no detail page

No payments UI, no service list, no timeline. `recordPayment` exists in the
Postgres layer and has no counterpart in the running file-based system.

---

## CTO review — is it correct and safe?

### S1 · The data layer is complete and entirely unused

13 tables, migrations, 28 passing tests, money in paise — and **every module
still reads and writes JSON files**. The risk this was built to remove is still
live: a serverless deploy wipes leads, quotations and bookings.

This is the largest single piece of unfinished work and it is invisible, because
everything appears to function.

### S2 · Money is `number` everywhere outside `src/db`

`money.ts` is correct and tested. The running CRM does not use it —
`quotations.js`, `bookings.js` and `convert.js` all use floating-point rupees.
`Math.round(taxable * percent / 100)` is currently benign on small numbers, and
is the exact pattern the paise module exists to eliminate.

### S3 · `convert.js` uses a dynamic import inside a function

`bookingForQuotation` does `await import(...)` mid-call. It works, and it is out
of step with every other module. Static import.

### S3 · Two sources of truth for statuses

`BOOKING_STATUSES` in `lib/cms/bookings.js` lists five; `BOOKING_STAGES` in
`lib/crm/schema.js` lists seven including `part-paid` and `in-progress`. The API
validates against the five. `recordPayment` sets `part-paid` — a value the API
would reject. They must be one list.

### S3 · No transactional boundary in the file store

Approving a quotation writes the quotation, the lead, the booking and two events
as four separate file writes. A crash between them leaves an inconsistent state
that only the reconciliation check would notice. Resolved by the Postgres move,
not before.

### Credit where due

- The reconciliation check has now caught **two real defects** on its own —
  the missing booking conversion and the unassigned-lead gap. It earns its place.
- Grounding the quotation AI in the real catalogue is the right call and the
  `known`/`estimate`/`placeholder` flags are the right discipline.
- The `unitCost` bug — every quotation reporting 100% margin — was caught by
  testing with real numbers rather than reading the diff. That is the process
  working.

---

## Verdict

**Not production-grade.** Two S1 findings block it: notifications invisible, and
operations has no software at all. The pattern across all three S1/S2 findings is
identical and worth naming plainly:

> Back ends are being built and called done. The user-facing half is what makes
> a module real, and it keeps being skipped.

The `PROCESS.md` checklist exists specifically to stop this, and it now has to be
applied to modules already written rather than only to new ones.
