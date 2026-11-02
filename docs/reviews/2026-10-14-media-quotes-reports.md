# Media library, quotation register, reports, admin papercuts — review

**Date:** 2026-10-14 · **Plan:** `docs/design/2026-10-14-media-quotes-reports.md`
**Tested on:** local file store in the browser (test data only), `vitest run`
(455 tests), `eslint .`, `next build` against the real `DATABASE_URL`.
Backups: `.backup/media-reports-2026-10-14/`.

## PM review — used, not read

| # | Acceptance criterion | Result |
|---|---|---|
| 1 | Every section reachable on a phone in ≤ 2 taps | ✅ Bottom bar: Overview · Leads · Bookings · Quotes · **More**; More opens Ops, Trips, Departures, Pages, Media, Invoices, Reports, Team |
| 2 | Upload → pick into a quotation → customer sees it | ✅ Two 3200/2400 px photos uploaded from the Media page → stored at 2000 px, ~35 KB, category "Hotels & stays · Srinagar". Picked as a hotel photo and a stay-gallery photo; both shown on the staff preview, the customer link and in the PDF (502 KB, 17 s) |
| 3 | Preview works for drafts; customer link still refuses drafts | ✅ Draft preview 200 with "this is a draft" band; its `/q/` link 404; sent/approved previews show no approve buttons |
| 4 | Register: period, filters, KPIs = table, ops read-only, CSV | ✅ 30 days: 3 sent, ₹4,72,500 = sum of rows; approved ₹2,56,935 = sum of approved rows. Ops sees the register without margin or "Ready to quote" (test). CSV has the same rows; margin only for managers |
| 5 | Reports: every period, comparison, per-person rows sum to headline | ✅ Today / week / month / last month / quarter / FY / custom all 200 in 0.5–1.6 s; team rows sum to quoted and booked value (test); integrity check flagged the old duplicate booking from the first test round |
| 6 | Price bar ≤ 64 px | ✅ 53 px, one line: total · per person · margin · Save · Send; tap the total for the breakdown |
| 7 | Gate | ✅ 455/455, eslint clean, build passes |

## CTO review — correct and safe?

| # | Finding | Sev | Status |
|---|---|---|---|
| R1 | "This month" was compared with the 14 days *before today* (16–30 Sep), not 1–14 Sep — every growth figure on the 14th would have been wrong. Found by the report test. | S2 | **Fixed** — calendar periods compare like for like; rolling ones with the stretch before. Tests added. |
| R2 | `highlights` could be rendered on the customer page but never saved from the editor (not whitelisted). | S2 | **Fixed**. |
| R3 | The More sheet was promised in a code comment and never built — six sections unreachable below 1024 px since the panel shipped. | S2 | **Fixed**. |
| R4 | Uploads: type read from the bytes (JPEG/PNG/WebP only — SVG refused, so no script-in-image), 4 MB cap, random UUID paths, file route accepts only our path shape (traversal → 404), anonymous upload → 401. EXIF/GPS dropped by re-encoding in the browser. | — | Verified |
| R5 | Opening the preview in a new tab after an `await` would be popup-blocked. | S3 | **Fixed** — tab opened inside the click. |
| R6 | Register and Reports could disagree on "quotes sent" value. | S2 | **Prevented** — Reports call the register's function; a test asserts they match. |

Honest limits:

| # | Item | Sev | Why |
|---|---|---|---|
| O1 | **Supabase Storage path is untested** — no `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` here. Locally photos go to `uploads/` on disk (fine on one long-lived server). On Vercel without the keys, upload is refused with the reason. | S1 for go-live | Needs the keys (#175) |
| O2 | Existing Operations users do not get `quotations.read` automatically — presets apply at invite. Tick "Quotations" for each in Team. | S3 | Deliberate (presets never widen existing access) |
| O3 | Sales keep `reports.read`, so a salesperson sees the whole team scorecard. | S3 | Owner's call: motivating or not |
| O4 | "Lost in period" uses the lead's last update date (there is no `lostAt`). | S4 | Add `lostAt` on the stage change |
| O5 | Booked value uses a booking's current total (a later revision changes last month's figure). | S4 | Documented in analytics.js |
| O6 | HEIC (iPhone) photos are refused with instructions — browsers cannot decode them. | S4 | Platform limit |

## Verdict

All seven asks are built and verified. Go-live needs the Supabase Storage keys
for uploads (#175), plus the items already open from earlier today.
