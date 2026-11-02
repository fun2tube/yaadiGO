# Phases 2–5 — what changed

**Date:** 2026-10-08 · **Gate after every phase:** 123 tests pass, lint clean, `tsc --noEmit`
clean, `next build` succeeds, all 23 public URLs return 200.

No URL changed. No `noindex`, `Disallow` or canonical was added to any public page.
Every number published is one the site already shows.

## Phase 2 — Share cards (fixes A1)

**The bug:** `generateMetadata` returning an `openGraph` object **replaces** the parent's
rather than merging into it. Every page that set its own `og:title` silently dropped the
inherited `og:image`. Trip pages and blog posts — the two things people actually forward —
were sharing as a grey box.

`/customized-tours/[slug]` already carried a hand-rolled workaround (`images:
["/opengraph-image"]`) pointing at the generic site card. That patched one template and
documented the bug without fixing the other two.

**The fix:** a colocated `opengraph-image.js` per template. Next gives the more specific
image precedence over anything above it in the folder tree, and unlike a metadata key it
cannot be clobbered by a `generateMetadata` return value.

| File | What the card shows |
|---|---|
| `src/components/og-card.js` | Shared layout + `OG_RESPONSE` cache options |
| `src/app/group-tours/[slug]/opengraph-image.js` | Trip name · duration · from-price · next departure |
| `src/app/customized-tours/[slug]/opengraph-image.js` | Package name · duration · from-price · best season |
| `src/app/blog/[slug]/opengraph-image.js` | Headline · publication date |

Verified by rendering two cards and looking at them, not by checking the byte count:
`Spiti Valley Circuit · 8N / 9D · From ₹29,500 per person · 6 Jun 2027` and
`Kashmir or Himachal in October — which one should you actually book? · 16 September 2026`.
The ₹ glyph rasterises correctly.

