# yaadigo.com

The public marketing site for **YaadiGo Networks Pvt Ltd** — fixed-departure
group tours, customized trip planning, and a promo/entry point for the
Corporate Travel Desk (which lives separately at `corporate.yaadigo.com`).

Mobile-first, app-style: a fixed bottom navigation bar on phones, WhatsApp
quick-enquiry throughout, and Instagram-reel vertical swipe panels on the two
landing pages. Next.js 16 App Router, React 19, Tailwind CSS v4, and an AI trip
planner built on Claude. No database — content is plain JS modules under
`src/lib/`, and the planner holds its state in the URL.

One deployment serves two hosts: `yaadigo.com` (travellers) and
`corporate.yaadigo.com` (the Corporate Travel Desk).

The corporate model is a **prepaid wallet**, not a credit facility: corporates
recharge a balance and confirmed bookings draw down against it. Invoicing, GST
compliance and reconciliation are handled by an AI finance agent with a human
sign-off step.

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npm start       # serve the production build
npx eslint .    # lint
```

## Before this goes live

Five things are deliberately unfinished because they need credentials or
real-world facts nobody has supplied yet. The site renders correctly without
them — unset values are skipped rather than printed as placeholders, and the
planner says so plainly — but it is not launch-ready until they are set.

1. **An Anthropic API key** — `ANTHROPIC_API_KEY` in `.env.local`. **Both AI
   features are dark without it**: the `/plan` trip planner and the site-wide
   concierge. In development they now say so explicitly ("Developer:
   ANTHROPIC_API_KEY is not set..."); in production visitors get a polite
   fallback that points them at the travel desk. If the AI "doesn't work",
   this is the first thing to check.

   ```bash
   # .env.local — never commit this
   ANTHROPIC_API_KEY=sk-ant-...
   ```

2. **A WhatsApp number** — `CONTACT.whatsapp` in `src/lib/site.js`, digits
   only with country code (e.g. `919876543210`). It powers the bottom-bar
   WhatsApp tab, the desktop floating button and every quick-enquiry CTA.
   Until it is set, all of those fall back to `/contact` — the UI is complete
   either way, but WhatsApp is the highest-converting channel on mobile in
   this market and it is currently off.

3. **An Anthropic API key (see 1)** — `ANTHROPIC_API_KEY`. The `/plan` AI trip
   planner does nothing without it. The page degrades honestly (it tells the
   visitor the planner isn't switched on and points them at the travel desk),
   but the headline feature is dark until the key is set.

4. **Business details** — `src/lib/site.js`. Phone, general email, registered
   address, CIN, GSTIN and social profile URLs are all `null`. Filling them in
   updates the footer, the contact page, the About page and the `schema.org`
   Organization markup at once.

5. **Lead delivery** — set `ENQUIRY_WEBHOOK_URL` (see `.env.example`).
   Until it is set, enquiries are accepted and written to the server log as an
   `[enquiry]` JSON line, but nothing is delivered anywhere. **Leads will be
   lost.** Any endpoint accepting a JSON `POST` works — CRM webhook, Zapier,
   n8n, or a Google Apps Script web app.

Also worth doing before launch:

- Have `/privacy` and `/terms` reviewed by a lawyer. They are written to
  describe what the business actually does (DPDP Act 2023 vocabulary, travel
  booking conditions), not copied from a generator, but they are not legal
  advice. Bump `LEGAL_LAST_UPDATED` in `src/lib/site.js` when they change.
- Collect real testimonials into `src/lib/testimonials.js`. The homepage
  section renders nothing while that array is empty, which is intentional.
- **Add photography.** Tour cards and the hero use CSS gradients, not photos
  — deliberately, because hotlinking stock images on a commercial travel site
  is a licensing and performance risk. `src/components/tour-card.js` is already
  sized for a real image; drop `next/image` in where the gradient `<div>` is.
- Swap the Google Fonts `<link>` in `src/app/layout.js` for
  `next/font/google`. It is a `<link>` only because `next/font` needs to reach
  `fonts.googleapis.com` at build time, which the sandbox this was authored in
  blocks. On Vercel or any normal CI, `next/font` is strictly better.

## Mobile-first shell

- **`src/components/mobile-bar.js`** — the app-style bottom bar. Five thumb-reach
  tabs (Home, Tours, AI Plan, Corporate, WhatsApp) on phones only; it hides on
  scroll-down and returns on scroll-up. `env(safe-area-inset-bottom)` keeps it
  clear of the iPhone home indicator, which needs `viewportFit: "cover"` in the
  root layout's `viewport` export — both are already set.
- **`src/components/whatsapp-fab.js`** — the desktop equivalent. Hidden on
  phones, because stacking a floating bubble on top of a tab bar covers your own
  CTA.
- **`src/components/reel.js`** — the reel-swipe deck. `Reel` sets
  `scroll-snap-type` on `<html>`; `Panel` wraps each full-height section.
  Snapping is on the document, not a nested scroller, so the sticky header,
  scroll restoration, find-in-page and the iOS address-bar collapse all keep
  working. It relaxes to `proximity` on short viewports and turns off entirely
  under `prefers-reduced-motion`, so an oversized panel can never trap content
  below the fold.

Reel mode is applied to the two landing pages (`/` and `/corporate`) only.
Blog posts, legal pages, tour details and the planner keep normal scrolling —
snap-scrolling long-form text fights the reader.

## Two hosts, one deployment

`src/proxy.js` rewrites requests arriving on `corporate.yaadigo.com` into the
`/corporate` route tree, so the subdomain stays in the address bar. Shared
routes (`/plan`, `/contact`, `/privacy`, `/terms`, `/blog`, `/about`) are left
alone and serve on both hosts.

To deploy: add `corporate.yaadigo.com` to the project's domains and point a
CNAME at the same deployment. Locally, use **`corporate.localhost:3000`** —
Chrome and Firefox both resolve `*.localhost` to 127.0.0.1 with no hosts-file
editing, and `src/proxy.js` already matches it.

## The media library

Every image on the site is registered once in `src/lib/media.js` with its alt
text, title, description, tags and licence attribution. Components reference an
image **by ID, never by path**:

```jsx
<Img id="kashmir-valley-escape" fill sizes="100vw" className="object-cover" />
```

That is what makes alt text impossible to forget and lets one image be reused
in several places without the alt being re-typed (or re-invented) at each one.
Width and height come from the library too, so nothing shifts as images load.

- **Browse and search**: `/media` — filter by tag, read the alt text, copy the
  one-line snippet. `noindex`, and deliberately kept out of the sitemap.
- **Attribution**: `/credits`, linked from the footer. CC BY and CC BY-SA
  require it wherever the work appears.
- **Adding one**: drop the file in `public/media/`, add an entry, use `<Img>`.

### Where the photography came from

36 photographs from **Wikimedia Commons**, fetched with
`scratchpad/fetch_media.py`. Commons rather than a stock site for two reasons:
the subject is verifiable (a file titled "Dal Lake" is Dal Lake — stock tagged
"kashmir" often isn't, and a travel company showing the wrong valley is a real
problem), and the licence and author are recorded rather than assumed.

The fetcher enforces a licence policy: **NonCommercial and NoDerivatives are
rejected outright**, because this is a commercial site. Current mix is CC0,
CC BY and CC BY-SA only.

It also rejects images that match the subject but are useless — reviewing the
first run caught a lavatory inside Jaisalmer Fort, a 19th-century letter, and a
5.4:1 panorama. Those rules live in `JUNK_TITLE` and the aspect bounds. **Review
what it fetches**; automated selection gets the licence right and the judgement
wrong.

One subject (a generic "trip planning" shot) was dropped rather than shipped
with a wrong image.

## The corporate model — wallet, not credit

**There is no credit facility.** Corporates recharge a wallet; confirmed
bookings deduct from the balance; bookings pause when it runs out rather than
going on credit. This is stated in `/terms`, on `/corporate`, on
`/corporate-travel`, on the homepage corporate panel and on `/about` — if the
model changes again, `grep -rniE "wallet|credit" src/` finds every claim.

**Two things this repo does NOT do yet**, and the marketing copy now promises
both, so they are the gap to close:

1. **The wallet itself.** There is no balance, no ledger, no recharge flow and
   no payment gateway in this codebase — only the pages describing one. Building
   it needs auth, a database and a payment gateway (Razorpay is the obvious
   choice for INR), which is an application, not a marketing site.
2. **The AI finance agent.** Same: described, not built. It needs invoice
   ingestion (vendor mailboxes/APIs), a GSTIN validation step, GSTR-2B
   reconciliation, and a review queue so a human signs off before anything
   reaches the client's finance team. The trip planner in `src/app/api/plan/`
   is the working reference for how an agent is wired up here.

Until those exist, the corporate pages are lead-generation for a service
delivered manually behind the scenes. That is a legitimate way to launch — but
the copy should not outrun what the desk can actually do on day one.

### Claims that need sign-off

`src/app/terms/page.js` carries a `SIGN-OFF NEEDED` comment listing the wallet
commitments written as reasonable defaults rather than confirmed policy:
balance does not expire, refund to source within 30 working days on closure,
and cancellation refunds returning to the wallet by default. Finance and legal
should confirm or change each one.

## The AI concierge

A travel concierge sits on every page — a pill bottom-right on desktop, above
the tab bar on mobile. It is not a chatbot bolted on: it has **tools over the
real inventory**, and it renders **real components inside the conversation**.

| Piece | File |
|---|---|
| Tools (the data seam) | `src/lib/concierge/tools.js` |
| System prompt + page context | `src/lib/concierge/prompt.js` |
| Streaming route with tool loop | `src/app/api/concierge/route.js` |
| Provider (state, SSE, persistence) | `src/components/concierge/concierge-provider.js` |
| Panel, cards, launcher | `src/components/concierge/` |

**Why this is different from a chatbot:**

- **It cannot invent a trip.** Every claim about a departure, price or seat
  count comes from a tool result. `search_trips`, `get_trip` and
  `compare_trips` read the real catalogue; the prompt forbids describing
  anything a tool has not returned. Unit-tested in
  `scratchpad/test-tools.mjs` — 23 assertions covering price ceilings,
  unknown slugs and the no-match path.
- **Generative UI.** A tool returns `_cards`, and those render as real trip
  cards, comparison tables, a pre-filled planner button or an enquiry form
  *inside the chat*. `_cards` is stripped before the result goes back to the
  model — the model gets data, the browser gets components.
- **It knows what you're looking at.** Page context is derived from the
  pathname in the provider and injected as a mid-conversation system message,
  so "is this one any good?" works on a trip page without naming the trip.
  Deriving it from the URL avoids every page having to register itself.
- **It hands off rather than guessing.** `hand_to_human` renders a real
  enquiry form that files through the same `submitEnquiry` action as every
  other form, carrying the concierge's one-line summary.
- **It follows you.** The provider wraps the app, so the conversation survives
  navigation; it is persisted to `sessionStorage` and restored on first open
  (in an event handler, not an effect — no hydration mismatch).

Effort is set to `low` for the concierge: a concierge that thinks for twenty
seconds before saying "yes, October is fine" is a worse concierge. The planner
stays at `medium` because a full itinerary is a harder task.

**When the database lands, only `src/lib/concierge/tools.js` changes.** The
tool schemas, the prompt and the entire UI stay as they are — that file is the
seam, and it says so at the top.

## The AI trip planner

`/plan` takes a three-step brief and streams back a full day-by-day itinerary.

| Piece | File |
|---|---|
| Schema, prompt, form options | `src/lib/planner.js` |
| Incremental JSON parser (streaming) | `src/lib/itinerary-stream.js` |
| Client, rate limiting, error mapping | `src/lib/ai.js` |
| Shareable-link encoding | `src/lib/trip-link.js` |
| Generate (SSE) | `src/app/api/plan/generate/route.js` |
| Rewrite one day | `src/app/api/plan/day/route.js` |
| UI | `src/components/planner/` |

How it works:

- **Streaming, day by day.** Structured outputs emit properties in schema
  order, so `itinerary-stream.js` walks the JSON as it arrives and emits the
  trip header as soon as it closes, then each day object the moment its
  braces balance. The traveller sees day 1 while day 6 is still being written.
  The parser tracks string and escape state, so a `{` inside a sentence never
  miscounts depth. `finish()` re-parses the whole document at the end and is
  the authoritative result.
- **Rewrite one day.** Each card can be regenerated on its own, with an
  optional instruction ("less driving"). The surrounding days are sent as
  context so the rewritten day still connects geographically.
- **Shareable.** The brief is encoded into `?trip=…`, so a link reopens the
  form filled in. No account, no database.
- **It converts.** "Send this plan to the travel desk" files a real enquiry
  with the entire itinerary attached, through the same `submitEnquiry` action
  as every other form.

**Cost and abuse control** — both routes are public and spend money per call:

- `PLANNER_EFFORT` in `src/lib/ai.js` is the main quality/spend knob. It is
  `medium`; raise to `high` if itineraries read thin.
- Per-IP hourly limits: 12 generations, 40 day-rewrites. **The limiter is
  in-memory, so it is per server instance** — it stops one browser hammering
  the endpoint, but it does not coordinate across instances or survive a
  restart. Move it to Redis/Upstash before this sees real traffic.
- The model is instructed never to invent hotel names or quote firm prices,
  because YaadiGo has to honour what the page says. Costs are ranges, and
  every itinerary carries a visible "a human confirms this before booking"
  note.

## Layout

```
src/
  app/
    actions/enquiry.js      Server Action behind every enquiry form
    api/plan/              AI planner endpoints (streaming + day rewrite)
    plan/page.js            The AI trip planner
    corporate/page.js       Corporate Travel Desk landing (corporate.yaadigo.com)
    <route>/page.js         One folder per route
    layout.js               Root layout, fonts, Organization JSON-LD
    not-found.js            Custom 404
    error.js                Route-level error boundary
    global-error.js         Root-layout error boundary
    icon.svg                Favicon
    apple-icon.js           Apple touch icon (generated)
    opengraph-image.js      1200×630 social card (generated)
    sitemap.js  robots.js
  proxy.js                  Subdomain routing (corporate.yaadigo.com)
  components/               Presentational pieces, shared across routes
    planner/                The AI planner UI
    concierge/              Site-wide AI concierge (panel, cards, launcher)
    corporate/              Corporate landing nav + lead form
    mobile-bar.js           App-style bottom navigation (phones)
    reel.js                 Instagram-style swipe panels
    reveal.js               One IntersectionObserver driving all scroll reveals
  lib/
    media.js                The media library — every image, alt text, licence
    site.js                 Business identity + contact details (fill these in)
    tours.js                Group tour inventory
    posts.js                Blog posts
    testimonials.js         Reviews (empty until real ones exist)
```

### Orphaned components

The reel homepage rewrite made nine components unused: `hero.js`,
`ai-planner-promo.js`, `trust-strip.js`, `group-tours-preview.js`,
`customized-tour-callout.js`, `corporate-promo-block.js`, `why-yaadigo.js`,
`blog-teaser.js` and `testimonials.js`. Their content now lives inline in the
panels in `src/app/page.js`. They are safe to delete — they were kept only
because this project is not under version control yet, so a delete would be
unrecoverable. Note `testimonials.js` pairs with `src/lib/testimonials.js`; if
you want reviews back on the homepage, add a panel rather than reviving the
component.

`src/lib/` is the single source for content — `tours.js`, `posts.js` and
`testimonials.js` each feed every place their data appears. Adding a blog post
means editing `posts.js` only; the index, the homepage teaser, the sitemap and
the static params all follow.

## Enquiry flow

Both the trip builder (`/customized-tours`) and the contact page post to the
same Server Action, `submitEnquiry` in `src/app/actions/enquiry.js`:

- Validates server-side, returns per-field errors and preserves what was typed.
- Drops honeypot submissions silently (hidden `company_website` field).
- Logs every accepted enquiry as one `[enquiry]` JSON line, then POSTs it to
  `ENQUIRY_WEBHOOK_URL` if set.
- Shows the visitor an honest retry message if delivery fails — it never
  confirms a lead that did not get through.

Because it is a Server Action rather than a `fetch` in an event handler, the
form also works with JavaScript disabled.

## Deploying

Any Node host works. On Vercel, set `ANTHROPIC_API_KEY` and `ENQUIRY_WEBHOOK_URL` (and optionally
`ENQUIRY_WEBHOOK_TOKEN`) in project settings, and update `SITE_URL` in
`src/lib/site.js` if the production domain ever differs from
`https://www.yaadigo.com` — it seeds canonical URLs, the sitemap and all
structured data.

**PDF downloads** (itineraries and quotations) render the real pages with
headless Chromium — see `docs/design/pdf-downloads.md`. On Vercel this uses
`@sparticuz/chromium` (bundled into the three PDF routes by
`outputFileTracingIncludes`); give functions at least 1 GB of memory. On any
other host it uses the machine's Chrome/Edge/Chromium, or `CHROME_PATH`.
Signing uses `ADMIN_SESSION_SECRET`, which must be set.

**Build concurrency is limited on purpose** (`next.config.mjs`: 2 workers,
180 s per page). Prerendering reads Postgres; with the database in Sydney,
seven parallel workers overwhelmed the Supabase pooler and the build failed.
Revisit after the database moves region (backlog #35).

**Developing without the database:** `node scripts/dev-local-store.mjs`
runs `next dev` on port 3006 against `content/*.json` instead of Postgres.
