# UI/UX spec — quotation follow-ups

**Backlog #14 (S2) · The highest-return item left**

## The problem

A quotation sent and never chased is a lost sale. Chasing is also the first
thing a salesperson drops when the day gets busy — it feels like admin, it has
no deadline, and nobody notices it did not happen.

Today nothing tracks it. A quote sent on Tuesday and ignored is
indistinguishable from one sent an hour ago.

## The decision that shapes this

**Do not build a scheduler first. Make the work visible first.**

A cron job that emails customers needs a deployment, a cron provider and an
email provider — none of which exist yet. But the *human* half needs none of
that: compute which quotations are overdue a chase on read, and put them where
the salesperson already looks.

So this ships in two halves, and the first works immediately:

1. **Visible** — a "Chase" bucket in My Day, computed live. No infrastructure.
2. **Automatic** — a cron endpoint that queues the customer nudge and expires
   dead quotations. Wired, but dormant until there is a deploy and a provider.

Building the automatic half first would produce a feature nobody can see
working.

## The ladder

Measured from `sentAt`, on a quotation still `sent`:

| Age | State | What happens |
|---|---|---|
| 0–1 days | fresh | nothing — let them read it |
| 2–4 days | **chase** | appears in My Day; day-2 nudge queued |
| 5–9 days | **chase again** | stays in My Day, marked harder; day-5 nudge |
| 10+ days | **going cold** | flagged; the desk decides — never auto-lost |
| past `validUntil` | **expired** | status → expired, automatically |

Two days, not one. A quotation is a considered purchase and chasing the morning
after reads as desperate. Two days is attentive.

**Nothing is ever auto-marked lost.** "Going cold" is a prompt for a human, not
a verdict. A system that silently closes deals teaches people not to trust it,
and the one it closes wrongly is the one that was about to convert.

## Where it appears

**My Day gains a "Chase" tab**, beside Overdue / Today / New. Each row: the
customer, what was quoted, how long ago, and Call / WhatsApp on the row.

**The quotation itself** shows its own age and what has been sent:
*"Sent 4 days ago · 1 reminder sent · no reply."*

## The automatic half

`GET /api/cron/follow-ups`, protected by `CRON_SECRET` — a public URL that
mutates data needs a shared secret, and a missing one must **refuse** rather
than run openly.

Each run, idempotently:

- expires quotations past `validUntil`
- queues a day-2 and day-5 customer nudge, once each, recorded on the quotation
  so a re-run cannot send twice
- notifies the owner when a quotation goes cold

**Honest limit:** the nudges land in the outbox with `status: pending` until an
email or WhatsApp provider is configured. The UI says so rather than implying
the customer was contacted.

## Acceptance criteria

- [ ] My Day shows a Chase bucket with the right quotations
- [ ] A quotation 1 day old is NOT in it; 2 days old IS
- [ ] The quotation page shows its age and reminders sent
- [ ] `/api/cron/follow-ups` refuses without the secret
- [ ] Running it twice does not queue two nudges
- [ ] `validUntil` in the past sets status to expired
- [ ] Nothing is ever auto-marked lost
- [ ] Owner is notified when a quotation goes cold
