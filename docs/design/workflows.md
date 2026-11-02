# Workflows — who does what, and when

**Date:** 2026-10-01 · **Audience:** admin, sales, operations
**Source of truth for:** stages, permissions, handoffs, notifications

> **Superseded in part, 2026-10-09.** Role duties, permissions and feature
> status now live in [`team-operating-model.md`](./team-operating-model.md),
> which was written against a fresh audit of the running system. The diagrams
> below are still accurate; the status columns here are not.

Three roles, three jobs. The rule the whole system is built around:

> **Sales owns the customer until the money is in. Operations owns the trip from
> the money until they come home. Admin owns neither and sees both.**

Everything below follows from that sentence.

---

## 1 · The lead cycle

```mermaid
flowchart TD
    subgraph SOURCES["Where leads come from"]
        A1["AI Planner<br/>itinerary attached"]
        A2["Ask Yaadi<br/>chat transcript"]
        A3["Enquiry form<br/>contact / trip page"]
        A4["Phone / WhatsApp<br/>typed in by sales"]
    end

    A1 --> CAP
    A2 --> CAP
    A3 --> CAP
    A4 --> CAP

    CAP{"Capture"} --> DUP{"Seen this<br/>phone/email<br/>in 90 days?"}
    DUP -->|yes| MERGE["Attach as a new<br/>interaction on the<br/>existing lead"]
    DUP -->|no| OWN["Assign owner —<br/>lightest open pipeline"]
    MERGE --> OWN

    OWN --> NEW["NEW<br/>due today"]
    NEW -->|"4h untouched"| ESC1["Nudge owner"]
    NEW -->|"1 day untouched"| ESC2["Alert admin<br/>offer reassignment"]

    NEW -->|"called"| CONT["CONTACTED"]
    CONT -->|"budget + dates real"| QUAL["QUALIFIED"]
    QUAL -->|"quotation sent"| QUOTED["QUOTED"]
    QUOTED -->|"reworking price"| NEG["NEGOTIATING"]
    NEG --> QUOTED

    QUOTED -->|"customer accepts"| WON["WON<br/>booking created"]
    NEG --> WON

    NEW -.-> LOST
    CONT -.-> LOST
    QUAL -.-> LOST
    QUOTED -.-> LOST
    NEG -.-> LOST
    LOST["LOST<br/>reason required"]

    WON ==> BOOK["→ booking cycle"]
```

**Rules the system enforces, not conventions people remember:**

- A new lead is due **today**. An enquiry that sits overnight goes to a
  competitor.
- `LOST` **cannot be set without a reason** — picked from a list, because free
  text produces unusable reporting.
- Every lead has an owner. No orphans, ever.
- A salesperson sees only their own pipeline plus unassigned. Scope is enforced
  in the API, not the UI, so editing the query string changes nothing.

## 2 · The booking cycle

```mermaid
flowchart TD
    Q["Quotation approved"] --> B1["ENQUIRY<br/>booking created"]
    FD["Fixed-departure<br/>seat request"] --> B1

    B1 --> B2{"Seats<br/>available?"}
    B2 -->|no| ALT["Offer another batch"]
    B2 -->|yes| B3["CONFIRMED<br/>seats held"]
    ALT --> B2

    B3 --> PAY1["Payment link sent<br/>WhatsApp + email"]
    PAY1 --> P1["PART-PAID<br/>advance received"]
    P1 --> PAY2["Balance reminder<br/>T-21 days"]
    PAY2 --> P2["PAID<br/>in full"]

    P2 --> INV["Invoice issued<br/>YG/26-27/NNNN"]
    INV --> OPS["HANDED TO OPS<br/>sales steps back"]

    OPS --> SVC["Service checklist created<br/>from trip type"]
    SVC --> S1["Hotels booked"]
    SVC --> S2["Transport booked"]
    SVC --> S3["Visas / permits"]
    SVC --> S4["Vouchers issued"]

    S1 --> RDY
    S2 --> RDY
    S3 --> RDY
    S4 --> RDY
    RDY{"All services<br/>confirmed?"} -->|no| CHASE["Ops chases supplier"]
    CHASE --> RDY
    RDY -->|yes| READY["READY TO TRAVEL<br/>pre-departure pack sent"]

    READY --> TRAV["IN PROGRESS<br/>24×7 cover"]
    TRAV --> DONE["COMPLETED"]
    DONE --> FB["Review request<br/>+ referral ask"]

    B3 -.-> CAN["CANCELLED<br/>seats released<br/>refund recorded"]
    P1 -.-> CAN
```

**Rules the database enforces:**

