# UI/UX spec — operations board

**Backlog #2 (S1) and #3 (S1) · Blocks: the ops team has no software at all**

## The job

A booking is paid. Somebody now has to actually buy the flights, hold the
hotels, brief the driver and tell the customer when to be where. Today that
happens in WhatsApp and a notebook, and the system knows none of it.

The ops person's questions, in the order they ask them:

1. What has been handed to me that I have not started?
2. What departs soonest?
3. On this booking, what is still unbooked?
4. What is the reference for the thing I booked last week?

The board answers those four. It is not a project management tool.

## Screens

### `/admin/operations` — the board

Grouped by urgency, not by status, because "departs in 4 days with 3 things
unbooked" is the only sorting that matters:

- **Needs attention** — departing within 14 days with any service still `todo`
- **In progress** — handed over, some services arranged
- **Upcoming** — handed over, everything confirmed, not yet travelling
- **Travelling / done** — collapsed by default

Each card: customer name, trip title, departure date with a countdown, a
progress line (`4 of 7 arranged`), and the outstanding balance if there is one —
ops should not be booking suppliers against money that has not arrived.

**Empty:** *"Nothing handed over yet. Bookings appear here once sales hands them
to operations."* This is the state on day one and it must explain itself.

### `/admin/bookings/[id]` — the booking, shared by sales and ops

One page, two audiences. Sales sees payments; ops sees services. Both see the
customer, the trip and the timeline. A separate ops-only page would mean two
places to look for the same booking, and they would disagree.

**Service list, grouped by day.** Each row: kind icon, title, supplier,
reference, time, status pill. Tapping opens an editor in place.

**Adding a service** is one tap → kind → title → save. Details (supplier,
reference, cost, times) are filled later, because ops adds "Hotel in Munnar"
long before they know which hotel.

## States

**Service statuses** — `todo` → `requested` → `confirmed`, plus `cancelled`.
`requested` matters: the supplier has been emailed and has not replied, which is
a different anxiety from not having started.

**Progress** is `confirmed ÷ total`, not `not-todo ÷ total`. A requested hotel is
not a booked hotel and the number must not imply it is.

**Money guard.** If a booking is handed over with an outstanding balance, the
card shows it in `warn`. Ops is not blocked — sometimes you hold a hotel on
trust — but nobody should commit spend without seeing it.

## The handover

A button on the booking, for sales, visible only when the booking is
`confirmed`, `part-paid` or `paid`.

It is **explicit, not automatic on payment.** Ops starts spending real money
with suppliers the moment they pick it up, and "the system moved it" is not a
good enough reason to have committed a hotel deposit.

Confirmation states what happens: *"Hand this to operations? They will start
booking suppliers. ₹12,075 is still outstanding."*

After handover: the booking shows who owns it in ops, and the ops team is
notified.

## Acceptance criteria

- [ ] `/admin/operations` lists only handed-over bookings, grouped by urgency
- [ ] Ops role can open it; sales-only role cannot
- [ ] Booking detail shows services grouped by day
- [ ] Add a service, set kind, title, supplier, reference, status
- [ ] Progress counts confirmed only
- [ ] Hand-over button appears for sales on a confirmed booking, not before
- [ ] Handing over sets `handedToOpsAt`, notifies ops, emits an event
- [ ] Outstanding balance visible on the ops card
- [ ] Empty, loading and error states present
- [ ] An ops user cannot record a payment; a sales user cannot edit services
