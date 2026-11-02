# VPS deploy and backups: DevOps + PM + CTO review

**Date:** 2026-11-02 · **Asked for:** "we need to deploy this to our
hostinger server", "Postgres on the VPS", "set up backups"

## CTO: what was built

- **Hosting:** YaadiGo runs on the Hostinger VPS (72.60.202.179) as two
  containers: `yaadigo-app` (Next 16, Node 24, Debian Chromium for PDFs) and
  `yaadigo-db` (Postgres 17, new and empty).
- **Shared box:** the server also runs Muscle Spark, Holidays Planners, IMR and
  the Travel-backend. They all sit behind jwilder/nginx-proxy +
  acme-companion, which route by `VIRTUAL_HOST` and issue certificates.
  YaadiGo joins the same way; no host nginx or certbot.
- **Plan change:** the first plan (host Postgres + PM2 + nginx) was dropped
  after `inspect` showed the proxy owns ports 80/443.
- **Deploy stages:** `app` builds and starts unrouted. `cutover` stops the
  old "Coming Soon" container (`restart=no`, kept) and adds the routing.
  `rollback` reverses it.
- **Backups:** nightly `pg_dump` (checked by `pg_restore --list`) plus a tar of
  the uploads volume. 14 days are kept, root-only. A weekly `restore-check`
  restores the newest dump into a scratch database.
- **Secrets:** the build reads env through a BuildKit secret, so no layer holds
  it. Runtime env comes from `env_file`, mode 600. Postgres is published on
  127.0.0.1 only.
- **Code:** one change. `--no-sandbox` for Chromium behind
  `CHROME_NO_SANDBOX=1`, which only the Dockerfile sets. `renderPdf` only
  loads our own origin.

## DevOps: verified

| Check | Result |
|---|---|
| Migrations 0000–0005 on the new DB | 15 tables |
| Build with the real DB (prerender) | passes |
| Inside the container: `/`, `/corporate`, `/group-tours`, `/admin/login`, `/contact`, `/customized-tours`, `/blog`, `/plan`, `/sitemap.xml`, `/robots.txt` | all 200, < 200 ms |
| App log after the probes | 0 errors |
| Chromium in the image | renders a page |
| Container → `https://www.yaadigo.com` (PDF origin) | 200 |
| After cutover, from outside: yaadigo.com, www, /corporate, /group-tours, /admin/login | 200, new site's titles |
| Certificate | CN yaadigo.com, SAN yaadigo.com + www, valid to 2027-01-29 |
| Neighbours after cutover: musclesspark.com, holidaysplanners.com, api.yaadigo.com | 200 |
| `backup` → `restore-check` | 15 tables restored, scratch DB dropped |
| `backup` under cron's bare environment (`env -i PATH=/usr/bin:/bin`) | exit 0 |
| Backup file mode | `-rw-------` |

## PM review: does it work, used rather than read

The public pages and the sign-in page work. Not yet used on the live site:

- signing in;
- adding a trip;
- an enquiry reaching the inbox;
- a photo upload;
- a PDF print;
- a Razorpay payment.

Each of these writes real data or reaches a third party. They are the
owner's first steps, not something to fake. The empty catalogue is a
decision, not a defect: the owner chose fresh data.

## Findings

**F1 (S1): backups sit on the same server.** They cover a bad deploy or a
mistaken delete, not losing the VPS or the Hostinger account. Copying them
off the server needs a destination the owner chooses. → #184, narrowed.

**F2 (S2): a failed backup is silent.** Cron writes to
`/var/log/yaadigo-backup.log`, which nobody reads. A full disk or a stopped
`yaadigo-db` would leave the newest dump weeks old with nobody noticing.
→ #185.

**F3 (S2): the restore check has only proven an empty database.** Every table
restored with 0 rows, so the check proves the schema and the tooling but not
data. The first Sunday run after real data exists will show non-zero counts.
→ #186.

**F4 (S2): the first deploy failed on a name clash.** On the shared `proxy`
network, `musclesspark-db` also answers to `db`, and the app connected to it.
It was refused, so nothing was written. Fixed by connecting to `yaadigo-db`.
The lesson: any name on the `proxy` network must be unique to the whole box.
Recorded in the deploy memory and as a comment in `setup-vps.sh`. Fixed.

**F5 (S2): Razorpay webhooks.** The live keys came across, but the webhook
URL and secret were registered for the old setup, if at all. Payments would
succeed at Razorpay and never reach the booking. → #187.

**F6 (S3): deploys cost a few seconds of 502 and build on the shared box.**
`app` recreates the container in place. The build (about 4 minutes, `cpus: 2`
in next.config) runs on the same 4 CPUs as the other businesses' sites.
Acceptable at this traffic. → #188.

**F7 (S3): `corporate.yaadigo.com` is not routed.** It has no DNS record, and
adding it to `LETSENCRYPT_HOST` now would fail the certificate for all three
names. → #189.

**F8 (S4): the backup log is never rotated.** It grows about 1 KB a night, so
this is cosmetic for years. Not filed.

Superseded by this deploy: #157 (deploy), #179 (Supabase unreachable),
#175 (Supabase Storage keys: photos now go to the `uploads` volume).
