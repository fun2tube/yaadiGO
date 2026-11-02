#!/usr/bin/env bash
# YaadiGo on the Hostinger VPS, as Docker containers behind the box's shared
# nginx-proxy (jwilder/nginx-proxy + acme-companion, network "proxy"), the way
# every other site there runs. See docs/deploy-vps.md for the full runbook.
#
#   bash setup-vps.sh inspect    read-only: containers, routing, ports
#   bash setup-vps.sh app        clone or update, env, database, migrate, build, start
#   bash setup-vps.sh cutover    route yaadigo.com to the app, retire "Coming Soon"
#   bash setup-vps.sh rollback   undo cutover: bring "Coming Soon" back
#   bash setup-vps.sh backup     pg_dump the database to /root/yaadigo-backups
#
# Every stage is safe to run again. `app` never changes what yaadigo.com serves:
# a new build only goes live through `cutover` (or, once cut over, by being
# recreated with the routing it already has).
set -euo pipefail

APP_DIR=/opt/yaadigo-os
REPO=https://github.com/fun2tube/yaadiGO.git
BRANCH="${BRANCH:-main}"
DB_PASSWORD_FILE=/root/yaadigo-db-password
# The production secrets (Razorpay, Gemini, ADMIN_*, ...) uploaded from the
# owner's machine. DATABASE_URL in it is replaced; Supabase keys are dropped.
ENV_SOURCE="${ENV_SOURCE:-/root/yaadigo.env}"
HOSTS=yaadigo.com,www.yaadigo.com
# The address the box's existing yaadigo.com certificate was issued to.
LETSENCRYPT_EMAIL=contact.eghai@gmail.com
# The "Coming Soon" container (/home/super-admin/yaadigo-frontend).
OLD_CONTAINER=yaadigo-frontend
BACKUP_DIR=/root/yaadigo-backups

log() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
compose() { DB_PASSWORD_FILE="$DB_PASSWORD_FILE" docker compose -f "$APP_DIR/deploy/docker-compose.yml" "$@"; }

# GET a path from inside the app container (the image has no curl).
probe() {
  docker exec yaadigo-app node -e '
    const t = Date.now();
    fetch("http://127.0.0.1:3000" + process.argv[1], { redirect: "manual" })
      .then((r) => console.log(`GET ${process.argv[1]} -> ${r.status} in ${Date.now() - t}ms`))
      .catch((e) => { console.log(`GET ${process.argv[1]} -> ${e.message}`); process.exitCode = 1; });
  ' "$1"
}

inspect() {
  log "System"
  hostname; grep PRETTY_NAME /etc/os-release || true
  free -h | sed -n 2p; df -h / | tail -1; echo "cpus: $(nproc)"
  docker version --format 'docker {{.Server.Version}}'; docker compose version
  log "Containers"
  docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}'
  log "Who serves yaadigo.com"
  for c in $(docker ps -aq); do
    docker inspect "$c" --format '{{.Name}} {{range .Config.Env}}{{println .}}{{end}}' | grep -i 'VIRTUAL_HOST=.*yaadigo' || true
  done
  log "Port 5433 (the database's localhost port)"
  ss -ltn | awk 'NR==1 || /:5433 /'
}

write_env() {
  [ -f "$ENV_SOURCE" ] || { echo "Missing $ENV_SOURCE: upload the production env file first (see runbook)."; exit 1; }
  local password base
  password="$(cat "$DB_PASSWORD_FILE")"
  base="$(grep -vE '^(DATABASE_URL|DIRECT_DATABASE_URL|SUPABASE_[A-Z_]*|CHROME_PATH)=' "$ENV_SOURCE" | tr -d '\r')"
  # The app reaches Postgres by its service name on the internal network...
  printf '%s\nDATABASE_URL=postgres://yaadigo:%s@db:5432/yaadigo\n' "$base" "$password" > "$APP_DIR/.env.runtime"
  # ...the build, on the host network, through the localhost port.
  printf '%s\nDATABASE_URL=postgres://yaadigo:%s@127.0.0.1:5433/yaadigo\n' "$base" "$password" > "$APP_DIR/.env.build"
  chmod 600 "$APP_DIR/.env.runtime" "$APP_DIR/.env.build"
}

app() {
  log "Code ($BRANCH)"
  if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
    git -C "$APP_DIR" reset --hard "origin/$BRANCH"
  else
    git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
  fi
  git -C "$APP_DIR" log --oneline -1

  log "Database password"
  if [ ! -s "$DB_PASSWORD_FILE" ]; then
    # Hex only, so it never needs escaping inside a connection URL. Postgres
    # takes it once, when the volume is first created.
    openssl rand -hex 24 > "$DB_PASSWORD_FILE"
    chmod 600 "$DB_PASSWORD_FILE"
  fi
  echo "in $DB_PASSWORD_FILE"

  log "Environment"
  write_env

  log "Database"
  compose up -d --wait db

  log "Migrations"
  compose build migrate
  compose run --rm migrate

  log "Build"
  compose build app

  log "Start"
  compose up -d app

  log "Smoke test (inside the container)"
  for _ in $(seq 1 30); do probe / >/dev/null 2>&1 && break; sleep 2; done
  probe / || true
  probe /corporate || true
  probe /group-tours || true

  if [ -s "$APP_DIR/.env.routing" ]; then
    echo "Live: routed to $HOSTS."
  else
    echo "Not routed yet. yaadigo.com still shows $OLD_CONTAINER. Run: bash $0 cutover"
  fi
}

cutover() {
  log "Route $HOSTS to yaadigo-app"
  printf 'VIRTUAL_HOST=%s\nLETSENCRYPT_HOST=%s\nLETSENCRYPT_EMAIL=%s\n' "$HOSTS" "$HOSTS" "$LETSENCRYPT_EMAIL" > "$APP_DIR/.env.routing"
  # Two containers claiming one VIRTUAL_HOST get load-balanced, so retire the
  # old one first. restart=no stops it coming back after a reboot; the
  # container and its source in /home/super-admin are kept for rollback.
  if docker inspect "$OLD_CONTAINER" >/dev/null 2>&1; then
    docker update --restart=no "$OLD_CONTAINER" >/dev/null
    docker stop "$OLD_CONTAINER" >/dev/null
    echo "Stopped $OLD_CONTAINER"
  fi
  compose up -d app
  sleep 8
  for host in yaadigo.com www.yaadigo.com; do
    curl -s -o /dev/null -w "https://$host/ -> %{http_code} in %{time_total}s\n" "https://$host/" || true
  done
}

rollback() {
  log "Back to $OLD_CONTAINER"
  rm -f "$APP_DIR/.env.routing"
  compose up -d app
  docker update --restart=always "$OLD_CONTAINER" >/dev/null
  docker start "$OLD_CONTAINER" >/dev/null
  echo "yaadigo.com is served by $OLD_CONTAINER again; yaadigo-app keeps running unrouted."
}

backup() {
  mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
  local file="$BACKUP_DIR/yaadigo-$(date +%F-%H%M).dump"
  docker exec yaadigo-db pg_dump -U yaadigo -Fc yaadigo > "$file"
  ls -lh "$file"
}

case "${1:-}" in
  inspect) inspect ;;
  app) app ;;
  cutover) cutover ;;
  rollback) rollback ;;
  backup) backup ;;
  *) echo "usage: bash $0 inspect|app|cutover|rollback|backup"; exit 1 ;;
esac
