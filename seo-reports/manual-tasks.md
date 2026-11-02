# Manual tasks — things that cannot be done from code

Each one is blocked on a decision, a credential, or an asset that does not exist in the
repository. Ordered by what it costs to leave undone.

---

## M1 — Decide the AI training-crawler policy · **decision**

`src/app/robots.js` now states three crawler groups separately. All three are currently
**allowed**, which is exactly what the previous `User-Agent: *` rule did — so nothing has
changed in practice and nothing is urgent. But the third group deserves a real answer:

| Group | Sends traffic back? | Current |
|---|---|---|
| Search (Googlebot, Bingbot, Applebot) | Yes | Allow |
| AI **search** (OAI-SearchBot, PerplexityBot, ClaudeBot, ChatGPT-User) | Yes — cites and links | Allow |
| AI **training** (GPTBot, Google-Extended, CCBot, Bytespider, meta-externalagent) | **No** | Allow |

**My recommendation: keep all three allowed.** The second group is where trip-planning
discovery is moving and blocking it would be self-harm. The third sends nothing back, but
blocking it buys little for a 54-page site and the two groups are easy to confuse — several
operators have accidentally de-listed themselves from AI search by blocking a name they
thought was a training bot.

To change it: flip `allow` to `disallow` on `AI_TRAINING_AGENTS` in `src/app/robots.js`.
One line, nothing else to touch.

---

## M2 — Supply the Instagram and YouTube handles · **asset** (backlog #87)

`SOCIAL` in `src/lib/site.js` is all `null`, so three things stay switched off:

- `sameAs` in the Organization schema — the single strongest entity signal available to a
  brand this size, and it costs nothing
- the footer social links
- the homepage video reel (`VIDEOS` is empty)

Paste the profile URLs into `SOCIAL` and all three light up. No code change.

---

## M3 — Real trip photography · **asset** (backlog #91)

Blocks per-trip `og:image` using an actual photograph (the typeset cards shipped in Phase 2
are the interim answer), the `image` property on `TouristTrip`, and the gallery blocks in
quotations.

Priority order if photography is commissioned incrementally: Spiti, Ladakh, Kashmir,
Meghalaya — the four highest-intent searches in the current catalogue.

---

## M4 — Initialise git · **environment**

This directory is not a git repository. The brief asked for one branch per phase with
small commits prefixed by task ID; none of that was possible. Work is sequenced in these
reports instead.

`git init` plus a first commit would make the next phase reviewable as a diff, which
matters more here than usual — several bugs found in this codebase were silent field drops
that a diff would have caught.

---

## M5 — GSTIN and CIN · **data** (backlog #89)

`REGISTRATION` in `src/lib/site.js` is `{ cin: null, gstin: null }` with a TODO. A
corporate client's finance team looks for both before raising a PO, and the corporate desk
is the highest-value segment on the site.

Both belong in the footer and on `/about`. **Do not** put them in schema unless they are
also visible on the page.

---

## M6 — Confirm the postal code and registered address · **data**

`ADDRESS` carries `street: "Kalkaji"`, `locality: "New Delhi"`, `postalCode: null`, with a
TODO to fill in from the CIN certificate. A `PostalAddress` without a postal code is weak
for local search, and "Kalkaji" alone is a neighbourhood rather than a street address.

---

## M7 — Submit the sitemap and watch Search Console · **external**

Nothing in the repo can do this.

1. Verify `https://www.yaadigo.com` in Google Search Console and Bing Webmaster Tools.
2. Submit `https://www.yaadigo.com/sitemap.xml` (54 URLs).
3. After a week, check **Pages → Not indexed** and the **Rich results** report —
   specifically that `TouristTrip` is now detected on `/customized-tours/*`, which it
   was not before this phase.
4. Re-measure Core Web Vitals from **field** data. Everything in B5 of the audit is lab
   data from a dev server and should not be acted on until field numbers exist.

---

## M8 — Decide whether `/plan` and `/credits` should be indexed · **decision**

Both return 200 with no `robots` meta, so both are indexable. That is probably right for
`/plan` (it is a real entry point and is in the sitemap) and questionable for `/credits`.

Flagged rather than changed: per the brief, no `noindex` goes on a public page without the
affected URL list being approved first. The list would be exactly `/credits`.

---

## M9 — Review one pre-existing published claim · **decision**

Not introduced by this work, but it is a promise in a meta description and on-page copy:

> `/customized-tours` — "get a free draft itinerary back **within hours**"

It is consistent between the description and the page's own step list, so it is at least
not self-contradictory. Worth confirming the desk can actually hold to it, because it is
the kind of line a customer quotes back. The equivalent claim was removed from `/contact`
during Phase 5 for exactly this reason.

---

## Standing rule, for whoever picks this up next

From the brief, and it held up well in practice:

> No fake data. No invented reviews, ratings, GTINs, prices, stock, addresses or
> certifications. If data is missing in the database, report it as a gap; don't fill it
> with placeholders that get published.

The site currently publishes **no** ratings or review counts anywhere. That means there is
no `AggregateRating` in any schema on the site, and there must not be one until real
reviews exist. `/llms.txt` states this explicitly so an assistant does not infer one.
