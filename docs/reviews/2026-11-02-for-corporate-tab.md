# "For Corporate" tab: PM + CTO review

**Date:** 2026-11-02 · **Asked for:** "add a landing page for corporate travel
in the For business tab on the menu … to generate leads from corporates, and
name this tab For Corporate, not For business or Corporate Desk"

## CTO: what existed, what changed

A corporate lead-generation landing page already existed at `/corporate`. It
has a hero, services, how-it-works, billing, offsites and the
`CorporateLeadForm`, which posts to `submitEnquiry` with
`source=corporate-desk` and lands in the admin lead inbox. Nothing new had to
be built. The tab was what was broken:

- "For business" linked to `https://corporate.yaadigo.com`. That host has no
  DNS (`curl` gets no connection), so the tab went nowhere. So did the footer,
  home, about and contact links that use `CORPORATE_URL`, and both buttons on
  `/corporate-travel`.

Changes:

- `CORPORATE_URL` is now `/corporate`. It is relative, so it works on the main
  domain today and on the subdomain later (`src/proxy.js` leaves `/corporate`
  alone there).
- Every visible name for the segment is now **For Corporate**: header tab,
  phone menu, footer, the corporate page's nav sub-brand, hero eyebrow and
  `<title>`, plus link labels on home, about, contact and `/corporate-travel`.
- The phone menu now lists "For Corporate". Before, its only corporate link
  sat under the bottom app bar and could not be seen.
- Not changed on purpose: the lead `source` value `corporate-desk`, so
  existing leads and inbox filters stay grouped; "the desk" when it means the
  team; the Yaadi concierge prompt; and `hero.js` and `corporate-promo-block.js`,
  which nothing imports.

## PM review: used, not read

Tested on the local file store (`scripts/dev-local-store.mjs`, port 3008),
because the live database is unreachable (finding 1).

| # | Acceptance criterion | Result |
|---|---|---|
| 1 | Header at 1440px shows "For Corporate", not "For business" | ✅ |
| 2 | Clicking it opens the corporate landing page | ✅ `/corporate`, title "For Corporate — GST-Compliant Business Travel…" |
| 3 | The lead form is on that page and tagged as corporate | ✅ "Set up a corporate account", `source=corporate-desk` |
| 4 | Phone menu shows "For Corporate" | ✅ seventh row, above the fold at 375×812 |
| 5 | No "For business" and no `corporate.yaadigo.com` link left in rendered HTML | ✅ on `/`, `/corporate`, `/corporate-travel`, `/contact`, `/about` (only the `corporate@` email remains) |
| 6 | Gate | eslint clean on changed files; vitest 454/455. The one failure, `trip-seats.test.js`, is unrelated (finding 5). Production build not run: the live DB is down |

## CTO review: correct and safe?

| # | Finding | Sev | Backlog |
|---|---|---|---|
| 1 | Every query fails with `tenant/user postgres.fgffhgstimvluokewukm not found`: the Supabase project in `DATABASE_URL` is paused, deleted or has new credentials. Every page that reads the DB returns 500 | **S1** | #179 |
| 2 | A menu saved in the admin overrides the coded phone menu (`mobileExtra`). If one was saved, "For Corporate" will not appear on phones until it is added there | S2 | #180 |
| 3 | `/corporate` (lead page) and `/corporate-travel` (CMS page) cover the same offer with different canonicals and split the SEO | S3 | #181 |
| 4 | `Editable` overrides saved in the DB for `/contact` and `/corporate-travel` may still say "Corporate Travel Desk". Not checkable while the DB is down | S3 | #182 |
| 5 | `src/lib/cms/trip-seats.test.js` › "the editor cannot shrink a batch below what is booked" fails: `toMatch()` got `undefined` | S2 | #183 |
| 6 | The tab is still hidden from 1024 to 1279px | S4 | existing #127 |
