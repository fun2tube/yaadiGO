# Review — content and design pass on the public site

**Date:** 2026-09-30 · **Role:** UI/UX + content, reviewed at PM and CTO level
**Follows:** `docs/design/ai-and-video-website.md`

The AI and video layer was deferred deliberately: it sits on top of a site whose
copy, proof and content have to be right first, and none of them were.

---

## What was actually wrong

### S1 · The site has almost no way to contact it

The only consumer-facing channel on the entire public site was
`corporate@yaadigo.com` — an address aimed at finance teams.

`CONTACT.phone`, `CONTACT.whatsapp`, `CONTACT.email`, every social profile, the
CIN and the GSTIN were all `null`. The module handles that correctly and renders
nothing rather than a placeholder, which is the right behaviour and also why it
went unnoticed: **the site looks finished while being unreachable.**

Every "WhatsApp us" button on the site — hero, close panel, floating action
button — was silently falling back to `/contact`, where there was no phone
number either.

For an Indian leisure travel business this outranks every design problem on this
page. `info@yaadigo.com` is now wired in as the general enquiry address. The
phone and WhatsApp numbers are real-world facts nobody has supplied and are not
inventable.

### S2 · The h1 sold three businesses in one sentence

> "Trips we plan, tours we run, and a travel desk companies trust with the
> boring parts."

Group tours, custom trips and a B2B corporate desk, in the first thing a visitor
reads. Someone planning a honeymoon had to parse a corporate pitch to work out
whether the site was for them.

Corporate already has its own homepage panel and its own subdomain. It does not
need to share the h1. Replaced with the one thing that is actually
differentiated — the trip is written down, free, before any money moves.

### S2 · Three of the homepage statistics were unverifiable, and one was wrong

`10+ years`, `40+ destinations`, `24h corporate turnaround`.

Nobody outside the company can check the first or third. The second did not
match the catalogue. **A number a visitor can disprove by scrolling is worse
than no number**, and the competitors we are measured against lead with figures
that are specific and checkable — 4.6/5 from 9,070 reviews, 143+ trips booked
last week.

All three now derive from the catalogue in `src/lib/proof.js`: 57 bookable
departures, 80+ named places, and ₹0 payable until you approve. They cannot
drift from what the site sells because they are computed from it.

### S2 · Zero social proof anywhere, and two components built to provide it are dead

`Testimonials` renders nothing (the array is deliberately empty — correctly, no
fake reviews) **and is imported by no page at all.** `TrustStrip` is likewise
imported by nothing.

We have no reviews and will not invent them. So "Why YaadiGo" — four
generic benefit cards — became four claims a visitor can verify on this site in
about thirty seconds: live seat counts, the itinerary written before payment,
nothing payable until approval, a registered company rather than a lead
marketplace. **Verifiable beats impressive when you cannot have both.**

### S2 · Three blog posts, two of them B2B

The content plan calls for decision queries — the comparisons and timing
questions people actually search before booking, which are close to uncontested
because everyone else writes "Top 10 Places in Kerala".

Five added, each grounded in trips the catalogue actually sells:
Ladakh June vs September, Andaman vs Maldives, Kerala backwaters vs hills,
Spiti vs Ladakh, Vietnam vs Thailand.

Every one commits to a recommendation, carries its failure case in a `note`
block, and answers the spoken form of the question in `faqs`.

### S3 · The post renderer could only produce flat paragraphs

No headings to skim, no lists to lift. Now supports `{ h }`, `{ list }` and
`{ note }`; plain strings still render as paragraphs so the three existing posts
are untouched.

`faqs` emits **FAQPage schema** — the markup that decides whether an assistant
can quote us when somebody asks the question out loud. Emitted only when a post
carries questions, since an empty FAQPage is a structured-data error rather than
a neutral no-op. This closes part of backlog #19.

---

## Self-criticism — the weakest thing I shipped

**"80+ places" is the least defensible of the three new statistics.**

It is true and derived — it counts distinct place names across all 34 trips,
splitting "Srinagar · Gulmarg · Pahalgam" into three. But my own argument for
replacing the old numbers was *verifiable beats impressive*, and a visitor
cannot check this one without adding up 34 destination strings. It is also a
**larger** number than the "40+ destinations" it replaced, which invites exactly
the suspicion the change was meant to remove.

The genuinely checkable alternative is "34 trips", which is less impressive and
countable in a minute on two listing pages. I kept places because the label says
"places" rather than "destinations" and is precise about what it counts — but
this is a judgement call, and it is the one item here I would not defend
strongly if challenged.

**Not verified:** none of this was tested on a real phone. The panel-swipe reel
and the new proof grid were checked at mobile widths in a browser only.

---

## What only the business can supply

None of the below is inventable, and each blocks something real:

| Missing | Blocks |
|---|---|
| WhatsApp number | Every WhatsApp button on the site. The primary Indian enquiry channel. |
| Phone number | Contact page, footer, schema, and any visitor who wants to call before paying. |
| CIN + GSTIN | The footer and About page. A corporate finance team looks for these. |
| Instagram / LinkedIn | `sameAs` in Organization schema, and the whole video distribution plan. |
| Real reviews, with permission | The one thing that would let us compete on social proof honestly. |

---

## Status

Content and design pass: **done for this round.** The site now says one clear
thing, backs it with numbers that cannot drift, and has content aimed at the
queries that precede a booking.

It still cannot be phoned or messaged. That is the next thing to fix, and it is
not a development task.
