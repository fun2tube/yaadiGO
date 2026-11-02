# Deploying to the Hostinger VPS

**Decided 2026-11-02:** the database moves off Supabase, which became
unreachable (`tenant/user … not found`, backlog #179), to PostgreSQL on the
VPS that serves yaadigo.com (72.60.202.179). The schema and code are
unchanged; MySQL was considered and rejected (40 `.returning()` calls, pg
enums, jsonb, CHECK invariants, PGlite tests: weeks of rewrite in the money and
seat code). The new database starts **empty**: no trips, leads or bookings
carry over.

**How the box works (inspected 2026-11-02):** every site on it (Muscle Spark,
Holidays Planners, IMR, the Travel-backend API at api.yaadigo.com, …) is a
Docker container. A shared `nginx-proxy` (jwilder/nginx-proxy) owns ports 80
and 443 and routes by each container's `VIRTUAL_HOST`; `acme-companion` issues
the HTTPS certificates from `LETSENCRYPT_HOST`. Both are defined in
`/home/super-admin/apps/Travel-backend`. YaadiGo joins the same way, so no
nginx file or certbot run is needed and nothing else on the box changes.

| Piece | Where |
|---|---|
| Checkout | `/opt/yaadigo-os` (root) |
| App | container `yaadigo-app`, image from `Dockerfile`, port 3000 on the `proxy` network |
| PostgreSQL 17 | container `yaadigo-db`, volume `yaadigo-os_pgdata`, `127.0.0.1:5433` on the host only |
| DB password | `/root/yaadigo-db-password` |
| Env | `/root/yaadigo.env` (uploaded) → `.env.runtime` and `.env.build` in the checkout, written by the script |
| Routing | `.env.routing` in the checkout: absent = not served, present = yaadigo.com + www |
| Photo uploads | volume `yaadigo-os_uploads` (no `SUPABASE_*` set, so `media-store.js` uses the disk) |
| PDFs | Debian Chromium in the image, `CHROME_PATH=/usr/bin/chromium` |
| Old "Coming Soon" | container `yaadigo-frontend` (`/home/super-admin/yaadigo-frontend`), stopped at cutover, kept for rollback |

`corporate.yaadigo.com` is left out of the routing until its DNS record
exists: one unresolvable name fails the certificate for all of them.

## First deploy

1. **Upload the script and the production secrets.** Start from your
   `.env.local`. The script replaces `DATABASE_URL` and drops
   `DIRECT_DATABASE_URL` and `SUPABASE_*`. `ADMIN_EMAIL` and `ADMIN_PASSWORD`
   create the first admin on the empty database. Add `COMPANY_GSTIN` if
   invoices are needed.
   ```bash
   scp deploy/setup-vps.sh root@72.60.202.179:/root/
   scp .env.local root@72.60.202.179:/root/yaadigo.env
   ssh root@72.60.202.179 'chmod 600 /root/yaadigo.env && bash /root/setup-vps.sh inspect'
   ```
2. **Build and start, unrouted.** Clones the repo, creates the database,
   runs the migrations, builds the image and starts it. yaadigo.com still
   shows "Coming Soon" afterwards. Ends with a smoke test inside the
   container. Takes about 10 minutes.
   ```bash
   ssh root@72.60.202.179 'bash /root/setup-vps.sh app'
   ```
3. **Cut over.** Stops "Coming Soon" and routes yaadigo.com and
   www.yaadigo.com to the app.
   ```bash
   ssh root@72.60.202.179 'bash /opt/yaadigo-os/deploy/setup-vps.sh cutover'
   ```
   To undo: `setup-vps.sh rollback`.
4. **Sign in** at `https://www.yaadigo.com/admin/login` with `ADMIN_EMAIL` /
   `ADMIN_PASSWORD`, then change the password in Team.

## Updating

Push to `main`, then:
```bash
ssh root@72.60.202.179 'bash /opt/yaadigo-os/deploy/setup-vps.sh app'
```
Once cut over, `app` recreates the container with its routing, so the new
build goes live as soon as it starts (a few seconds of 502 while it boots).

## Backups

Installed 2026-11-02 by `setup-vps.sh schedule` (`/etc/cron.d/yaadigo-backup`):

- **Nightly, 03:00 IST:** `backup` writes `yaadigo-<date>.dump` (pg_dump,
  custom format, checked readable by `pg_restore --list`) and
  `uploads-<date>.tar.gz` (the photo volume) to `/root/yaadigo-backups`,
  root-only, and deletes files older than 14 days.
- **Sundays, 04:00 IST:** `restore-check` restores the newest dump into a
  scratch database, prints each table's row count beside the live one, and
  drops it.
- Both log to `/var/log/yaadigo-backup.log`.

These copies sit **on the same server**: they cover a bad deploy or a
mistaken delete, not losing the server. An off-server copy is backlog #184.

Take one by hand before every update:
```bash
ssh root@72.60.202.179 'bash /opt/yaadigo-os/deploy/setup-vps.sh backup'
```

Restore (replaces the live data; take a fresh backup first):
```bash
docker exec -i yaadigo-db pg_restore -U yaadigo -d yaadigo --clean --if-exists --no-owner < /root/yaadigo-backups/yaadigo-<date>.dump
docker restart yaadigo-app
```