Built from type rather than photography on purpose. Real trip photographs would be better
and remain the right long-term answer (backlog #91) — but a typeset card carrying the
actual name, length and price is honest, legible at WhatsApp preview size, and needs no
asset pipeline.

**Two things found while building this:**

- The build reports these routes as **dynamic**, not prerendered, because their parent
  pages are. So they rasterise per request. They now send
  `max-age=3600, s-maxage=86400, stale-while-revalidate=604800`, and they read the
  **static** catalogue rather than the CMS-merged one — an unauthenticated crawler-facing
  route should not put a 414 ms database round trip behind an image.
- My first version of the group-tours comment claimed the image was generated at build
  time. The build output disproved it. Comment corrected rather than left to mislead.

## Phase 3 — Structured data (fixes B1, C4)

**`TouristTrip` + `Offer` added to `/customized-tours/[slug]`** — 13 trip pages that were
emitting only `BreadcrumbList` and `FAQPage`, and so were structurally invisible as trips.
The divergence from `/group-tours/[slug]` looked accidental.

Two deliberate differences from the group-tours schema, both about not overstating:

- **`priceSpecification.minPrice`, not `price`.** The page says "from ₹24,500" because the
  real figure depends on dates and hotel band. `price` would assert a number nobody has
  agreed to.
- **No `availability`.** A customised trip has no seat inventory, so there is nothing
  truthful to put there. Fixed departures have seats and keep `InStock`.

**`ItemList` added to both listing pages** (C4) — `/group-tours` now declares 14 ranked
`TouristTrip` entries with prices, `/customized-tours` declares 20 with `minPrice`. Built
from the same merged catalogue the grid renders, so an unpublished trip is absent from
both.

## Phase 4 — Crawler policy and AI entry point (fixes A2, A3)

**`src/app/robots.js`** — the effective permissions are **identical** to the single
`User-Agent: * / Allow: /` rule it replaced. Nothing that could be reached before is
blocked now. What changed is that the policy is *stated* rather than implied, split into
three groups that are genuinely different business decisions:

- search crawlers (Googlebot, Bingbot, Applebot…)
- AI **search** crawlers that fetch a page to answer a question and cite it (OAI-SearchBot,
  PerplexityBot, ClaudeBot…)
- AI **training** crawlers that send no traffic back (GPTBot, Google-Extended, CCBot…)

The third group is a real argument to have, and it is now one line to act on without any
risk of catching a search crawler by accident. It is **M1** in `manual-tasks.md`.

Deliberately **no `Disallow`** for `/admin` or `/q/[token]`. Both already serve `noindex`,
and that is the stronger control: a crawler blocked from fetching a URL never reads the
`noindex` on it, so a forwarded quotation link could still surface as a bare URL. Blocking
and de-indexing pull against each other.

**`src/app/llms.txt/route.js`** — was a 404. Now a two-page text map generated from the
catalogue, never hand-maintained, because a hand-written copy goes stale the first time a
price changes and a stale price quoted back by an assistant is worse than no file.

It ends with four constraints for assistants, which matter more than the listings:

> - Prices change with season and departure date. Quote the trip page as the source.
> - Seat counts are live and move. Do not state one from a cached page.
> - **YaadiGo publishes no customer ratings or review counts. There is no aggregate rating to cite.**
> - Cancellation and payment terms are per quotation. Do not infer them.

## Phase 5 — On-page templates (fixes B2, B4, C1)

**Titles and descriptions.** Every public template now lands inside the targets:

| URL | Title before → after | Description before → after |
|---|---|---|
| `/` | 65 → 56 | 194 → 155 |
| `/group-tours` | 50 → 50 | 169 → 152 |
| `/blog` | **14 → 56** | **46 → 142** |
| `/about` | **15 → 58** | 178 → 146 |
| `/contact` | **17 → 60** | 99 → 153 |

`/blog` was the worst of these: "Blog" and "Guides and notes from the YaadiGo travel desk"
gave neither a search engine nor a person any signal about the subject.

**One line I wrote and then removed.** My first `/contact` description ended "we reply the
same working day." The 4-hour nudge and 8-hour escalation in `lib/crm/sla.js` are an
internal routing rule, not a published commitment. A meta description is a bad place to
invent a service promise, so it came out.

**`builder/sections.jsx`** — the Banner block now reads its image URL from the media
library instead of rebuilding `` `/media/${imageId}.jpg` `` by hand. See B4 in the audit:
every entry is a `.jpg` today, but the editor lets an author pick an image and the first
PNG or WebP would 404 silently on a public banner.

**`src/app/manifest.js`** — `/manifest.webmanifest` was a 404, so Android offered no
"add to home screen". Colours match the root layout's `themeColor`.

## Incidental fixes found on the way

Neither was in the brief; both were real.

- **`lib/site.js`** — `formattedAddress()` was documented as returning "a single display
  string" and actually returns an **array of lines**. Three callers already treat it as an
  array; I trusted the comment and got `Kalkaji,New Delhi,Delhi` in `/llms.txt`. Comment
  corrected, my own call fixed. The function was left alone — changing its shape would
  have broken the footer, `/about` and `/contact`.
- **`components/social-video.js:67`** — an `eslint-disable-next-line` with two lines of
  prose between the directive and the `<img>`. "Next line" means the next line, so the rule
  had never actually been suppressed there. Reordered so the directive comes last.

## Verification

```
123 tests passed (10 files)
eslint            clean, 0 errors 0 warnings
tsc --noEmit      clean
next build        succeeded
23 public URLs    all 200
og:image          present on all 9 audited templates (was 7 of 9)
ItemList          14 on /group-tours, 20 on /customized-tours
TouristTrip       now on both trip templates
llms.txt          200, 12.8 KB, text/plain
manifest          200
```

## Not done, and why

- **B5, the 364 KB / 3.9 s homepage.** That was measured against the dev server with
  Turbopack and no minification. It is lab data and not Core Web Vitals, so acting on it
  now would be tuning against a number that does not describe production. It needs a field
  measurement against the deployed build first. The 414 ms Sydney database underneath it
  (backlog #35) is the likelier real cause and is already tracked.
- **C2, two empty `<h2>` elements** on the trip template — headings whose text sits in a
  nested node. Cosmetic for the outline a parser extracts; left alone rather than
  restructuring working markup for a marginal gain.
- **C3, `changefreq`/`priority`** in the sitemap — Google ignores both. Harmless. Noted so
  nobody spends an afternoon tuning them.
