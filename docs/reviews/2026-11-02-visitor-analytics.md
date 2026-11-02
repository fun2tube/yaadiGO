# Phase 1a, visitor analytics: DevOps + PM + CTO review

**Date:** 2026-11-02 · **Spec:** docs/design/ai-cofounder.md (Phase 1,
"tracking first") · **Owner's decision:** anonymous first-party funnels only,
no recordings.

## CTO: what was built

- **Tables (migration 0006):**
  - `visits`: a 30-minute session, classified once on arrival by channel and
    source, with UTM, device, browser, OS, time zone and language.
  - `pageviews`: path normalised, time visible, deepest scroll.
  - `site_events`.
  - `leads.visit_id` (FK, set null).
  - CHECKs on scroll range, duration and page count.
- **Browser:** `src/instrumentation-client.js`. It uses Next 16's
  before-hydration hook plus `onRouterTransitionStart`.
  - Two random ids: a visitor id in localStorage, and a visit id in
    localStorage plus a `yg_sid` cookie, 30-minute rolling.
  - Beacons go out by `sendBeacon` as text/plain, so there is no preflight.
  - It records WhatsApp, call, email and outbound taps with the link's label.
  - It skips `/admin`, `/api` and `/pdf`.
- **Server:** `POST /api/t`. Always 204.
  - Zod-validated, clipped and rate-limited (600 per IP per hour, the IP never
    stored).
  - Drops bots and headless browsers, and drops signed-in staff.
  - Takes server time only.
  - Writes are idempotent, so retries never double count.
- **Lead link:** `captureLead` reads `yg_sid`, checks the visit exists, saves
  `visit_id`, and records `enquiry_submitted`. It never throws: a lead
  cannot fail because of analytics.
- **Report:** `lib/analytics/report.js` and `/admin/traffic` (permission
  `reports.read`, nav "Traffic"). It shows:
  - visitors, visits, enquiries, conversion, median time and one-page visits,
    each against the previous period;
  - daily charts;
  - channel → enquiries → bookings → ₹ booked;
  - sources, landing pages, top pages with time and scroll, actions and
    campaigns.
- **Privacy policy:** rewritten honestly. The old text said "no tracking
  cookies", which would now be false.

## DevOps: verified

- `classify.test.js` (13 tests): search vs AI vs social vs paid vs email,
  UTM precedence, bots, and share tokens never stored (`/q/:token`).
- `analytics.test.ts` (6 tests, real Postgres via PGlite):
  - a retried beacon does not double count;
  - an internal click does not re-classify the visit;
  - leave only grows, and the DB refuses scroll 140;
  - channel booked value is not doubled by a second lead on the same visit,
    and cancelled bookings are excluded;
  - an empty period reads zeros, not errors.
- Admin panel smoke test includes Traffic.
- Full suite: 474/475. The one failure is the known date-dependent
  `trip-seats` test (#183).
- In the browser, against the local server:
  - ids and the cookie are set on load;
  - a click to a trip sends leave (time 16.8 s) then pageview (referrer =
    home);
  - the WhatsApp tap is recorded with label "WhatsApp a planner".
- Bad bodies get 204: not a UUID, junk JSON, an event name not on the list.

## Findings

**F1 (S2): the logo commit broke 34 quotation-template tests. Fixed.** The
logo deploy (earlier today) went out after lint and a visual check but
without the full suite. `next/image` with a static PNG import gets no
dimensions under vitest. `BrandLogo` now uses a path and its stated size, and
production behaves the same. Lesson: run the full suite before every deploy,
not only before "big" ones.

**F2 (S3): scroll depth read 0 when a visitor scrolled and clicked at once.
Fixed.** It is measured again at flush.

**F3 (S4): Chrome reports `Asia/Calcutta`. Fixed.** Aliases are normalised,
so India is one row.

**F4 (S3): the time zone is a country proxy, not a country.** It is good
enough for "India vs Gulf vs rest", but cannot give cities. A real geo
lookup needs MaxMind GeoLite2 (free account). → #193.

**F5 (S3): staff on their phones without an admin session are counted as
visitors.** Small, but real on a low-traffic site. Option: an "exclude this
device" button in admin that sets a flag the tracker reads. → #194.

**F6 (S4): raw rows grow without limit.** At current traffic this is years
from mattering. Daily rollups and 13-month raw retention come in Phase 3,
when the agent reads them. → #195.

**F7: no data has been verified on the live server yet.** That happens after
deploy with one tagged test visit, which is then removed.
