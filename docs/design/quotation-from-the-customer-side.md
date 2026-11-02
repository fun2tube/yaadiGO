# The quotation, read by the person paying for it

**Date:** 2026-10-09 · **Question:** what does an Indian traveller need to see
before they say yes?

Not "what should a travel company put in a quotation". What does the person
reading it on WhatsApp, probably on a phone, probably forwarding it to a spouse
or a parent, actually need in order to decide — and what makes them hesitate.

Ranked by how much each one moves the decision.

---

## The five that decide it

### 1 · A total that cannot grow later

The single biggest trust problem in Indian travel. "Plus taxes as applicable"
and "entry tickets extra" are read, correctly, as *this number is not the
number*. Somebody has been caught by it before and they are reading your
quotation with that in mind.

What that means concretely:

- the total **for this group**, not just per person — a family does the
  multiplication anyway, and getting there first is a signal of good faith
- GST shown as its own line, with the rate
- an explicit **"nothing else to pay us"** where it is true
- everything excluded listed as a *rupee estimate*, not just named

**Status: mostly BUILT.** `Costing` shows subtotal, GST and total; per-person
is derived. `IncludedExcluded` names exclusions. **Gap:** exclusions carry no
indicative cost, so "monument entry tickets" is an unknown amount of money.

### 2 · The hotel's actual name

"4-star or similar" is read as "we will downgrade you". Indian travellers
check the property on MakeMyTrip or Google Reviews before replying — this is
near-universal and it is the step where quotations die quietly.

Name the property. Where it genuinely is not held yet, say
**"not confirmed — we will name it before you pay"** rather than hiding behind
"or similar".

**Status: BUILT but optional.** `content.hotels` takes a name per stay; the
Detailed template shows photos. Nothing forces it, and the default is empty.

### 3 · Honest drive times

This is the one most quotations hide and the one travellers most resent
afterwards. "Shimla → Kaza" reads like a line on a map; it is ten hours on a
road that is partly riverbed. A family with an eight-year-old and a parent
with a bad back are making a different decision if they know.

Every transfer day should carry **hours and road condition**, in the day card.
It costs a sale occasionally and prevents a furious review every time.

**Status: PARTIAL.** `planner.js` `DaySchema` has a `transfer` field, so the
AI itinerary carries it. The quotation's own day cards do not render it.

### 4 · Cancellation, in rupees

"50% of the package rate" requires the reader to do arithmetic about losing
money, under stress, while deciding. **"If you cancel between 29 and 8 days
before, you lose ₹62,212"** is the same clause, honestly stated, and it is the
one people re-read.

**Status: BUILT as percentages, not amounts.** The ladder is in
`DEFAULT_CANCELLATION`. Converting it to money is cheap and high-value.

⚠️ Blocked by **#88** — the current wording does not make clear whether 70% is
the refund or the charge. Those are opposite contracts and it is going out on
live quotations now. **This must be answered before the figure is computed**,
or we will print a confident wrong number.

### 5 · A named human with a mobile number

"Our support team" means nobody. A name and a number — the person who will
actually answer at 11pm when the driver has not arrived — converts, and it is
free.

**Status: NOT BUILT.** The footer carries the company number. The quotation
never names the salesperson, though `ownerId` is on the record.

---

## The next five

### 6 · Room configuration, spelled out

Who sleeps where. "2 rooms" for two adults, a nine-year-old and a grandparent
is a question, not a fact. State: *1 deluxe double + 1 deluxe double with an
extra mattress*. The brief now captures exactly this; the quotation should
print it.

**Status: CAPTURED, NOT PRINTED.** `brief.rooms` exists as of this week.

### 7 · Food, specifically

Meal plan codes mean nothing to a customer — "MAP" is already handled (shown
as plain English with the code). What is missing is the part Indian families
actually ask: **is pure-veg available, is Jain food possible, is there a
kitchen that will do a plain khichdi for a child or an elderly parent.**

On a Spiti or Ladakh trip this is a genuine constraint, not a preference.

**Status: CAPTURED, NOT PRINTED.** `brief.specialRequests` holds it.

### 8 · The exact vehicle

"AC vehicle" is meaningless. **Innova Crysta**, **Tempo Traveller 12-seater**,
**Swift Dzire** — these are known quantities, and a group of nine wants to
know whether nine people and nine bags actually fit.

**Status: NOT A FIELD.** Transport is a free-text line label today.

### 9 · Documents and permits

Inner Line Permit for Spiti and parts of Ladakh. ID proof for every hotel.
Passport validity for international. A customer who discovers a permit
requirement three days out is a customer who cancels.

**Status: PARTIAL.** `permit` is a line kind, so it can be priced. There is no
"what you need to carry" block for documents — `ThingsToCarry` covers clothing
and kit.

### 10 · Altitude and fitness, where it applies

Khardung La is 5,359m. Chandratal is 4,300m. AMS is real, and a quotation that
says nothing about acclimatisation days is quietly misleading a family with an
elderly parent.

**Status: PARTIAL.** The Spiti and Ladakh catalogue entries mention
acclimatisation in prose. Nothing systematic.

---

## What is already right, and worth keeping

Worth naming because it is unusual in this market:

- **Day-by-day with real places**, not "proceed to sightseeing"
- **Inclusions and exclusions written out** before payment
- **A payment schedule with real amounts** and a flat per-person advance
- **Three payment routes** including the 2.5% gateway fee stated up front —
  almost nobody discloses that before the payment screen
- **Things to carry**, from the brochure
- **A token link** the customer can reopen, rather than a PDF that goes stale

---

## What I would build, in order

| # | Change | Why it ranks here |
|---|---|---|
| 1 | **Cancellation in rupees** alongside the percentage | Highest decision impact for the least work — **blocked on #88** |
| 2 | **Name the salesperson, with their mobile** | Free, converts, currently absent |
| 3 | **Print the room split and special requests** | Data is already captured; it is a rendering change |
| 4 | **Indicative cost against each exclusion** | Turns "extra" from a fear into a number |
| 5 | **Drive hours on each transfer day** | The honesty that prevents the bad review |
| 6 | **Vehicle as a structured field** | Needs a schema change and a picker |
| 7 | **A documents/permits block** | Alongside Things to carry |
| 8 | **Altitude note, automatic above ~3,500m** | Derivable from the itinerary |

Items 2 and 3 need no decisions from anybody and are small. Item 1 is the most
valuable and cannot start until the cancellation wording is settled.
