# UI/UX spec — the sales workspace

**Backlog #4, #5, #6 + new #23–28 · Replaces the flat lead inbox**

## The problem with what exists

The inbox is a reverse-chronological list. That answers *"what came in?"* and
nothing else. A salesperson's actual questions are:

1. **Who do I have to ring today?** — not "what arrived", but "what did I
   promise to follow up".
2. What came in overnight that nobody has touched?
3. Which of my deals are waiting on money?
4. This one is going nowhere — who should have it instead?

None of those are answerable today. There is no follow-up date on a lead, so
"today's work" is unknowable, and that is the single biggest gap in the CRM.

## The missing field

`followUpAt` on a lead. Everything below depends on it.

Set it when you change stage ("called, ringing back Thursday"), or directly. A
lead with no follow-up date and an open stage is itself a warning — it means
nobody has decided what happens next.

## Screen 1 — `/admin` becomes "My day"

Replaces the current generic overview for anyone with `leads.write`.

**Four counts, in priority order.** Each one is a filter link, not a dead
number:

| | |
|---|---|
| **Overdue** | follow-up date passed. Red. The first thing you see. |
| **Today** | due today |
| **New, untouched** | arrived, still `new`, nobody has acted |
| **Tomorrow** | so the day can be planned before it starts |

Below: the actual list for the selected bucket, each row one tap from **Call**
and **WhatsApp**. A count you cannot act on is decoration.

**Empty (good kind):** *"Nothing due today. 3 leads are waiting on the
customer."* Distinguish "nothing to do" from "nothing exists" — the first is a
finished day, the second is a broken system.

## Screen 2 — `/admin/leads` gains filters

A filter bar that survives navigation (query string, not component state — a
salesperson filters, opens a lead, comes back, and must not lose their place).

- **Stage** — all seven, multi-select
- **When** — overdue · today · this week · no date set
- **Owner** — mine / anyone / a person (only where `team.read`)
- **Money** — has an unpaid booking · fully paid · no booking
- **Source** — where it came from
- **Search** — name, phone, email, destination, company

Filters combine. The count says what is shown out of what exists:
*"12 of 84 leads"*.

## Screen 3 — `/admin/leads/[id]`, the whole story

One page, everything linked, because the cost of switching screens mid-call is
the customer hearing dead air.

```
  Contact + call/WhatsApp        ← always first, it is why they are here
  Stage + follow-up date         ← the two things they will change
  Quotations   v1 ₹52,500 sent · v2 ₹48,000 approved   → open / build new
  Bookings     YG26-H5W7N confirmed · ₹12,075 outstanding → record payment
  Payments     the ledger
  Itinerary    if the AI planner made one
  Notes        append-only
  Timeline     every event
```

**Transfer** lives here: to another salesperson, with a reason. The reason is
mandatory — an unexplained reassignment reads as blame, and the next owner
needs to know what was already tried.

## Payments

Recorded against a **booking**, shown on the lead. Amount, method, reference,
date. Refunds are negative and say so.

After recording, the booking stage follows the money automatically —
`part-paid` then `paid`. Sales should never have to remember to move a status
that the ledger already implies.

**Guard:** recording more than the outstanding balance asks for confirmation
rather than refusing. Overpayments happen (currency rounding, a customer paying
two bookings in one transfer) and the system should not be cleverer than the
person holding the bank statement.

## Invoicing

An invoice is generated **from a booking**, never typed. It takes the
quotation's lines, the customer's details, and the company's GSTIN, and
produces a numbered document.

- Sequential numbering per financial year — `YG/26-27/0001`. Indian statutory
  requirement, and gaps in the sequence are a compliance problem.
- Once issued, **immutable**. Corrections are a credit note, not an edit.
- Print-to-PDF, same as quotations.

**Honest limit:** this produces a correct-looking tax invoice. It is not an
accounting system and does not file anything. GST returns still happen in Tally
or with a CA.

## Notifications — in-app and browser

The bell exists. Two additions:

**Browser notifications** for `lead.created` and `lead.assigned`, so a
salesperson with the tab open in the background hears about a new enquiry
within seconds. Permission is requested **on a click, never on page load** — a
permission prompt nobody asked for gets denied permanently, and then the feature
is dead for that person forever.

**Honest limit:** this only fires while a tab is open. Real background push
(phone locked, browser closed) needs a service worker and VAPID keys, which is
its own task. Do not imply otherwise in the UI — the toggle says
*"while YaadiGo is open"*.

## Acceptance criteria

- [ ] `followUpAt` settable on a lead; overdue/today/tomorrow computed from it
- [ ] "My day" shows four counts, each filtering the list below
- [ ] Filters persist in the URL and combine
- [ ] Lead detail shows quotations, bookings, payments, notes, timeline
- [ ] Transfer to another user, reason mandatory, both parties notified
- [ ] Record a payment; booking stage follows automatically
- [ ] Overpayment warns, does not block
- [ ] Invoice generates with a sequential number, is immutable, prints
- [ ] Browser notification permission asked on click only
- [ ] A sales user sees only what they own unless they have `team.read`
