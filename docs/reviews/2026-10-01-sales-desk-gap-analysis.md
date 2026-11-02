# What the sales desk needs that the CRM does not yet have

**Date:** 2026-10-01 · **Written as:** the travel sales consultant who would
work these leads · **Method:** walked the real cycle against the live system

Contact details are now live site-wide: **+91 73737 34778** (calls and
WhatsApp) and **info@yaadigo.com**.

I walked the cycle the way a consultant actually works it — enquiry lands, I
call, I qualify, I quote, I chase, I close, I collect, I hand to ops — and noted
every point where the system would stop me. The good news first, because a lot
of this is already built and genuinely usable.

---

## What already works, verified

| Step | Status |
|---|---|
| Enquiry → lead, owner auto-assigned by **lightest open pipeline** | works |
| New lead is due **today** by default | works — the right default; urgency not patience |
| My Day: due today, overdue, chase list | works |
| Lead detail shows the **AI itinerary the customer actually saw** | works — this is better than most CRMs |
| Click-to-call and WhatsApp from the lead screen | works |
| Seven stages, notes, transfer with a mandatory reason | works |
| AI quotation draft — 6 priced lines with supplier cost and confidence, in ~10s | works |
| Three quotation templates, print to PDF | works |
| Send → tokenised link → **customer accepts themselves** → booking auto-created | works |
| Payments with an overpayment guard, invoice with FY numbering, idempotent | works |
| Ops handoff and a per-booking service list | works |

That is a real spine. What follows is what stops it converting.

---

## S1 · The customer never actually hears from us

This is the one that matters more than everything else combined.

There is no email or WhatsApp provider configured, so every customer message —
**including the quotation link** — is written to the outbox and goes nowhere:

```
[notify] email to … not sent — no provider. Recorded in the outbox.
[notify] whatsapp to … not sent — no provider. Recorded in the outbox.
```

So "Send quotation" moves the lead to `quoted`, the pipeline says the customer
is deciding, and the customer has received nothing. **The desk would be chasing
a quote that was never delivered.**

Nothing is lost — the outbox is honest about it — but as it stands the only way
a customer sees a quotation is if the salesperson copies the link into WhatsApp
by hand.

**What it needs, and it is configuration, not code:**

```
RESEND_API_KEY=…        # resend.com — free tier covers ~3,000 emails/month
WHATSAPP_TOKEN=…        # Meta WhatsApp Cloud API
WHATSAPP_PHONE_ID=…     # for 73737 34778
```

Both providers are already written against their HTTP APIs. **Neither has ever
been exercised against a live account** — the comment in the code says so —
so treat the first real send as the test.

**A trap worth fixing at the same time:** `emailConfigured()` returns true if
`SMTP_URL` is set, but `deliver()` throws "SMTP_URL delivery is not implemented
yet" unless `RESEND_API_KEY` is present. Setting `SMTP_URL` alone would mark
every message queued and then immediately failed.

## S1 · Ask Yaadi conversations leave no trace at all

Three entry points. Two of them produce a lead; one produces nothing.

- **Enquiry form** → lead created
- **AI Planner** → ends at the enquiry form, so it becomes a lead *if they
  submit* — with the itinerary attached, which is excellent
- **Ask Yaadi** → **nothing**

Yaadi's `hand_to_human` and `start_booking` tools only draw a UI card. No lead,
no record, no conversation stored anywhere. A traveller can tell Yaadi they want
Kashmir for four people in October, get live seat counts and prices, decide to
think about it — and the desk never learns they existed.

That is the single biggest lead leak in the system, and it is leaking the
*warmest* traffic: someone who got as far as asking about dates and seats is
much closer to booking than a cold form filler.

**What it needs:** Yaadi captures a lead the moment it knows a destination plus
any one of dates, pax or budget — marked as a chat lead, with the transcript
attached, flagged "no contact details yet" if they have not given a number.
Even without a phone number the destination and month are worth knowing, because
they tell you what to stock and what to advertise.

## S2 · No way to take money

Payments are recorded **after the fact, by hand**. There is no gateway, no
payment link, nothing in the codebase referencing Razorpay, Cashfree or
similar.

In practice: the customer says yes, and the salesperson then asks them to make a
bank transfer and send a screenshot. That is where Indian travel bookings die —
the gap between "yes" and "paid" is where a competitor with a UPI link wins.

**What it needs:** a Razorpay payment link generated against the booking, sent
on WhatsApp, with the webhook recording the payment automatically. UPI, cards
and EMI, which is what this market expects. The payment ledger already
reconciles correctly, so this plugs into a working foundation.

