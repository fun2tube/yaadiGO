# Homepage content strategy

**Date:** 2026-10-10 · **Role:** UI/UX + PM · **Status:** approved and built 2026-10-10 (see §9)
**Asked for:** "Not happy with the images and the content. It is confusing — we
talk about corporate on the homepage. We have group trips (fixed departures),
customized trips, and a travel desk for corporates. Corporate has its own tab,
so the homepage should not carry that much of it. Plan the content properly."

---

## 1 · The problem, stated plainly

The homepage today sells **four things with equal weight** and never tells a
visitor which one is for them:

| What the page currently pitches | Where | Scroll it takes |
|---|---|---|
| AI planner ("Where do you want to go?") | Hero + a 3-screen pinned scene | ~4 screens |
| Customized trips | "Where to next" gallery (unlabelled) + the 4-step stack | ~6 screens |
| Group tours | One rail of cards | 1 screen |
| Corporate travel desk | Full section: 4 stats, 2 buttons, photo, floating chips | 1.5 screens |

Specific failures:

1. **A first-time visitor cannot tell what YaadiGo sells.** The hero asks
   "Where do you want to go?" and sends you to an AI tool. It never says
   "group tours" or "customized trips". The eyebrow is the legal name
   ("YaadiGo Networks Pvt Ltd"), which means nothing to a traveller.
2. **The AI planner is treated as a product. It is a tool** — a fast way to
   start a customized trip. It gets more space than group tours, which are
   the inventory with dates, seats and prices.
3. **The two leisure products are never compared.** Both cover Kashmir,
   Kerala, Rajasthan, Andaman, Himachal. Nobody explains "join a group on a
   fixed date" vs "your own private trip on your dates" — the one decision
   every leisure visitor has to make.
4. **The "Where to next" gallery is customized trips, but doesn't say so.** A
   visitor reads it as tours, clicks, and lands on a different product.
5. **"Or tell us your dates and budget…"** starts with "Or" — it only makes
   sense relative to something the page never set up.
6. **Corporate is a second audience on a consumer page.** A family planning
   Kerala reads about GST reconciliation and prepaid wallets. Corporate
   already has a nav tab, `/corporate-travel` and `corporate.yaadigo.com`.
7. **The giant destination marquee mixes both products** and links to
   either at random.
8. **The close section and the footer repeat the same sentence.**

### Images

The photography is the other half of the complaint, and it is fair:

- **Licensed Wikimedia shots of uneven quality**, taken by many people in
  different light, so the page has no consistent look.
- **Several don't read as the place:** "Kashmir, Family Pace" is a grass
  close-up; Sri Lanka is a crop of a rock; Meghalaya is dark roots; corporate
  is a generic airport terminal.
- **No people anywhere.** Empty landscapes say "destination", not "trip".
  A group-tour company that never shows a group is missing its best proof.
- **1,400px wide** — soft when full-screen on a laptop.
- **The 12-photo mosaic is decoration** next to trust claims it has nothing to
  do with.

---

## 2 · Who the homepage is for

| Audience | Homepage's job | Where they actually convert |
|---|---|---|
| **Leisure traveller** (families, couples, friends, solo) — **primary** | Explain the two ways to travel, show real trips with real prices, earn trust | `/group-tours/[slug]`, `/customized-tours`, WhatsApp |
| Corporate buyer (HR, admin, founder) | **Recognise they're in the wrong place and get out in one click** | `corporate.yaadigo.com` |

**Rule:** the homepage is a leisure page. Corporate gets one line near the
bottom, plus the nav link it already has. No stats, no feature list, no
photo.

The one question the homepage must answer in five seconds:

> **"What does YaadiGo do, and which of its two ways to travel fits me?"**

---

## 3 · Naming — one word per product, everywhere

Today the same thing is called "Tours", "Group Tours", "Fixed departures";
the other is "Custom", "Customized Tours", "Private". Pick one and use it in
the nav, page titles, buttons and footer.

