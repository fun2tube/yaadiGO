# Phase 1 — SEO & AI Search audit

**Site:** yaadigo.com (YaadiGo Networks Pvt Ltd) · **Stack:** Next.js 16.3.6 App Router, React 19, Tailwind v4
**Audited:** 2026-10-08, against the dev server on `localhost:3000`
**Method:** `curl` with no JavaScript execution, per template. Where a number is lab data it says so.

## How this brief was adapted

The brief as written was for a supplements store. The parts that assumed a product
catalogue do not exist here and are **dropped, not deferred**:

| Dropped | Why |
|---|---|
| Merchant Center / product feeds | YaadiGo does not sell a shippable SKU. A tour is a booked service. |
| GTIN, variants, stock counts | No equivalent. Seats-left is the nearest thing and it already renders. |
| FSSAI, supplement claims | Not a regulated food product. |
| `Product` / `AggregateOffer` schema | `TouristTrip` + `Offer` is the correct type and is partly in place. |
| Cart / checkout / Meta Pixel | There is no cart. Booking runs through a quotation a salesperson sends. |

What carries over unchanged: indexing and crawl control, Core Web Vitals, structured
data correctness, AI-crawler access, on-page templates, trust pages, and the rule that
nothing gets published that is not true.

## Summary

**Score: 74/100** — a good foundation. Head tags, canonicals and server rendering are
genuinely in good shape; the losses are concentrated in social/AI surfaces and in two
templates that drifted apart from each other.

The single most expensive defect is **no `og:image` on trip pages or blog posts**. In this
market trips are shared on WhatsApp, and a WhatsApp share with no image is a grey box.
That is the main organic distribution channel rendering blank.

## What is already right

Worth stating plainly, because it means Phase 2 can be narrow:

- **Content is server-rendered.** The trip page returns the H1, trip name, price, seats,
  the day-by-day itinerary (Srinagar, Gulmarg both present in raw HTML), inclusions and
  JSON-LD with **JavaScript switched off**. Googlebot and an AI fetcher see the whole page.
- Every template has exactly **one `<h1>`**, a `<title>`, a meta description and a
  self-referencing `rel=canonical`.
- `robots.txt` resolves, is permissive, and points at the sitemap.
- `sitemap.xml` lists **54 URLs** with `lastmod` on every entry, including 8 blog posts.
- **`noindex, nofollow` is correctly applied** to `/admin/*` and `/media`, and `noindex`
  to `/q/[token]` — customer quotation links are not indexable. This was the highest-risk
  thing to get wrong and it is right.
- Trip detail pages carry `TouristTrip` + `Offer` + `BreadcrumbList`.
- Blog posts carry `Article` + `FAQPage` + `BreadcrumbList`.
- `/group-tours/` 308-redirects to `/group-tours` — no duplicate-slash variants.

## Critical (P1)

### A1 — No `og:image` on trip detail or blog post pages

`src/app/group-tours/[slug]/page.js:26`, `src/app/blog/[slug]/page.js`

Measured: `og:image` present on `/`, `/group-tours`, `/customized-tours`, `/blog`,
`/about`, `/contact`. **Absent on `/group-tours/kashmir-valley-escape` and
`/blog/ladakh-june-or-september`** — the two templates people actually share.

Root cause is not a missing file. `src/app/opengraph-image.js` exists and works. But
`generateMetadata` returns `openGraph: { type, title, description }`, and Next.js
**replaces** the parent `openGraph` object rather than merging it, so the inherited
`images` entry is dropped. Setting a title in `openGraph` silently deletes the image.

Impact: every WhatsApp, Instagram DM and Twitter share of a specific tour or article
shows no preview card. This is the cheapest high-traffic fix available.

### A2 — `/llms.txt` returns 404

No machine-readable summary for AI assistants. For a travel brand the answer-engine
surface ("plan me 6 days in Spiti") is where discovery is moving, and there is currently
no curated entry point.

### A3 — `robots.txt` has no AI-crawler policy

`src/app/robots.js` emits a single `User-Agent: *` rule. There is no explicit statement
for GPTBot, ClaudeBot, PerplexityBot, Google-Extended or OAI-SearchBot. Today `*` allows
them, so nothing is blocked — but the policy is accidental rather than chosen, and the
AI-search crawlers are not distinguished from the training crawlers. **This is a business
decision, not a code one** — see `manual-tasks.md` M1.

## Warnings (P2)

### B1 — `TouristTrip` schema missing on customized-tours detail pages

`src/app/customized-tours/[slug]/page.js:64`

Measured `@type` values:

