# Phase 1b, customers: DevOps + PM + CTO review

**Date:** 2026-11-02 · **Spec:** docs/design/ai-cofounder.md §2, §6a

## CTO: what was built

**`customers` table (migration 0007):**

- Columns: name, phone and email as typed, plus normalised `phone_key` and
  `email_key`, both UNIQUE; company, city, first source and first seen,
  tags, notes, marketing consent.
- CHECKs:
  - `customers_reachable`: a phone or an email is required;
  - `customers_consent_dated`: consent needs a date (DPDP Act).
- `leads.customer_id` (FK, set null, indexed).

**Backfill** in the same migration: existing leads become customers. Phone
first; email only where it belongs to one phone. Every lead is linked.

**Matching** (`lib/crm/contact-keys.js`, shared with lead dedupe):

- A phone is its last 10 digits. An email is lower-cased and trimmed.
- An email identifies someone only if it cannot contradict a phone.
- Website enquiries only fill blanks on an existing customer.
- A unique-key race re-reads the winner.

**Capture:** `captureLead` links the customer. A failure is logged and never
loses the lead.

**Screens:**

- `/admin/customers`: search by name, phone, email, company or city; repeat
  badge; enquiries, bookings, ₹ booked, last activity.
- `/admin/customers/[id]`:
  - every enquiry with its quotations and bookings;
  - booked, owed and repeat totals;
  - call and WhatsApp buttons;
  - edit form (consent dated, and a clash names the other customer with a
    link).
- Lead pages link to their customer.
- Scope as with leads: without `team.read`, only customers with a lead you
  own. Enforced in the list, the page and the API.

## DevOps: verified

`src/db/customers.test.ts` (9 tests, real Postgres) covers:

- **Matching:** formats of one number, adding an email or a phone later,
  shared family email.
- **Database rules:** a second customer on one phone is refused, as is a
  customer with no contact.
- **Capture:** a repeat after a won lead reaches the same customer.
- **The backfill itself:** run on seven hand-made leads, it produces exactly
  the expected customers and links.
- **Totals:** a cancelled booking is excluded, payments come from the ledger,
  and the sales scope holds.
- **Editing:** a clash is refused, and consent is dated.

Beyond that:

- Admin panel smoke tests include Customers and a search.
- Full suite: all green except the known `trip-seats` date test (#183).
- In a browser, against the local store, signed in as the QA admin:
  - the list shows ₹1,92,780 booked, and a search for nobody shows the empty
    message;
  - the customer page shows the enquiry with its approved quotation, the
    part-paid booking and ₹1,82,780 owed;
  - saving City = Pune with consent stored both, with the consent date;
  - the lead page links back to the customer;
  - at 375 px there is no sideways scroll.

  Local test data was restored afterwards.

## Findings

**F1 (S2): a shared family email merged two people into one customer.
Fixed before shipping.** The first version matched by email whenever the
phone was new. So a son enquiring from his own number with the family
address became his father: one record, one history, the wrong person. Now
an email identifies someone only when it cannot contradict a phone, the same
rule as the backfill. The test was first written asserting the wrong
behaviour, then corrected. That is why tests get read, not just run.

**F2 (S3): lead dedupe still matches by email alone.** Within 90 days, that
son's enquiry attaches to his father's open *lead*, even though he is now a
separate *customer*. The rule predates this work. Align it with the customer
rule. → #196.

**F3 (S3): no way to merge two records of one person.** For example, someone
who changed their number. → #197: a merge on the customer page that moves
leads and keeps the older record.

**F4 (S3): "collected" has two sources.** The lead page reads each
booking's cached `collected`; the customer page reads the payments ledger.
They agree while the cache is maintained. Reports already use the ledger.
→ #198: one source.

**F5 (S4): customer stats are computed in memory over all leads, bookings and
payments.** Fine to a few thousand customers. Move to SQL when the agent
starts asking (Phase 2). → #199.

**F6 (test hygiene, fixed):** the `leads.test.js` stand-in store ignored the
collection name, so customers landed in its list of leads. It now keeps one
list per collection, as the real store does.