| Product | Name | One-line definition (use verbatim) |
|---|---|---|
| Fixed departures | **Group Tours** | Join a small group on a fixed date. One price, everything planned. |
| Private trips | **Customized Tours** | Your own private trip, on your dates, built around your budget. |
| AI planner | **AI Trip Planner** (a tool, not a product) | Get a free draft itinerary in about a minute. |
| Corporate | **Corporate Travel Desk** | Business travel for companies — lives on `corporate.yaadigo.com`. |

"Customized" is kept over "Private" because it matches the URL and how
Indian travellers search ("customized tour packages").

**Nav:** `Group Tours · Customized Tours · AI Planner · Journal` on the left;
`For business →` (to the corporate site) set apart on the right.

---

## 4 · The new homepage — section by section

Eight sections, each with one job. Every number below comes from live data
(`lib/tours.js`, `lib/packages.js`), so it stays true as inventory changes.

### 1 · Hero — say what we do, offer the fork
**Job:** tell a stranger what YaadiGo is and send them down one of two paths.

- **Eyebrow:** Group tours & customized trips · India and abroad
- **H1:** *Travel together, or travel your way.*
- **Sub:** Join a small-group departure on a fixed date, or let us design a
  private trip around your dates and budget. Either way, the whole itinerary
  is written down before you pay.
