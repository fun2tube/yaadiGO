# Review — quotation templates + follow-up automation

**Date:** 2026-09-29 · **Specs:** `design/follow-ups.md`, `design/quotation-templates.md`

---

## Part 1 — Follow-up automation (#14)

### The decision that shaped it

**Make the work visible before automating it.** A cron job needs a deployment, a
cron provider and an email provider — none of which exist yet. The human half
needs none of that.

So it shipped in two halves: a **Chase bucket in My Day, computed on read**
(works today, no infrastructure), and a **cron endpoint** that is wired but
dormant. Building the automated half first would have produced a feature nobody
could see working.

### PM review

| Criterion | Result |
|---|---|
| Chase bucket shows the right quotations | ✅ 1-day excluded, 3/6/12-day included |
| Endpoint refuses without the secret | ✅ 401 for missing and wrong alike |
| Running twice does not double-send | ✅ run 3 → `chased: 0` |
| `validUntil` past → expired | ✅ |
| Nothing auto-marked lost | ✅ cold is a flag, not a verdict |

### CTO review

**S2 · A quotation could go cold having never been chased — fixed.**

Testing with a 12-day-old quotation exposed it: the first version matched
*state* to *step*, so anything that jumped straight to `cold` — because the cron
was off for a fortnight, or `CRON_SECRET` was unset — got flagged cold with
**zero reminders sent**. The customer received nothing at all, which is the
precise failure this feature exists to prevent.

Now driven by **age**, catching up:

```
before        12d → cold, 0 reminders
after   run 1 12d → 1 reminder
        run 2 12d → 2 reminders
        run 3 12d → flagged cold
```

The cold flag fires only once the reminders are exhausted. Found by seeding the
ladder rather than testing the happy path.

---

## Part 2 — Quotation templates

### The rule that governs the build

**Changing template must never change a figure.**

Every block carrying a number, a date or a policy lives once in `blocks.js`.
The three templates in `templates.js` only choose which blocks appear and in
what order. Three hand-written costing tables would drift, and the one that
drifts is the one a customer holds you to.

Verified on one quotation rendered three ways:

```
simple     The plan · Hotels · Costing · To confirm · How to book · Terms
modern     Day by day · Hotels · Flights · Costing · Payment · How to book · Terms
detailed   Day by day · Hotels · Flights · Costing · Payment · Cancellation · …

₹48,300 in all three
```

### PM review

| Criterion | Result |
|---|---|
| Three templates, stored on the record | ✅ |
| Customer link renders the chosen one | ✅ |
| Hero + per-day images from the media library | ✅ 36 licensed images, searchable |
| Hotel/flight blocks accept a pasted URL | ✅ |
| A missing image collapses its block | ✅ `QuoteImage` returns null |
| Payment, terms, how-to-book have defaults | ✅ |
| Template change alters no figure | ✅ measured above |

### CTO review

**Presentation is editable on a SENT quotation. Deliberate.**

`setPresentation` is a separate action from `updateDraft` and is allowed after
sending, because a template, a hero image or a reworded overview is not the
offer. The figures stay frozen.

The safety is a **whitelist**: ten keys, none of them monetary. A crafted
request cannot smuggle a price through `content`, because no code path from
this endpoint reaches a money field.

**Defaults that prevent arguments rather than decorate.** The cancellation
schedule is concrete windows and percentages, not *"cancellation charges as
applicable"* — that phrase means nothing until someone cancels, and then it
means whatever the operator says. Hotel substitution and unticketed airfare are
stated in the body, not buried in terms, because those are the two complaints
that actually happen.

**Payment schedule sums back to the total.** Percentages are rounded per row
with the remainder pushed into the last one. A schedule that adds up to ₹3 less
than the invoice is what a customer notices and an accountant cannot reconcile.

### Honest limits

**No file upload.** Hotel and flight images are pasted URLs, because there is
no object storage — that arrives with Supabase Storage. The field says *"paste
a link"* rather than showing a disabled upload button.

**Print is browser Save-as-PDF**, with per-template rules. Detailed caps day
images at 48mm so a twelve-day itinerary does not split a card across a page.
Not verified against a real printer — only against the stylesheet.

## Status

#14 — **Done.** Quotation templates — **Done.** Both reviews passed after one
correction each.