| Template | Types emitted |
|---|---|
| `/group-tours/[slug]` | `TouristTrip`, `Offer`, `BreadcrumbList`, `TouristAttraction` |
| `/customized-tours/[slug]` | `BreadcrumbList`, `FAQPage` — **no `TouristTrip`, no `Offer`** |

Thirteen customized-tour pages are structurally invisible as trips. The divergence looks
accidental: both templates render the same kind of thing.

### B2 — Thin titles and descriptions on four templates

| URL | Title | Desc | Problem |
|---|---|---|---|
| `/blog` | 14 | 46 | Both far too short; no topic signal at all |
| `/about` | 15 | 178 | Title is just "About \| YaadiGo"; desc over 160 |
| `/contact` | 17 | 99 | Title carries no intent keyword |
| `/` | 65 | 194 | Title truncates in SERP; desc over 160 |

### ~~B3 — `&` is double-escaped in the homepage title~~ — FALSE ALARM, withdrawn

My first pass read `Customized Trips &amp; Corporate` in `<title>` as double escaping.
It is not. `grep -c 'amp;amp;'` returns **0** — the entity appears exactly once, which is
correct HTML, and `&amp;` in a title renders as `&`. Nothing to fix.

The one real consequence: because I measured title length on the *escaped* string, the
homepage title was 65 visible characters, not 69. Corrected in the table above.

### B4 — Six raw `<img>` tags and five empty `alt=""` — mostly correct as written

Checked each one rather than fixing them in bulk, and most are right:

| Site | Verdict |
|---|---|
| `social-video.js:70` | **Correct.** Remote YouTube CDN thumbnail; `next/image` would need that domain whitelisted for no benefit on a lazy poster. `alt=""` is right too — the title already sits in the `<summary>` beside it, so alt text would double-announce it. |
| `builder/image-field.jsx:42,73` | **Correct.** Admin-only picker thumbnails, already `noindex`, each beside its own label. |
| `cms/quote-presentation.js:49` | **Correct.** Passes `alt={image.alt}` through. |
| `quote/blocks.js:42` | Acceptable. Quotation documents are `noindex`; `alt` falls back to `""`. |
| `builder/sections.jsx:350` | **One real defect, and not the one I was looking for.** `alt=""` is correct (the image sits at `opacity-45` behind the heading that carries the meaning) — but `src` was rebuilt by hand as `` `/media/${imageId}.jpg` `` instead of being read from the media library. Every library entry is a `.jpg` today so it works, but the editor lets an author pick an image, and the first PNG or WebP added would 404 silently on a public banner. |

So the headline count overstated the problem. The honest finding is one latent path bug,
not eleven accessibility defects.

### B5 — Homepage weighs 364 KB with 3.9 s to first byte (lab)

Lab figure, dev server, Turbopack, unminified — **not** a field number and not
Core Web Vitals. But it is 2× the next heaviest page. The known 414 ms Sydney database
round-trip (backlog #35) sits underneath this and will show up in field LCP for Indian
users on the live site. Needs re-measuring against a production build before acting.

## Opportunities (P3)

- **C1** — `/manifest.webmanifest` 404s. No install prompt, no Android home-screen icon.
- **C2** — Two empty `<h2>` elements on the trip template (headings whose text sits in a
  nested node). Harmless to users, but it weakens the outline a parser extracts.
- **C3** — `changefreq` and `priority` on all 54 sitemap entries are ignored by Google.
  Harmless; noted so nobody spends time tuning them.
- **C4** — No `ItemList` schema on `/group-tours` or `/customized-tours`, so the listing
  pages do not declare what they list.

## Data gaps — reported, not filled

Per the brief's first rule, these are **missing inputs, not things to invent**:

| Gap | Blocks |
|---|---|
| Instagram / YouTube handles | `sameAs` in Organization schema; video embeds (backlog #87) |
| Real trip photography | Per-trip `og:image`, gallery blocks, `image` in `TouristTrip` (#91) |
| GSTIN / CIN | Trust signals on `/about` and in schema (#89) |
| No review or rating data anywhere | `AggregateRating` **must stay absent**. Fabricating it is both a Google penalty and a lie. |

## Constraints honoured

No URL was changed, so `redirects.md` is empty. No `noindex`, `Disallow` or canonical
change is proposed on any public page in this phase. All schema additions map to values
already visible on the page.

**One deviation to flag:** the brief asks for one git branch per phase. This directory is
**not a git repository**, so commits and branches are unavailable. Work is sequenced by
phase in these reports instead. Initialising git is `manual-tasks.md` M4.
