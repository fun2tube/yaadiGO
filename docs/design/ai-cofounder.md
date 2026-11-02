# Business database + AI cofounder: CTO spec

**Date:** 2026-11-02 · **Status:** approved; Phase 1 in progress

**Owner's decisions (2026-11-02, §7):**

1. Paid Claude runs the agent. An exact cost estimate and a hard budget cap
   come before it is switched on.
2. Approve before live: the approval tiers in §3.
3. Anonymous first-party funnels only. No Clarity, no session recordings.
4. Search Console first; DataForSEO later.

**Asked for:**

- A proper database for hotels, destinations, trips, images, leads, bookings
  and customers.
- An AI agent in the admin that works as cofounder/CEO and aims to make the
  business profitable. It should:
  - change anything on the site: trips, pages, design, details;
  - create trips, write blogs, find or generate images, make quotations;
  - track traffic and visitor behaviour;
  - do keyword research and on-page, off-page and technical SEO, ranking on
    Google and AI search;
  - make a weekly plan and execute it;
  - answer any business question: team, trips, traffic sources, inventory,
    bookings, leads;
  - recommend what to show when, and make the changes.

## 1. Where we are today

| Area | Today | Gap |
|---|---|---|
| Leads, quotations, bookings, payments, invoices, departures, users | Real Postgres tables with invariants and an event log | Sound. Keep |
| Trips | 34 in code (`lib/tours.js`, `lib/packages.js`); edits saved as JSON `documents`, copy-on-write | No real table. Cannot query "trips under ₹30k in June with seats" |
| Destinations | In code, plus JSON overrides | Same |
| Hotels | **None.** Hotel names are free text inside quotation lines | No rate cards, no reuse, no supplier contacts |
| Customers | **None.** Each lead carries a name and phone; a repeat customer is a new lead | No customer history, lifetime value or repeat rate |
| Images | `mediaLibrary` JSON documents (title, alt, tags) | Fine for now. Needs licence and credit fields for stock and AI images |
| Blog | In code (`lib/posts.js`) | Only a developer can publish |
| Visitor analytics | **None.** No tracking of any kind | No traffic, sources or behaviour data at all |
| SEO data | sitemap, schema.org, `llms.txt` on the site | No Search Console, no keyword or ranking data |
| AI | Gemini free tier behind a provider switch. Three uses: trip planner, Yaadi visitor chat, a click-an-element editor in admin | No business agent. The free tier 503s and hangs (testing memory) |

**The most urgent gap is analytics.** Traffic history cannot be collected
backwards: every week without tracking is a week the agent can never analyse.
Tracking ships first.

## 2. Database design

Same rules as today: Postgres, Drizzle, money in paise, invariants in the
database, every change emits an event.

**Catalogue (new tables; replaces trips-in-code and the JSON documents):**

- `destinations`: slug, name, region, country, best months, summary, SEO
  title and description, hero media.
- `hotels`: name, destination, category, star rating, address, geo, contact
  person, phone, email, notes, active.
- `hotel_room_types`: hotel, name, occupancy.
- `hotel_rates`: room type, season start and end, meal plan,
  `cost_price_paise`, `sell_price_paise`. CHECK that sell ≥ cost and that
  seasons don't overlap per room type and meal plan.
- `trips`: slug, kind (group/customized), destination, nights, status
  (draft/live/archived), price from, SEO fields, `published_version`.
- `trip_versions`: an immutable snapshot of the whole itinerary per publish.
  Bookings already point at what they were sold on; this keeps that.
- `trip_days`: trip, day number, title, body, overnight hotel.
- `trip_inclusions`: included or excluded, text.
- `trip_media`: trip, media, role (hero/gallery), order.
- `departures`: exists. Gets a foreign key to `trips` instead of a bare slug.

**People:**

- `customers`: one row per person or company. Phone and email are normalised
  and unique, which is what deduplicates. Fields: city, source of first
  contact, tags, marketing consent with date (DPDP Act).
- `leads.customer_id` and `bookings.customer_id`: every enquiry and booking
  hangs off a customer. A one-off backfill matches existing leads by phone.
- `travellers`: booking, name, age, ID type. Ops needs names on rooming lists.

**Content:**

- `posts`: blog in the database (draft/scheduled/live), author (staff or
  agent), SEO fields, FAQs.
- `media`: replaces the `mediaLibrary` documents. Adds `source`
  (upload/unsplash/pexels/ai), `licence`, `credit`, `credit_url`, and
  `ai_prompt` when generated.

**Analytics** (first-party, in our own Postgres):

- `visits`: anonymous visitor id (random, no cookie banner needed: no
  personal data), landing page, referrer, UTM, device, country, started and
  ended.