- Seats cannot go negative, and cannot exceed the batch total. Both are CHECK
  constraints, not application logic.
- Seats are held by `confirmed`, `part-paid`, `in-progress` — **releasing a seat
  on a part-paid booking would sell it twice.**
- An invoice number is unique per financial year and immutable. Issuing twice
  returns the same number.
- A payment that would exceed the booking total is refused unless overridden
  deliberately.
- A booking must have an origin — a quotation or a departure. No floating
  bookings.

## 3 · Who does what

```mermaid
flowchart LR
    subgraph SALES["SALES — owns the customer"]
        direction TB
        SA["My Day<br/>due today · overdue · chase"]
        SB["Call / WhatsApp<br/>log the outcome"]
        SC["Build quotation<br/>AI draft, then edit"]
        SD["Send + chase<br/>2 / 5 / 10 days"]
        SE["Take payment<br/>send the link"]
        SA --> SB --> SC --> SD --> SE
    end

    subgraph OPS["OPERATIONS — owns the trip"]
        direction TB
        OA["Handover queue"]
        OB["Service checklist<br/>per trip type"]
        OC["Book suppliers<br/>record cost + reference"]
        OD["Vouchers +<br/>pre-departure pack"]
        OE["On-trip cover<br/>24×7"]
        OA --> OB --> OC --> OD --> OE
    end

    subgraph ADMIN["ADMIN — owns neither, sees both"]
        direction TB
        AA["Pipeline + forecast"]
        AB["Per-person KPIs"]
        AC["Margin by trip<br/>and by salesperson"]
        AD["Team: invite ·<br/>approve · permissions"]
        AE["Catalogue + pricing"]
        AF["Outbox — what<br/>actually got sent"]
    end

    SE ==>|"paid in full"| OA
    OPS -.->|"cost actuals"| AC
    SALES -.->|"activity"| AB
```

**The handoff is the hinge.** It happens on **paid in full**, not on booking,
and it is explicit — a salesperson hands over and stops owning it. Before that
moment, operations should not be spending money on a trip that is not paid for.
After it, sales should not be fielding "what time is my pickup" calls.

## 4 · Notifications — who hears what, and where

In-app always works; it is a record in this system and needs no provider.
Email and WhatsApp need a provider configured.

| Event | Customer | Sales | Ops | Admin |
|---|---|---|---|---|
| Enquiry received | ack (email + WA) | **in-app + WA** | — | in-app |
| Lead untouched 4h | — | **nudge** | — | — |
| Lead untouched 1 day | — | nudge | — | **alert** |
| Quotation sent | **link (WA + email)** | — | — | — |
| Quotation viewed | — | **in-app** | — | — |
| No reply 2 / 5 days | reminder | in-app | — | — |
| No reply 10 days | — | **"decide"** | — | in-app |
| Quotation accepted | receipt | **in-app + WA** | — | in-app |
| Payment link sent | **link** | — | — | — |
| Payment received | receipt | **in-app** | — | in-app |
| Paid in full | receipt + invoice | in-app | **in-app — new handover** | in-app |
| Service confirmed | — | — | in-app | — |
| Service overdue | — | — | **alert** | alert |
| Ready to travel | **pre-departure pack** | in-app | in-app | — |
| T-7 days | reminder | — | in-app | — |
| Trip completed | **review request** | in-app | — | in-app |
| Payment failed | **retry link** | **alert** | — | alert |
| Seats low on a held batch | — | in-app | — | in-app |

**The principle:** the customer hears about *their trip*. Sales hears about
*their leads*. Ops hears about *work to do*. Admin hears about *exceptions* —
never the routine, or the alerts stop being read.

---

## 5 · Permissions

| Capability | Sales | Ops | Admin |
|---|---|---|---|
| See own leads | yes | — | yes |
| See everyone's leads | — | — | yes |
| Edit lead stage | own | — | any |
| Transfer a lead | own | — | any |
| Build / send a quotation | own | — | any |
| Approve a quotation | own | — | any |
| Record a payment | own | — | any |
| Issue an invoice | — | — | yes |
| Hand to operations | own | — | any |
| See the handover queue | — | yes | yes |
| Add / update services | — | yes | yes |
| See supplier cost | — | yes | yes |
| See margin | own deals | — | everything |
| Catalogue + pricing | — | — | yes |
| Invite / approve staff | — | — | yes |
| Reports across the team | — | — | yes |
| Outbox | — | — | yes |

Two deliberate choices:

**Ops never sees margin on the sales side, and sales never sees supplier
invoices.** Each sees the cost of their own half. It keeps negotiation clean.

**Only admin issues invoices.** An invoice is a legal document with a sequential
number; it is not a sales action.