- **Primary button:** See upcoming departures → `#departures`
- **Secondary button:** Plan a customized trip → `/customized-tours`
- **Tertiary link:** Talk to a planner on WhatsApp
- **Proof row (live counts, today's values):** `57 departures open` ·
  `34 trips across India & abroad` · `₹0 until you approve the plan`
- **Image:** travellers *in* a place — a small group on a Ladakh pass, a
  couple on a Kerala houseboat. Slideshow allowed, people required.

The AI ask bar moves out of the hero (to section 5). The 2026-10-01 bet on a
one-question homepage (backlog #85) was never measured; this replaces it with
a page that names the products first. Recorded here so it is a decision, not
a drift.

### 2 · Two ways to travel — the comparison
**Job:** make the one real decision easy.

Two large cards side by side (stacked on phone), each with a photo:

| | **Group Tours** | **Customized Tours** |
|---|---|---|
| Line | Join a small group on a fixed date | Your own trip, on your dates |
| Dates | Set departures — pick one | Whenever you want |
| Who you travel with | A small group of fellow travellers | Only your people |
| Price | One all-in price per person, published | Quoted for your plan, free draft first |
| Best for | Solo travellers, friends, first trips | Families, couples, honeymoons, parents |
| From | **₹13,900** · 14 tours | **₹16,500** · 20 trip ideas |
| Button | See departures | Start planning |

### 3 · Upcoming departures — group tours with dates
**Job:** show real inventory and real urgency.

- **Heading:** *Leaving soon*
- **Sub:** Real dates, real seat counts. Join one.
- **List:** the next 6–8 departures sorted by date — date, trip, nights, seats
  left (amber under 6), price per person. Month chips to filter (Oct · Nov ·
  Dec · 2027).
- **Button:** All 14 group tours →
- **Motion:** the existing pinned sideways rail is a good fit here.

### 4 · Customized trip ideas — by occasion
**Job:** help people who want their own trip find a starting point.

- **Heading:** *Trip ideas we'll build around you*
- **Chips (filter):** Honeymoon · Family · Weekend · Pilgrimage · Wildlife ·
  International — driven by `idealFor` / `theme` already in the data.
- **Cards:** photo, title, places, "from ₹", "5–7 days". Clicking opens the
  trip idea, not a group tour.
- **Button:** See all 20 ideas →

### 5 · How a customized trip works — with the AI planner inside it
**Job:** remove the fear of a long back-and-forth; give the planner its
proper role.

- **Heading:** *From idea to itinerary, before you pay a rupee*
- **Steps:** 1 Tell us where and when · 2 Get a free day-by-day draft ·
  3 Change anything · 4 Approve, then pay
- **The ask bar lives here:** "Want a draft right now? Type a place." →
  AI planner. Under it: "Or WhatsApp a planner — a person replies the same day."
- **Motion:** the stacking cards suit this.

### 6 · Why YaadiGo — trust
**Job:** answer "can I trust a company I've never heard of?"

Keep the four checkable claims (they are good): real seat counts; itinerary
written before you pay; nothing payable until you approve; registered
company. Add, when they exist: traveller reviews (`lib/testimonials.js` is
empty — publish none until real ones arrive), and photos of real YaadiGo
groups.

No mosaic. One photo of an actual group, or none.

### 7 · Travel guides — from the journal
**Job:** be useful to people still deciding; feeds SEO.

Three posts as cards with images: "Vietnam or Thailand for a first trip
abroad", etc.

### 8 · Close — one human line, plus the corporate pointer
**Job:** catch the undecided; route the wrong audience.

- **Heading:** *Not sure yet? Ask a person.* (different from the footer)
- **Buttons:** WhatsApp a planner · Call us
- **A single slim line beneath, visually quiet:**
  *Booking travel for your company? → Corporate Travel Desk*

That line is the **only** corporate content on the homepage.

### What is removed

| Removed | Why |
|---|---|
| Corporate section (stats, chips, photo, 2 buttons) | Second audience; has its own tab and subdomain |
| AI planner pinned 3-screen scene | A tool, not a product — folded into section 5 |
| Giant destination marquee | Mixes products; no job |
| Photo mosaic | Decoration beside trust claims |
| Legal-name eyebrow in the hero | Means nothing to a traveller |
| Duplicate closing sentence | Footer already says it |

**Length:** roughly 9 screens at desktop, down from ~18.

---

## 5 · Image strategy

### Rules every homepage photo must pass
1. **Reads as the place in one second** — a landmark or a signature
   landscape, not a texture.
2. **People in frame** wherever possible: travellers, not models; backs and
   profiles are fine. Groups for Group Tours, couples and families for
   Customized.
3. **One look:** warm daylight or golden hour, horizon level, no heavy HDR or
   filters. Same grade across the page.
4. **Size:** ≥2,400px wide for anything full-width; ≥1,200px for cards. Crops
   prepared at 3:2 (cards), 4:5 (phone), 16:9 (hero).
5. **Licence permits commercial use, no attribution on the page** (or the
   attribution is on `/credits`, as today).

### Where to get them, in order of value
1. **Your own trips.** Photos of real YaadiGo groups are the strongest trust
   signal a group-tour company can have. Ask every tour leader for 20 shots
   per departure; get traveller consent in writing.
2. **Unsplash / Pexels** — free, commercial use, no attribution required.
   Good for destination heroes now.
3. **Paid stock** (Adobe Stock, Shutterstock, Getty) — for hero shots
   with Indian travellers in them, which free libraries rarely have.

### Shot list for the new homepage

| Slot | Count | Brief |
|---|---|---|
| Hero | 3–4 | Small group at a viewpoint (Ladakh/Spiti); couple on a Kerala houseboat; family at a Rajasthan fort; friends on an Andaman beach |
| "Two ways" cards | 2 | A group laughing on a trail · a couple / family on their own |
| Departure cards | 14 | One per group tour — the signature view of that route |
| Trip idea cards | 20 | One per customized trip — must read as the place |
| How it works | 0–1 | Optional: a planner on a call / a printed itinerary |
| Trust | 1 | A real YaadiGo group photo — or nothing |
| Journal | 3 | Already per post |

The 36 current photos stay as fallbacks until replacements arrive; the cards
for Kashmir (family), Sri Lanka, Meghalaya and corporate should be replaced
first.

---

## 6 · Copy rules for the homepage

- Lead with what the visitor gets, not what we are ("Join a small group on a
  fixed date", not "We are a leading tour operator").
- Every price is "from ₹X per person" and comes from live data.
- No brochure adjectives ("breathtaking", "unforgettable"), no exclamation
  marks — as `DESIGN-SYSTEM.md` already says.
- Corporate words (GST, invoice, wallet, executive) do not appear above the
  one corporate line.

---

## 7 · Decisions needed from the owner

1. **Approve the product names** — "Group Tours" and "Customized Tours"?
2. **Move the AI ask bar out of the hero** into the "how it works" section?
3. **Photos:** (a) free Unsplash/Pexels now, (b) paid stock, or (c) wait for
   your own trip photos and use (a) meanwhile?
4. **Do you have any real group-trip photos or traveller reviews** we can use
   with permission?

## 8 · Acceptance criteria (when this is built)

- [ ] A visitor shown the homepage for 5 seconds can name both products.
- [ ] The words GST, invoice, wallet and executive do not appear on `/`.
- [ ] Exactly one link to corporate in the page body, plus the nav and footer.
- [ ] Every price and count on `/` comes from `lib/tours.js` / `lib/packages.js`.
- [ ] Every card's photo reads as its place (checked by a person, card by card).
- [ ] Hero images ≥2,400px; no full-width image under 2,000px.
- [ ] Clicking a Group Tours card always lands on `/group-tours/…`; a
      Customized card always on `/customized-tours/…`.
- [ ] Page works with reduced motion and on a 375px phone; existing CMS
      `Editable` ids preserved or migrated.

---

## 9 · Build notes — 2026-10-10

**Owner decisions:** Group Tours + Customized Tours; AI ask bar inside "How it
works"; free Unsplash photos now, own trip photos later; build immediately.

**Built:** all eight sections as specified in `src/app/page.js`. Nav and phone
bottom bar renamed (`lib/cms/navigation.js`, `site-nav-client.js`,
`mobile-bar.js`); corporate moved to a "For business →" link (xl screens),
the footer, and the phone menu. Site title, description and share image are
now leisure-first (`layout.js`, `opengraph-image.js`).

**Photos:** 41 Unsplash photos chosen by eye from ~170 candidates, in
`public/media/u/`, registered in `src/lib/media.js` with credits.
Heroes 2,800px wide, cards 2,000px. 33 trip photos replaced; the trip pages,
listings and /credits pick them up automatically.

**Removed:** the corporate section, the 3-screen AI scene, the giant marquee,
the photo mosaic, and their now-unused components (`zoom-reveal`,
`velocity-marquee`, `parallax-mosaic`, `TiltCard`, `ShutterImage`,
`Parallax`).

**Verified:** lint clean, 306/306 tests, production build passes; walked at
1024px and 375px on the running dev server; occasion filter works; no
horizontal scroll on a phone (375 = 375); server HTML hides only decorative
overlays; visible page text contains exactly one corporate mention.

**Defects found while building, fixed:**
- Nav labels came from `lib/cms/navigation.js`, not the client default — the
  first render still said "Tours / Custom / Corporate".
- Nav wrapped onto 2–3 lines at 1024px (pre-existing, worse with longer names).
- Phone page was 433px wide: the AI box forced its grid column wider than the
  screen, and a card waiting to slide in from the right sat off-screen.
- Clip-reveal headings showed a sliver of descenders before revealing.
- Layout's description edit silently missed because the file uses CRLF.

**Still open** (backlog #124–#129):
- 33 replaced Wikimedia files (~20MB) are still in `public/media/`,
  unreferenced. Not deleted — the folder is not in git, so deletion is final.
- Kaziranga and the corporate page photo are still the old Wikimedia images.
- Old CMS text overrides (`home.planner.*`, `home.corporate.*`, `home.ask.*`)
  are orphaned; any copy an admin had edited under them no longer shows.
- "For business" is visible only from 1280px; between 1024 and 1279 corporate
  is reachable from the footer only.
- Stock photos are a stand-in: real YaadiGo group photos are the goal.
- Not yet checked on a real mid-range Android or with reduced motion on.
