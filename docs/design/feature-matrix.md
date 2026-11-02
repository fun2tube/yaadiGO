# Feature and function list, by team

**Date:** 2026-10-01 · **Companion to:** `workflows.md`

> **Superseded, 2026-10-09.** Every status column below is out of date — several
> rows marked TO BUILD have since shipped (SLA escalation, WhatsApp templates,
> brochure quotation blocks). Use
> [`team-operating-model.md`](./team-operating-model.md) instead; it was written
> against a fresh audit of the running system. Kept for history.
Status is honest: **BUILT** means I have exercised it against the live system.
**PARTIAL** means it exists but has a gap named next to it. **TO BUILD** means it
does not exist.

---

## Sales — the desk that converts

### Working the queue

| Feature | Status |
|---|---|
| My Day — due today, overdue, chase list, in one screen | BUILT |
| New lead due **today** by default | BUILT |
| Owner auto-assigned by lightest open pipeline | BUILT |
| Filters: date, stage, payment-pending, source, free text | BUILT |
| Transfer a lead to a colleague or ops, reason required | BUILT |
| Unassigned leads visible to everyone | BUILT |
| **Duplicate detection on phone / email** | TO BUILD — two salespeople currently call the same customer |
| **Estimated value at capture** (budget band × pax) | TO BUILD — pipeline cannot be sorted by size |
| **SLA escalation** — 4h to owner, 1 day to admin | TO BUILD — nothing notices an ignored lead |
| **Lead score** — source, budget, date proximity, engagement | TO BUILD |

### Talking to the customer

| Feature | Status |
|---|---|
| Click-to-call from the lead screen | BUILT |
| WhatsApp from the lead screen | BUILT |
| Free-text notes, timestamped and attributed | BUILT |
| The AI itinerary the customer actually saw, on the lead | BUILT |
| **Structured call outcome** — connected / no answer / busy / callback | TO BUILD |
| **Auto next follow-up from the outcome** | TO BUILD — every date is set by hand today |
| **Stage-aware WhatsApp templates**, pre-filled | TO BUILD — the button opens a blank chat |
| **Yaadi chat transcript on the lead** | TO BUILD — chats leave no trace at all |

### Quoting

| Feature | Status |
|---|---|
| AI quotation draft — priced lines, cost, confidence, in ~10s | BUILT |
| **Day-by-day itinerary generated with the pricing** | BUILT today |
| Grounded in our real catalogue prices | BUILT |
| **Anchor-drift warning** when a draft exceeds our published price | BUILT today |
| **Double-count guard** on per-person quantities | BUILT today |
| Three templates — Simple, Modern, Detailed | BUILT |
| Live margin while editing | BUILT |
| Print / PDF | BUILT |
| Revisions, v1 → v2, fresh link each time | BUILT |
| Tokenised customer link, no login | BUILT |
| Customer accepts or declines themselves | BUILT |
| Automatic chase at 2 / 5 / 10 days | BUILT |
| "Quotation viewed" notification | TO BUILD — the highest-signal moment to call |
| **Images on the quotation** — destination, hotel, flight, logo | TO BUILD — template slots exist, content does not (#33) |
| One tap: planner itinerary → quotation draft | TO BUILD (#22) |

### Getting paid

| Feature | Status |
|---|---|
| Record a payment, any method | BUILT |
| Overpayment refused unless deliberate | BUILT |
| Booking stage follows the ledger automatically | BUILT |
| Refunds as negative amounts, constrained | BUILT |
| Ledger reconciliation — collected, outstanding | BUILT |
| **Razorpay payment link — UPI, card, EMI** | IN PROGRESS |
| **Webhook records the payment with nobody typing** | IN PROGRESS |
| **Balance reminder at T-21 days** | TO BUILD |
| Payment plan — advance / instalment / balance schedule | BUILT (defaults) |

---

## Operations — the team that delivers

| Feature | Status |
|---|---|
| Handover queue — what sales has passed over | BUILT |
| Per-booking service list | BUILT |
| Service kinds: hotel, transport, flight, activity, guide, permit | BUILT |
| Supplier name, reference, cost, dates per service | BUILT |
| Service status: requested → confirmed → cancelled | BUILT |
| Ops owner assigned on handover | BUILT |
| **Checklist template per trip type** | TO BUILD — nothing says a Dubai booking needs a visa |
| **Overdue-service alert** | TO BUILD |
| **Voucher generation** | TO BUILD |
| **Pre-departure pack**, automatic at T-7 | TO BUILD |
| **Supplier rate cards** so cost is pulled, not typed | TO BUILD (#16) |
| **Day-of-travel board** — who is travelling today | TO BUILD |
| **On-trip incident log** | TO BUILD |

---

## Admin — the view across everything

| Feature | Status |
|---|---|
| Dashboard: pipeline, conversion, revenue | BUILT |
| Per-salesperson KPIs | BUILT |
| Margin by deal and by person | BUILT |
| Invite by email → approve → assign modules | BUILT |
| Google one-click sign-in | BUILT |
| Forgot / change password | PARTIAL — API exists, no profile screen (#17) |
| Suspension bites immediately, mid-session | BUILT |
| Per-module permissions, enforced server-side | BUILT |
| Catalogue editor — trips, departures, seats, prices | BUILT |
| Invoice register, sequential per FY | BUILT |
| Event log — every state change, attributed | BUILT |
| **Outbox screen** — sent, pending, failed | TO BUILD (#18) |
| **Reports: date range + CSV export** | TO BUILD (#21) |
| **Revenue by campaign / UTM** | TO BUILD — no attribution captured at all |
| **Lost-reason analysis** | TO BUILD — data is collected, never reported |
| **Forecast** — weighted pipeline by stage | TO BUILD |

---

## Customer — what they can do without logging in

| Feature | Status |
|---|---|
| AI planner — full itinerary, free, no signup | BUILT |
| Ask Yaadi — live prices, seats, comparisons | BUILT |
| Browse trips with real seat counts | BUILT |
| Enquire from any trip page | BUILT |
| Open a quotation on a tokenised link | BUILT |
| Accept or decline it themselves | BUILT |
| **Pay by UPI from a link** | IN PROGRESS |
| **Booking status page** — what is confirmed, what is owed | TO BUILD |
| **Download voucher / pre-departure pack** | TO BUILD |

---

## Settings that have to exist

| Setting | Status |
|---|---|
| Company identity, contact, GSTIN, CIN | PARTIAL — CIN and GSTIN still missing (#50) |
| Phone, WhatsApp, enquiry email | BUILT today |
| GST percentage per quotation | BUILT |
| Default payment schedule | BUILT |
| Default terms, cancellation, how-to-book | BUILT |
| Chase ladder — 2 / 5 / 10 days | BUILT (code constant) |
| Advance amount per trip | BUILT |
| AI provider and model | BUILT |
| **Email + WhatsApp provider credentials** | TO CONFIGURE (#56) — the one that blocks everything |
| **Razorpay credentials** | DONE today |
| **Round-robin on/off, per-person lead caps** | TO BUILD |
| **Business hours** — so SLA timers mean working hours | TO BUILD |
| **Lost reasons list, editable** | BUILT (code constant) |

---

## The three that matter most

Everything above is noise next to these:

1. **Email + WhatsApp providers (#56).** Configuration, not code. Until it is
   done the customer never receives a quotation and the CRM is a notebook.
2. **Yaadi captures leads (#57).** The warmest traffic on the site currently
   leaves no trace whatsoever.
3. **Razorpay (#58).** Closes the gap between "yes" and money, which is where
   Indian travel bookings die.
