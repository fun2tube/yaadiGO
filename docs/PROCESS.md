# How we build

One loop, run per module, never skipped. Written down because the failure mode
of this project has been *building the back end and calling the module done* —
the Team API shipped with no page, the quotation approval marked a lead won with
no booking behind it. Both were caught late by luck. The gates below are what
replace luck.

```
  ┌──────────────────────────────────────────────────────────────┐
  │  1. CTO      architecture + contracts + risks                 │
  │  2. UI/UX    screens, states, empty/error/loading, mobile     │
  │  3. PM       task breakdown, acceptance criteria, sequence    │
  │  4. DevOps   build to the spec, tests alongside               │
  │  5. PM       review vs acceptance criteria — does it WORK     │
  │  6. CTO      review vs architecture — is it CORRECT and SAFE  │
  │  7. Fixes    corrections become tasks, not notes              │
  └──────────────► back to 5 until both reviews pass ─────────────┘
```

## What each role is responsible for

**CTO.** Data model and contracts. Where state lives and who owns it.
Transaction boundaries. Failure modes. Security. Says no to complexity that
does not pay for itself. Reviews for correctness, not taste.

**UI/UX.** Every screen drawn before code. Critically: the states nobody
remembers — empty, loading, error, permission-denied, partial-failure. Mobile
layout first, because the people using this are on a phone between calls.

**PM.** Breaks the module into tasks with *testable* acceptance criteria.
Sequences them. Reviews the built thing against those criteria by using it, not
by reading the diff. Owns "is anything missing".

**DevOps.** Builds. Writes the test alongside the code, not after. Runs the
gate. Reports honestly when something does not work.

## Definition of done

A module is done when **all** of these are true. Any "no" means it is in
progress, whatever the code looks like.

- [ ] Data model written down and reviewed
- [ ] Every screen exists, including empty / loading / error states
- [ ] Reachable from the navigation, gated by the right permission
- [ ] Server-side permission check on every route (not just a hidden link)
- [ ] Happy path tested end to end against a running server
- [ ] At least one failure path tested (bad input, no permission, conflict)
- [ ] Events emitted so reporting and notifications see it
- [ ] Reconciles — no orphan records, no stage with nothing behind it
- [ ] `npm test`, `eslint`, `next build` all clean
- [ ] PM review passed
- [ ] CTO review passed

## Review rules

Reviews are written to `docs/reviews/YYYY-MM-DD-<module>.md` and kept. A review
that is not written down is a review that gets forgotten and repeated.

Every finding becomes a task in `docs/BACKLOG.md` with an owner and a severity.
"I noticed X" is not a finding; "X is broken, here is how to reproduce it, here
is the fix" is.

**Severity:**
- **S1** — loses data, loses money, or exposes something. Stop and fix.
- **S2** — the feature does not actually work for a real user. Fix before done.
- **S3** — works but will hurt later. Scheduled, not ignored.
- **S4** — polish. Batched.

## The rule that matters most

**Criticise the work, specifically, including your own.** A review that finds
nothing is a review that did not happen. Every module built so far has had at
least one real defect found at review — the dropped `unitCost` field that made
every quotation report 100% margin was found this way, and it would have told a
salesperson they could discount without limit.

State what is broken plainly, with the reproduction. Then fix it.
