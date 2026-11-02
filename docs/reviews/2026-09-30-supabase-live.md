# Review — the CRM is live on Supabase

**Date:** 2026-09-30 · **Backlog:** #8 (S1) · **Closes the data-loss risk**

## It works

```
13 tables · 66 CHECK constraints · 23 unique indexes
PostgreSQL 17.6 · ap-southeast-2

sign-in            200   (user id is now a UUID, not user_xxx — Postgres)
/admin             200
/admin/leads       200
/admin/bookings    200
/admin/quotations  200
/admin/operations  200
/admin/reports     200
/admin/team        200
```

Constraints verified firing on the live database, not just in tests:

```
✓ refused   lost lead with no reason
✓ refused   departure ending before it starts
✓ refused   oversell a batch          (seats untouched: 4)
✓ refused   booking with no origin
✓ refused   Priya@ alongside priya@
```

**The data-loss risk is closed.** Leads, quotations, bookings and payments now
survive a deploy.

---

## Four defects found by going live. All mine.

### S1 · `max: 1` hung every admin page

`max: 1` is correct advice for a **serverless function**, where each invocation
is isolated and a pool of ten per instance multiplies into hundreds of idle
connections. It is actively wrong for a **long-running server**: `next start`
serves every request from one process, so one connection serialises them all —
and against a database 335ms away, requests queue until they time out.

Every admin page returned `000` after 90 seconds. No error in the log, because
nothing failed; everything waited.

Now detected rather than guessed: `max: 1` when `VERCEL` or
`AWS_LAMBDA_FUNCTION_NAME` is set, 10 otherwise, overridable with
`DATABASE_POOL_SIZE`.

### S2 · `drizzle-kit migrate` exits clean having applied nothing

Through a Supabase pooler it created its own bookkeeping schema, then silently
applied zero statements and exited 0. The database was empty and the tool said
it had succeeded.

**A tool that succeeds without doing the work is worse than one that fails.**
`db:setup` now applies the SQL itself and reports the count — 69 statements, 13
tables — so an empty database cannot masquerade as a migrated one.

### S3 · My own doctor rejected the correct connection string

It refused `DIRECT_DATABASE_URL` for containing "pooler", on the general rule
that migrations need a direct connection. That rule is wrong for this project:
the direct host is IPv6-only and unreachable, making the **session pooler** the
only thing that works.

Now it checks the **port** — 6543 is transaction mode and cannot run DDL; 5432
is session mode, direct host or pooler alike.

### S3 · An "optimisation" that made it slower

I removed what looked like a duplicate lead fetch in `buildMyDay`. The page went
from **1.43s to 1.81s** — because the duplicate was *parallel*, and removing it
made the remaining query *sequential*.

Restructured into one parallel batch with the computation split out as a pure
function. Result: **1.45s** — back where it started.

The lesson, written into the code: at 335ms RTT what costs is a sequential
query, not an extra parallel one. Measured, then corrected, rather than assumed.

---

## The finding that matters most: the region is wrong

```
measured, warm:   335ms per query to ap-southeast-2 (Sydney)
admin page:       ~1.45s
```

The database is in **Sydney**. The business and its staff are in **India**.
Roughly 335ms of that page is light travelling to Australia and back, several
times over.

**ap-south-1 (Mumbai) would be 30–50ms** — the same pages in roughly 250–400ms,
a 4–5× improvement, from changing nothing but where the data lives.

I could not optimise around it and stopped trying: the attempt above made it
worse, and the parallel version only got back to level. No amount of query
tuning beats moving 8,000km closer.

**Supabase cannot move a project between regions.** It means creating a new
project in ap-south-1 and re-running `npm run db:setup`. There is no production
data yet — only my test rows — so this is *cheap today and expensive in three
months*, once real leads and bookings are in it.

That is the recommendation, and it is the last decision worth making before
real customer data lands.

---

## Also worth knowing

**The password is in `.env.local` percent-encoded** — `Beayaadi@123` becomes
`Beayaadi%40123`, because a raw `@` breaks URL host parsing. That is why the
first attempt failed.

**The transaction pooler rejected the password for several minutes** after the
reset, while the session pooler accepted it. Propagation lag, not a
misconfiguration — it resolved on its own. Worth knowing before debugging it
next time.

**The database password is the same as `ADMIN_PASSWORD`.** Not a defect, but
two different systems sharing one secret means rotating either one means
rotating both.

## Status

#8 — **Done.** Sprint 2's core is complete: the CRM runs on Postgres and the
data-loss risk is closed. Remaining in Sprint 2: #31 (paise above the
repository), #32 (catalogue), #11 (outbox worker), #12 (delete the file store).
