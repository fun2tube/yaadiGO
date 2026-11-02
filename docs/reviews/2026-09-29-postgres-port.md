# Review — Postgres port

**Date:** 2026-09-29 · **Backlog:** #9, #10 (both S1), part of #12
**Scope:** schema revision + repository layer

## The finding that changed the plan

Before writing a line of adapter, I compared the schema against what the
modules actually store. **Every table had drifted.**

```
leads        stage vs status · budgetBand vs budget · valuePaise vs value
             followUpAt, bookingId, monthlyTrips, notes[] all missing
bookings     stage vs status · advance, balance, perPerson, itinerary missing
quotations   cost, grossMargin, marginPercent, lines[], decisionNote missing
users        monthlyTargetPaise vs monthlyTarget · invitedByName missing
payments     amountPaise vs amount · leadId, recordedByName missing
invoices     WHOLE TABLE MISSING
```

Cause: the schema was written on day one, before the CRM existed, and then the
CRM was built differently. I never went back.

**Decision as CTO: revise the schema against reality rather than map over it.**
A mapping layer that renames half the fields is exactly where fields get
silently dropped — which is precisely how `unitCost` vanished and every
quotation reported 100% margin. Cheap to fix with no production data;
expensive in six months.

What survived from the original, because each earns its place: money as integer
paise, CHECK constraints in the database rather than the app, the chain
(`leadId`/`quotationId`/`bookingId`) denormalised onto every row.

What was reversed: **quotation lines and lead notes are jsonb, not child
tables.** They are always read with their parent, never queried across parents,
and a sent quotation is immutable — so the row *is* the snapshot. The CHECK
constraints the child table carried are enforced in `priceQuotation()`, which
is where they have to be anyway because the totals are derived there.

## What was built

**`src/db/repository.ts`** implements the exact interface every module already
calls — `listRecords` / `getRecord` / `createRecord` / `updateRecord` /
`removeRecord` / `upsertBy` / `mutateBy`. `records.js` delegates to it when
`DATABASE_URL` is set. **Not one CRM module changed.**

Two translations happen at that boundary and nowhere else:

- **Money.** Rupees above, paise below. What is *durable* is now exact. Moving
  the app layer to paise is a separate, safer step once nothing writes JSON.
- **Timestamps.** Modules compare ISO strings; Postgres returns `Date`.
  `String(date).localeCompare(...)` sorts by weekday name — a bug that looks
  like nothing until an inbox is in the wrong order.

`mutateBy` now takes a **`FOR UPDATE` row lock** instead of the file store's
per-process promise chain. That chain only worked inside one process; the lock
works across serverless instances, which is the whole reason seat counts needed
a database.

## PM review

| Criterion | Result |
|---|---|
| Schema matches what the modules store | ✅ 13 tables regenerated |
| Every module works unchanged | ✅ zero module edits |
| Tests pass against real Postgres | ✅ **37**, up from 28 |
| App still works with no database | ✅ all 7 admin modules + public site 200 |
| `tsc`, lint, build clean | ✅ |

The no-database path matters: the marketing site, AI planner and content editor
must not go down because a database is unreachable. Verified on a server with
no `DATABASE_URL` — sign-in 200, every module 200, homepage 200.

## CTO review

### TypeScript earned its keep

`tsc` caught the schema rename across `inventory.ts` and its tests immediately
— every `booking.stage`, every `customerName`. In JavaScript those would have
been `undefined` at runtime, in a seat-inventory transaction, discovered by a
customer. This is the argument for typing the data layer, and it paid on the
first refactor.

### New constraints worth naming

```
invoices_booking_unique     one invoice per booking, ever
invoices_number_unique      no duplicate invoice numbers
invoices_fy_sequence_unique no gaps or repeats per financial year
```

Invoice idempotency was previously only application logic. Now the database
refuses it too — which matters because a duplicate invoice number is a
compliance question, not a bug report.

Also verified: **deleting a lead cascades to its quotations but NOT its
bookings.** A booking is a commitment where money changed hands; it survives
with a null lead rather than being erased. That asymmetry is deliberate and now
tested.

### Open, and honest

**Nothing is running on Postgres yet.** The code is ready and proven against
real Postgres in tests, but no Supabase project exists, so the live app is
still on JSON files. The data-loss risk is *not* closed until `db:setup` runs
against a real database. That is backlog #8 and it needs credentials I do not
have.

**The app layer still thinks in rupees.** Durable storage is exact; in-memory
arithmetic is unchanged from today. No regression, but `money.ts` is not yet
used above the repository. Deliberately deferred — doing both in one pass would
have meant touching every module while also changing the store.

**Two schema tables have no module yet:** `departures` and `catalogueOverrides`
exist for the catalogue, which still reads from code and a JSON override file.
Part of #12.

## Status

#9, #10 — **Done.** #8 blocked on credentials. #12 partially advanced.