- `pageviews`: visit, path, time on page, scroll depth.
- `site_events`: visit, name, properties. Names: `trip_viewed`,
  `enquiry_started`, `enquiry_submitted`, `whatsapp_clicked`, `planner_used`,
  `search`, `quote_viewed`.
- `leads.visit_id`: ties revenue back to the channel that brought it. This is
  the number the agent needs most.
- Daily rollup tables, so reports stay fast as the raw rows grow.

**SEO:**

- `seo_keywords`: keyword, intent, target page, priority, source.
- `seo_rankings`: keyword, date, position, impressions, clicks (from Google
  Search Console).
- `seo_audits`: page, date, issues (jsonb), Core Web Vitals.

**Agent:**

- `agent_conversations` and `agent_messages`.
- `agent_actions`: every change the agent made, with before and after,
  status and who approved it. This is the audit trail and the undo.
- `agent_plans` and `agent_plan_items`: the weekly plan. Each item has a goal,
  a task and a status (proposed/approved/done/skipped), plus a result.
- `agent_memory`: facts the business taught it ("we never sell Ladakh
  before June", "Rahul handles corporate").

## 3. The AI cofounder

A chat panel in every admin screen, plus scheduled runs, built on the same
provider switch the planner uses (`lib/ai.js`). The agent works through
**tools**: typed functions that call the same validated code the admin
screens call. It never writes raw SQL or raw HTML. Whatever a human editor
cannot break, the agent cannot either.

### Tools

**Read (always allowed):**

- business reports: leads, funnel, revenue, margin, collection, team
  performance per salesperson;
- inventory (seats by departure) and a booking ledger;
- traffic: visitors, sources, top pages, conversion by channel, behaviour
  funnels;
- SEO: rankings, queries, audits;
- the catalogue, hotels and customers;
- page content, including a page as rendered.

**Write: drafts, saved but not live (allowed, logged):**

- create or edit a trip draft, a destination, a hotel or rates;
- draft a blog post;
- draft a quotation (`quote-ai.js` exists);
- change page copy, images or design tokens in a draft;
- create a departure as unpublished.

**Publish: needs one click from a person with the right permission:**

- put a trip, post or page change live;
- change a live price;
- open a departure for sale;
- send anything to a customer;
- archive or delete anything.

**Growth:**

- `search_images`: Unsplash and Pexels free APIs, stored with credit and
  licence.
- `generate_image`: an image model. Labelled AI in the media library, and
  never used as a photo of a real hotel.
- `keyword_research`, `site_audit`, `pagespeed`, `search_console_report`.

### Schedules

These run in the existing server cron:

- **Daily, 08:00 IST:** a digest covering yesterday's traffic, leads, money
  and anything stuck (leads not contacted, departures under-filled with less
  than 21 days to go, payments overdue).
- **Monday, 07:00 IST:** a weekly review and plan, for example:
  - what worked last week, by channel;
  - 3–7 plan items with expected impact ("write 'Ladakh in June or
    September', 1,900 searches/month, we rank #34");
  - trips to push this season;
  - pricing and inventory alerts.

  The owner approves items. Approved items the agent can do itself (drafts,
  SEO fixes) it does; items needing people become tasks with an owner.
- **Nightly:** pull Search Console data and roll up analytics.

### Guardrails

Without these an agent with write access to a live booking business is a
liability:

1. **Approval tiers** (above). Publishing, money and customer messages
   always pass a person. The tier is set per action type in settings, so it
   can loosen as trust is earned.
2. **Every action is logged with before and after, and can be undone**
   (`agent_actions`). Trips already keep versions.
3. **No invented facts:** prices, dates, inclusions and hotel names come
   from the database or are left blank. This is the rule the element editor
   already follows.
4. **Permissions:** the agent acts *as* the signed-in user. A sales user's
   agent cannot see accounts, and cannot do anything that user couldn't.
5. **Spend caps:** a monthly AI budget and image-generation budget in
   settings, with a hard stop.

## 4. What it honestly cannot do (and what it does instead)

| Asked | Reality | What we build |
|---|---|---|
| Guarantee #1 on Google | Nobody can. Rankings depend on Google and on competitors | The levers that work: buying-intent content, technical fixes, schema, internal links, speed, tracked weekly against real Search Console data |
| Off-page SEO (backlinks, listings) | Needs relationships and accounts outside the site | Finds targets (travel blogs, directories, local listings), drafts the outreach; a person sends it. Google Business Profile API later |
| AI-search ranking | No official data source | Keeps `llms.txt`, FAQ schema and answer-shaped content current. Checks monthly whether ChatGPT, Gemini and Perplexity cite us for target questions, and logs it |
| Any design change | New layouts or features are code and need a deploy | Anything the page builder and design tokens allow, live. Bigger asks become a written spec for a developer |
| Keyword volumes for free | Google gives volumes only via Ads Keyword Planner or paid APIs | Free tier: Search Console (what we already show up for) plus autocomplete ideas. Paid: DataForSEO, pay per use (decision 4) |
| Watch individual visitors | Possible, but session recordings need disclosure under India's DPDP Act | Anonymous funnels in our own DB. Optional Microsoft Clarity (free) for heatmaps and recordings, masked, with a privacy-policy line (decision 3) |

## 5. Phases

Each phase runs the full dev cycle and ends deployed and reviewed.

**Phase 1: Foundation.** Tracking starts collecting, and the database
becomes real.

- First-party analytics: `visits`, `pageviews` and `site_events`, a
  tracking script, and leads linked to visits. Live first, on day one.
- A Search Console connection for yaadigo.com. The owner verifies the domain
  once.
- Catalogue tables (destinations, hotels and rates, trips with days and
  versions), the 34 code trips migrated, and the admin screens re-pointed.
- Customers: table, lead and booking links, backfill, and a customer page
  with history.
- **Done when:** the admin shows yesterday's visitors by source; a hotel with
  seasonal rates can be added and used in a quotation; a repeat customer
  shows both trips.

**Phase 2: The agent, read-only, then drafts.**

- Chat panel, read tools, report answers with numbers the Reports page
  agrees with.
- Draft-tier write tools, the action log and undo.
- **Done when:** "how did June enquiries compare with May, by source?" is
  answered correctly. "Create a 5-day Kerala draft from our Kerala hotels" is
  saved as a draft with real hotels, and undo removes it.

**Phase 3: Growth engine.**

- SEO module: keywords, rankings, audits, PageSpeed.
- Blog in the database, with agent drafting and images (stock and AI).
- Daily digest; weekly plan with approvals; publish tier.
- **Done when:** a Monday plan arrives, the owner approves two items, the
  agent drafts the post and fixes the meta titles, a person publishes, and
  next Monday's review reports the result.

**Phase 4: Earned autonomy.** Loosen approval tiers that have a clean
record, add seasonal "what to show" automation (homepage features follow
demand and seats), and run campaign experiments.

## 6. Risks

- **Agent mistakes on a live money business:** contained by the approval
  tiers, undo and the no-invention rule (§3).
- **AI cost runaway:** contained by budget caps, cheap models for routine
  runs, and the strong model only for planning.
- **Migrating the code trips breaks pages:** run copy-on-write in reverse.
  Migrate, compare every rendered trip page before and after, and switch only
  when the two match.
- **Tracking data protection (DPDP):** no names, phones or IPs stored with
  visits. Country is derived, then the IP is dropped. A privacy-policy update
  is included.

## 6a. Phase 1 build notes: departures from §2, with reasons

Reading the code before building changed three things in §2.

1. **Trips keep their content model, not `trip_days` rows.** Trips already
   have a tested lifecycle (`lib/cms/trips.js`): draft, publish, versions,
   archive with redirect. The itinerary is validated as a whole by
   `TripContentSchema`, and nothing queries across days. So the move is
   from `documents` jsonb to a real `trips` table. Columns cover what gets
   queried (kind, status, title, destination, nights, price from); the
   itinerary stays one validated jsonb, as `quotations` already do. Splitting
   days into rows would add joins and nothing the agent needs.
2. **Room types live on the rate row, not their own table.** A rate is
   (hotel, room type, meal plan, season). A separate room-type table adds a
   screen and a join for a name.
3. **No `bookings.customer_id`.** Every booking already hangs off a lead (the
   website, quotation and desk paths all create one), and the lead carries
   the customer. A second link could disagree with the first.

Order: **1b customers → 1c hotels and rates → 1d trips and destinations into
tables**, each deployed on its own. 1d touches every trip page, so it ships
alone.

## 7. Decisions for the owner

1. **Which AI runs the cofounder.** The Gemini free tier is unreliable (503s,
   hangs) and weak at long multi-tool work. A paid model with strong tool use
   is the difference between an agent that works and a demo. Options: paid
   Claude (recommended); paid Gemini; free Gemini only.
2. **How much it may do alone.** Recommended: the approval tiers in §3.
   Alternative: fully autonomous publishing.
3. **Visitor behaviour depth.** Recommended: anonymous first-party funnels
   plus Microsoft Clarity heatmaps and recordings. Alternative: first-party
   only.
4. **SEO keyword data.** Search Console only (free), or add DataForSEO
   (pay per use) for search volumes and competitor rankings.
