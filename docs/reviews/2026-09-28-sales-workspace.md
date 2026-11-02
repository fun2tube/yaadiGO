# Review — sales workspace, payments, invoicing

**Date:** 2026-09-28 · **Spec:** `docs/design/lead-workspace.md`
**Backlog:** #4, #5, #6 + new #23 (follow-ups), #24 (filters), #25 (transfer),
#26 (payments UI), #27 (invoicing)

## What changed

The inbox answered *"what came in"*. A salesperson's question is *"who do I
ring today"*, and it was unanswerable because nothing recorded when a lead was
next due. `followUpAt` is the field the whole workspace hangs on.

## PM review

| Criterion | Result |
|---|---|
| `followUpAt` settable; overdue/today/tomorrow computed | ✅ |
| "My day" shows counts, each filtering the list below | ✅ Overdue · Today · New · Tomorrow · Unpaid |
| Filters persist in the URL and combine | ✅ all 200, and they discriminate |
| Lead detail shows quotations, bookings, payments, notes, timeline | ✅ |
| Transfer with mandatory reason, both parties notified | ✅ empty reason → 400 · with reason → 200 · note written · Priya notified |
| Record a payment; booking stage follows | ✅ `part-paid` → `paid` automatically |
| Overpayment warns, does not block | ✅ 409 + *"Record it anyway?"* |
| Invoice: sequential number, immutable, idempotent | ✅ `YG/26-27/0001`, second call returns the same |

Filters measured rather than eyeballed:

```
all             6 of 6
due=overdue     1 of 6
due=today       2 of 6
money=pending   1 of 6
```

**Passed.**

## CTO review

### S2 · Scope inconsistency on unassigned leads — **fixed**

Priya (sales, no `team.read`) could open a lead she did not own: **200**.

The guard read `lead.ownerId && lead.ownerId !== user.id`. A lead with a **null**
owner short-circuited it, so the check never ran. Meanwhile the list filtered on
`ownerId === user.id`, hiding those same leads. So an unassigned lead was
invisible in the list and readable by URL — the worst combination, because it is
inconsistent in both directions.

**Decision:** make both *show* unassigned leads rather than hiding them from
both. A lead nobody owns is precisely the one that must be visible, or it rots.
The guard is now explicit (`!lead.ownerId || lead.ownerId === user.id`) rather
than passing by accident.

*Where the unassigned leads came from:* they predate the fix that gives every
new lead an owner. Leftovers, not a live bug.

### Correction to my own test

I labelled a check *"ops recording a payment (must be 403)"* and it returned
400. That label was wrong: Priya is **sales**, and sales legitimately holds
`bookings.write`. The 400 was a bad `bookingId` in the test payload, not a
permission failure. The behaviour is correct; the assertion was not. No finding.

### Scope enforcement, verified

```
priya via API                    1 of 6   ← her own + unassigned
priya forcing ?owner=<admin>     1        ← ignored, scope wins
admin                            6 of 6
```

The query string cannot widen scope. Enforced in `filterLeads`, not the UI.

### Noted, not fixed

**Invoice numbering is read-then-write** and the file store has no transaction,
so two invoices issued in the same instant could collide on a number. Bounded by
reality — one desk, a handful a day — and properly fixed by the Postgres move,
where it becomes a sequence. Flagged in the module's own comments rather than
hidden.

**Browser notifications are not built.** The spec called for them; this pass
delivered the workspace instead. Still open as #28, with the honest constraint
recorded: without a service worker and VAPID keys they only fire while a tab is
open, and the UI must say so rather than implying background push.

## Status

#4, #5, #6, #23–#27 — **Done.** #28 (browser notifications) carried forward.