## S2 · Call outcomes are unstructured, so nothing can be measured

Notes are free text. There is no outcome field — connected, no answer, busy,
wrong number, call back — and no automatic next follow-up based on it.

Consequences a sales manager will feel immediately:

- No answer to "how many dials does a booking take?"
- No way to see a salesperson dialled twenty leads and connected with three
- Nothing distinguishes "called, not interested" from "called, no answer"
- The next follow-up date has to be set by hand every single time, which means
  sometimes it is not

**What it needs:** a one-tap outcome on the lead screen that writes a structured
note **and** sets the next follow-up automatically — no answer → tomorrow,
call back → their date, connected → stage prompt.

## S2 · Duplicate leads are not detected

The same person enquiring twice creates two leads, probably assigned to two
different salespeople, who then both call them. There is no check on phone or
email at capture.

This happens constantly in travel — people enquire from the planner, then again
from the contact form a week later. It is the most visible possible way to look
disorganised to a customer.

**What it needs:** match on phone, and on email, at capture. Same person inside
90 days → attach the new enquiry to the existing lead as an interaction and tell
the owner, rather than creating a second lead.

## S3 · Leads carry no value until they are quoted

`value: null` at capture. So the pipeline cannot be totalled, forecast or
prioritised by size — a ₹4,00,000 family booking and a ₹25,000 solo enquiry look
identical in the queue.

**What it needs:** an estimated value at capture from the budget band × group
size. Wrong but useful beats absent, and it gets replaced by the real figure the
moment a quotation exists.

## S3 · Nothing escalates a lead that is ignored

A new lead is due today, which is right. But if nobody touches it, nothing
happens — no escalation, no manager notification, no reassignment. The
follow-up cron chases *quotations*, not untouched leads.

**What it needs:** untouched after four working hours → notify the owner;
after a day → notify the manager and offer reassignment. The event spine already
carries everything needed to detect this.

## S3 · No attribution beyond a source string

`source: "contact-page"` is all there is. No UTM capture, no referrer, no
campaign. The moment any money goes into ads, there is no way to tell which
spend produced revenue — and the answer to "should we spend more on Google or
Instagram" is a shrug.

**What it needs:** capture `utm_source`, `utm_medium`, `utm_campaign`, `gclid`
and referrer on first visit, carry them through to the lead, and report revenue
by campaign. Cheap now, impossible to backfill later.

## S3 · The planner itinerary is retyped into the quotation

