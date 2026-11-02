# Deploying to the Hostinger VPS

**Decided 2026-11-02:** the database moves off Supabase, which became
unreachable (`tenant/user … not found`, backlog #179), to PostgreSQL on the
same VPS that serves yaadigo.com (72.60.202.179). The schema and code are
unchanged; MySQL was considered and rejected (40 `.returning()` calls, pg
enums, jsonb, CHECK invariants, PGlite tests: weeks of rewrite in the money and
seat code). The new database starts **empty**: no trips, leads or bookings
carry over.

What runs on the box:

| Piece | Where |
|---|---|
| App (`next start`, PM2 process `yaadigo`) | `/var/www/yaadigo`, user `yaadigo`, `127.0.0.1:3100` |
| PostgreSQL | localhost:5432, database and role `yaadigo`, password in `/root/yaadigo-db-password` |
| Env | `/var/www/yaadigo/.env.local` (600), generated from `/root/yaadigo.env` |
| Photo uploads | `/var/www/yaadigo/uploads/` (no `SUPABASE_*` set, so `media-store.js` uses the disk) |
| PDFs | Google Chrome, `CHROME_PATH=/usr/bin/google-chrome-stable` |
| nginx | `/etc/nginx/sites-available/yaadigo` from `deploy/nginx-yaadigo.conf` |

## First deploy

1. **Look before changing anything.** This VPS may host other sites.
   ```bash
   scp deploy/setup-vps.sh root@72.60.202.179:/root/
   ssh root@72.60.202.179 'bash /root/setup-vps.sh inspect'
   ```
   Check: are ports 3100 and 5432 free, which nginx file serves "Coming Soon"
   for yaadigo.com, and how much RAM there is.
2. **Upload the production secrets.** Start from your `.env.local`. The
   script replaces `DATABASE_URL` and drops `DIRECT_DATABASE_URL` and
   `SUPABASE_*`. `ADMIN_EMAIL` and `ADMIN_PASSWORD` create the first admin on
   the empty database, so set a strong password before uploading. Add
   `COMPANY_GSTIN` if invoices are needed.
   ```bash
   scp .env.local root@72.60.202.179:/root/yaadigo.env
   ssh root@72.60.202.179 'chmod 600 /root/yaadigo.env'
   ```
3. **Install, then deploy.**
   ```bash
   ssh root@72.60.202.179 'bash /root/setup-vps.sh install'
   ssh root@72.60.202.179 'bash /root/setup-vps.sh app'
   ```
   `app` ends with a smoke test of `/` and `/corporate` on port 3100.
4. **Switch nginx over (reviewed by hand).** Disable the "Coming Soon"
   server block for yaadigo.com that `inspect` found, then:
   ```bash
   cp /var/www/yaadigo/deploy/nginx-yaadigo.conf /etc/nginx/sites-available/yaadigo
   ln -s /etc/nginx/sites-available/yaadigo /etc/nginx/sites-enabled/yaadigo
   nginx -t && systemctl reload nginx
   certbot --nginx -d yaadigo.com -d www.yaadigo.com
   ```
5. **Sign in** at `https://www.yaadigo.com/admin/login` with `ADMIN_EMAIL` /
   `ADMIN_PASSWORD`, then change the password in Team.

## Updating

Push to `main`, then:
```bash
ssh root@72.60.202.179 'bash /var/www/yaadigo/deploy/setup-vps.sh app'
```

## Backups

The database is now on one machine and nothing backs it up yet (backlog
#184). Until that is set up, take a dump before every update:
```bash
sudo -u postgres pg_dump -Fc yaadigo > /root/yaadigo-$(date +%F).dump
```
