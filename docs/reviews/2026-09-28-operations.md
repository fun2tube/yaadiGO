# Review — operations board and handover

**Date:** 2026-09-28 · **Backlog:** #2, #3 (both S1) · **Spec:** `docs/design/operations.md`

## PM review — against the acceptance criteria

| Criterion | Result |
|---|---|
| `/admin/operations` lists handed-over bookings, grouped by urgency | ✅ |
| Booking detail shows services | ✅ |
| Add a service — kind, title, supplier, reference, status | ✅ three added, one confirmed with PNR `6E-2143` |
| Progress counts confirmed only | ✅ renders `1/3 arranged` with one of three confirmed |
| Hand-over appears for sales on a confirmed booking | ✅ |
| Handing over sets `handedToOpsAt`, notifies ops, emits an event | ✅ `PUT` → 200, booking appears on the board |
| Outstanding balance visible on the ops card | ✅ |
| Empty state | ✅ *"Nothing handed over yet…"* |
| Ops cannot record a payment; sales cannot edit services | ✅ see CTO review |

**Passed, after two corrections.**

## CTO review — correctness and safety

### Role separation verified with a real sales account

```
sales adding a service      403   ← services.write required, correctly refused
sales sees the Ops tab        0   ← before the fix below
sales handing over          200   ← bookings.write, correct
```

### S3 · Nav gate and page gate disagreed — **fixed**

The tab was gated on `services.write`; the page checked `bookings.read`. A
salesperson could not see the tab but could open the board by typing the URL.

Not a security hole — the service list already gates editing separately, so they
would have seen a read-only board. It is a correctness and honesty problem: a
hidden link that works is the kind of drift that makes permissions untrustworthy.

**Decision, as CTO:** align both on `bookings.read` rather than tightening the
page. Sales is asked *"where has my customer's booking got to"* constantly, and
answering it without interrupting ops is worth more than the tidiness of hiding
it. Editing remains `services.write`.

### S2 · A handed-over booking with no travel dates vanished — **fixed**

A customised booking created from a quotation carries `departureStart: null`,
because a quotation is approved before dates are pinned. The urgency grouping
required a date, so such a booking silently fell into "Upcoming" and would sit
there indefinitely — invisible to a desk scanning for what is next.

Now surfaced as its own group, **"No travel dates yet"**, in `warn`. Ops cannot
sequence anything without a date, so it is a blocker, not a footnote.

*Found by:* testing with the booking the quotation flow actually produced,
rather than a seeded one with tidy dates.

### Noted, not fixed

`updateService` emits only on `todo → confirmed`. Deliberate: ops edits titles
and notes constantly, and an event for each would train the team to ignore the
bell. Revisit if ops later wants a full audit trail per service.

## Status

Backlog **#2 and #3 — Done.** Both reviews passed after the two corrections.

Both S1 findings from the full-system review are now closed. The remaining
Sprint 1 items (#4 lead detail, #5 stages, #6 booking payments) are S2.