The AI itinerary sits on the lead. The quotation builder does not read it. So
the salesperson looks at a generated six-day Kerala plan and types it in again.
(Already logged as #22.)

**What it needs:** one tap from the lead's itinerary into a pre-filled
quotation draft.

## S3 · No WhatsApp message templates

The WhatsApp button opens a blank chat. Every salesperson writes their own first
message, which means quality varies and nothing is consistent.

**What it needs:** stage-aware templates — first contact, itinerary sent,
quotation follow-up, payment reminder, pre-departure — pre-filled with the
customer's name, destination and the quote link.

## S3 · The customer has no booking status page

After paying, the customer gets nothing to look at. Every "what's happening with
my booking?" becomes a phone call to the desk.

**What it needs:** the quotation token already works without authentication —
extend the same pattern to a booking page showing what is confirmed, what is
pending, what is paid and what is still owed.

## S4 · Ops handoff has no checklist

`handToOperations` works and services are added by hand, one at a time. Nothing
tells ops that a Dubai booking needs a visa, or a Ladakh booking needs inner-line
permits.

**What it needs:** a service checklist template per trip type, created
automatically at handoff, so a missing permit is a visible unticked row rather
than something discovered at the airport.

---

## Build order

Ranked by revenue impact per unit of work, not by what is pleasant to build.

| # | Change | Sev | Why first |
|---|---|---|---|
| 1 | Email + WhatsApp providers | S1 | Configuration only. Without it the customer never receives a quotation. Everything else is theatre until this is done. |
| 2 | Yaadi captures leads | S1 | Plugging the leak on the warmest traffic on the site |
| 3 | Razorpay payment link + webhook | S2 | Closes the gap between "yes" and "paid" |
| 4 | Structured call outcomes + auto next follow-up | S2 | Makes the desk measurable and stops follow-ups being forgotten |
| 5 | Duplicate detection on phone/email | S2 | Stops two people calling one customer |
| 6 | WhatsApp templates | S3 | Small, and lifts every single conversation |
| 7 | Estimated lead value at capture | S3 | Lets the queue be worked biggest-first |
| 8 | SLA escalation on untouched leads | S3 | Nothing currently notices an ignored enquiry |
| 9 | UTM capture | S3 | Cheap now, impossible to backfill |
| 10 | Itinerary → quotation in one tap | S3 | Removes the worst retyping in the flow |
| 11 | Customer booking status page | S3 | Removes a category of inbound calls |
| 12 | Ops checklist templates | S4 | Prevents the expensive kind of mistake |

---

## Addendum — the quotation and itinerary, inspected and fixed

Checked after writing the above, because a quotation is the thing the customer
judges us on. Three faults, all now fixed.

### S1 · Every AI quotation was roughly double the right price

`priceQuotation` multiplies a per-person line by `quantity × travellers`. The
prompt explained `perPerson` carefully — it even warned about multiplying a
group cost by the headcount — but **never said what `quantity` meant.** So the
model put the traveller count there, and it was multiplied again:

```
4-Star Hotel · ₹32,000 · quantity 2 · perPerson  →  32,000 × 2 × 2 = ₹1,28,000
UAE visa     · ₹7,500  · quantity 2 · perPerson  →   7,500 × 2 × 2 =   ₹30,000
```

A 5-day Dubai trip for two came out at **₹2,05,800**. The same trip after the
fix: **₹1,20,225**, margin 17%.

Fixed three ways, because a prompt alone is not a guarantee: `quantity` now
carries a `.describe()` (Gemini reads it), the prompt has worked examples for a
two-traveller trip, and a guard flags any per-person line whose quantity equals
the headcount — **flags, never silently reprices**, because halving a price by
surprise is as dangerous as doubling it.

### S2 · The model ignored our own published prices

Grounded against the catalogue — "Dubai, City & Desert, from ₹52,500 per
person" was in its context — it quoted **₹95,150 per person. 1.8× our own
website price**, with no reason given.

The prompt already said "that is your anchor, price consistently with it". The
model does not comply because it never totals its own lines per head and
compares. So now the system does: per-person total against the cheapest
comparable anchor, and anything beyond 40% over gets a `CHECK THE PRICE` line at
the top of assumptions. After the quantity fix the same draft lands at ₹57,250
against ₹52,500 — 9% over, which is fine, so nothing fires.

**Also:** `grounding` was computed and then thrown away by the route, so the
builder could not tell a salesperson whether a draft was anchored to real prices
or guessed from training data — which is exactly when every figure needs
checking. Now returned.

### S2 · Quotations had no day-by-day plan

The templates have always rendered one. `createQuotation` has always stored
`draft.itinerary ?? lead.itinerary`. But **the AI drafter produced only
pricing**, so a quotation printed as a table of money.

It only looked fine because a lead from the public AI planner carries its
itinerary with it. Leads from the contact form, from Yaadi or over the phone —
the majority — carried nothing.

The drafter now writes the day-by-day alongside the pricing, in the same shape
the planner and the templates already use. Verified output, named places and
all:

```
Day 1  Arrival and Marina Dinner Cruise
Day 2  Old Dubai Sightseeing and Spice Souk — Al Fahidi, abra across the creek
Day 3  At the Top Burj Khalifa — 124th and 125th floors
Day 4  Desert Safari with BBQ Dinner
Day 5  Leisure Morning and Departure
```

**One trap caught on the way:** the API's `DraftSchema` did not declare
`itinerary`, so zod would have stripped it silently on the way in and the days
would never have been stored — the identical failure mode to the `unitCost` bug
that once made every quotation report 100% margin. Declared.

### Verified on the live customer page

```
quotation v4 · total ₹1,20,225 · margin 17%
itinerary stored          5 days
customer page             200, no authentication
  day-by-day              renders
  named places            renders
  total                   renders
  payment schedule        renders
  how to book             renders
  cancellation schedule   Detailed template only — by design
```

So: **yes, we can produce that quality of itinerary and quotation** — and as of
today we actually do. Before today the prices were roughly double and there was
no plan attached.

What is still missing from the printed quotation is **imagery** —
`presentation` is empty, so no destination photo, no hotel shot, no logo. The
template slots exist; the content does not. That needs file upload (#33) and is
the last thing between this and a quotation that looks like a brochure.

## The honest summary

The spine is sound and better than I expected in two specific places: the AI
itinerary being visible on the lead, and the customer being able to accept a
quotation themselves and have the booking appear automatically. Most travel CRMs
cannot do either.

What is missing is almost entirely at the **edges where the system meets the
customer** — delivering the quote, taking the money, capturing the chat, telling
them what is confirmed. The middle is built; the two ends are open.

Item 1 is configuration and would take an afternoon. Nothing else on this list
matters until it is done, because a CRM whose messages never arrive is a
notebook.
