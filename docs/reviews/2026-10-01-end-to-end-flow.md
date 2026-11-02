# Review — end-to-end test of the customer, lead and quotation flows

**Date:** 2026-10-01 · **Role:** DevOps → PM → CTO
**Method:** live HTTP against the running app and the live Supabase database. No
mocks, no fixtures — real records, real money arithmetic, real constraints.

Two of the faults below broke the revenue chain outright. Both were invisible to
the test suite and to lint.

---

## S1 · Approving a quotation always threw 500 — and never created a booking

```
⨯ ReferenceError: actor is not defined
    at PATCH (src/app/api/admin/quotations/route.js:157:61)
```

```js
const converted = await convertQuotationToBooking(id, { actor });
//                                                      ^^^^^ never existed
```

The variable in scope is `user`. **Every other call in the same file says
`{ actor: user }`** — nine of them. This one did not.

So the single most important transition in the business — an accepted quotation
becoming a booking — failed on every attempt, for every user, always. The
comment directly above it is exact about the consequence:

> An approved quotation with no booking behind it is a won lead that owes
> nothing and reaches nobody.

That is precisely what happened. Fixed.

## S1 · The AI quotation builder was rejected by Gemini on every request

```
400 INVALID_ARGUMENT · Request contains an invalid argument
```

Gemini's `responseJsonSchema` accepts a **subset** of JSON Schema. Send a
keyword outside it and the entire request fails — naming neither the keyword nor
the field, so the feature just looks broken.

`QuoteDraftSchema` uses `.min()`/`.max()` on strings and arrays throughout, which
zod renders as `minLength` / `maxLength` / `minItems` / `maxItems`. The planner's
`ItinerarySchema` has no bounds at all — **which is the only reason the planner
worked. The difference was accidental, not designed.**

Fixed by sanitising the converted schema in the Gemini adapter: validation-only
keywords are stripped before sending, and `const` (from `z.literal()`) becomes a
single-value `enum`, which Gemini does accept and which pins the value just as
tightly.

**Nothing is lost.** Zod still validates the parsed response, so every bound is
enforced where it actually matters. Those keywords were only ever advisory to
the model.

## S2 · `no-undef` was not enabled, so the tooling could not see fault one

`eslint-config-next/core-web-vitals` does not include `no-undef`. I verified the
gap by reintroducing the bug: **lint passed silently.**

A reference to a variable that does not exist is the cheapest bug in software to
catch, and it took down the revenue chain. Now enabled, with browser and node
globals declared (this codebase runs both side by side, often in one directory):

```
157:61  error  'actor' is not defined  no-undef
```

Repo-wide: **one error on the reintroduced bug, zero false positives.**

---

## What was verified working

### Customer journey

| Step | Result |
|---|---|
| Public pages — home, group tours, customised, plan, contact, blog, about | all 200 |
| AI planner, 6-day itinerary | 5/5 complete (see the AI review) |
| Yaadi concierge | called `search_trips`, returned real prices and live seat counts |
| Enquiry form → lead | lead exists, `source: contact-page`, owner auto-assigned |

### Lead journey

| Step | Result |
|---|---|
| Add note | 200 |
| `new` → `contacted` with follow-up date | 200, both applied together |
| `contacted` → `qualified` | 200 |
| **Lost with no reason** | **400 — "Choose why this lead was lost."** |
| **Invalid stage `banana`** | **400 — enum rejected** |
| Auto-moved to `won` when the booking landed | confirmed |

### Quotation → booking → payment → invoice

```
AI draft         6 lines, each with unitCost and a confidence level,
                 7 inclusions, 5 exclusions, 4 assumptions, 1 clarifying question
create           subtotal 196,000 · tax 9,800 · total 205,800 · cost 164,500 · margin 16%
send             token issued
customer page    /q/<token> → 200 with the total, no authentication
approve          → booking YG26-PZDNZ
advance 30%      → status part-paid
OVERPAY          → 409 "takes the total collected to ₹10,90,740 against a booking of ₹2,05,800"
balance          → status paid
ledger           collected 205,800 · outstanding 0 · reconciles true
invoice          YG/26-27/0001 · FY 26-27
invoice AGAIN    same number, alreadyExisted: true — idempotent, not duplicated
operations       service added and listed against the booking
```

Margin is computed on the subtotal excluding tax — 31,500 / 196,000 = 16.07%.
Correct: tax is not ours to keep.

All admin pages and all three detail pages return 200. Test suite: **37/37**.

---

## Lower-severity findings

**S4 · `balance` on a booking record does not move when you pay.** It is
`total − advance` — a *schedule* figure, not a live ledger — so a fully paid
booking still reports `balance: 155800`. The live numbers are on
`/api/admin/payments?bookingId=…` (`collected`, `outstanding`, `reconciles`) and
they are right. The bookings list page does not render `balance`, so nothing is
currently wrong on screen. But a field with that name that ignores payments will
eventually be rendered as "outstanding" by someone. Worth renaming.

**Not a bug:** `GET /api/admin/operations` returns 400 without `?bookingId=`,
and `/api/q/[token]` is POST-only. My first calls were wrong, not the routes.

---

## Not verified, and why

**The enquiry form could not be submitted synthetically.** Next resolves the
bound `prevState` argument for `useActionState` server actions in a way I could
not reproduce over curl — every attempt returned `Connection closed` before the
action ran. I verified the step against the lead the form had already created
through a real browser (`source: contact-page`, owner assigned), so the path
demonstrably works.

**It is still a real coverage gap**: the single entry point for every lead in
the business has no automated test. That is backlog #54.

**Notifications did not reach anyone.** Every send logged:

```
[notify] email to test@test.com not sent — no provider. Recorded in the outbox.
[notify] whatsapp to 8848848848 not sent — no provider. Recorded in the outbox.
```

The outbox behaviour is correct — nothing is lost. But in the flow as it stands
today **the customer never receives the quotation link**, so "send" moves the
lead to `quoted` while the customer hears nothing. That is missing configuration
rather than broken code, and it is the same root cause as the missing WhatsApp
number in #48.

---

## Status

The complete chain now works: enquiry → lead → stages → AI quotation → send →
customer accepts → booking → payments → invoice → operations.

Before today, two separate faults meant it could not have completed even once.
