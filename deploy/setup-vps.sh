#!/usr/bin/env bash
# YaadiGo on a single VPS: Postgres, Node, Chrome and PM2 on one machine.
# See docs/deploy-vps.md for the full runbook.
#
#   sudo bash setup-vps.sh inspect   read-only: what is already on the box
#   sudo bash setup-vps.sh install   packages, swap, app user, empty database
#   sudo bash setup-vps.sh app       clone or update, env, migrate, build, (re)start
#
# Every stage is safe to run again. Nothing here touches another site's nginx
# config. nginx is a separate, reviewed step in the runbook.
set -euo pipefail

APP_DIR=/var/www/yaadigo
APP_USER=yaadigo
APP_PORT="${APP_PORT:-3100}"
REPO=https://github.com/fun2tube/yaadiGO.git
BRANCH="${BRANCH:-main}"
DB_NAME=yaadigo
DB_USER=yaadigo
DB_PASSWORD_FILE=/root/yaadigo-db-password
# The production secrets (Razorpay, Gemini, ADMIN_*, ...) uploaded from the
# owner's machine. DATABASE_URL in it is replaced; Supabase keys are dropped.
ENV_SOURCE="${ENV_SOURCE:-/root/yaadigo.env}"

log() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

inspect() {
  log "System"
  hostname; grep PRETTY_NAME /etc/os-release || true
  free -h | sed -n 2p; df -h / | tail -1; echo "cpus: $(nproc)"
  swapon --show || true
  log "Software"
  for bin in node npm pm2 psql nginx certbot git google-chrome-stable chromium; do
    printf '%-22s %s\n' "$bin" "$(command -v "$bin" || echo '-')"
  done
  command -v node >/dev/null && node -v
  log "Listening ports"
  ss -ltnp | awk 'NR==1 || /:(80|443|3000|3100|5432) /'
  log "PM2 processes"
  command -v pm2 >/dev/null && pm2 ls --no-color || echo "no pm2"
  log "nginx sites"
  ls -l /etc/nginx/sites-enabled/ 2>/dev/null || true
  grep -rln -i yaadigo /etc/nginx/ 2>/dev/null || echo "no nginx file mentions yaadigo"
  log "Certificates"
  ls /etc/letsencrypt/live/ 2>/dev/null || echo "none"
}

install() {
  export DEBIAN_FRONTEND=noninteractive
  log "Packages"
  apt-get update -y
  apt-get install -y ca-certificates curl git gnupg postgresql postgresql-contrib nginx

  if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1)" != "v24" ]; then
    log "Node 24 (NodeSource)"
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
    apt-get install -y nodejs
  fi
  command -v pm2 >/dev/null || npm install -g pm2

  # PDFs (quotations, itineraries) print with the machine's Chrome.
  if ! command -v google-chrome-stable >/dev/null; then
    log "Google Chrome (for PDF downloads)"
    curl -fsSLo /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
    apt-get install -y /tmp/chrome.deb
    rm -f /tmp/chrome.deb
  fi

  # `next build` needs ~2 GB. A small VPS without swap gets OOM-killed midway.
  if [ -z "$(swapon --show)" ] && [ "$(free -m | awk '/Mem:/ {print $2}')" -lt 4000 ]; then
    log "2 GB swap file"
    fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi

  id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$APP_USER"
  mkdir -p "$APP_DIR" && chown "$APP_USER:$APP_USER" "$APP_DIR"

  log "Postgres: role and database"
  systemctl enable --now postgresql
  if [ ! -s "$DB_PASSWORD_FILE" ]; then
    # Hex only, so it never needs escaping inside a connection URL.
    openssl rand -hex 24 > "$DB_PASSWORD_FILE"
    chmod 600 "$DB_PASSWORD_FILE"
  fi
  local password; password="$(cat "$DB_PASSWORD_FILE")"
  if sudo -u postgres psql -tAc "select 1 from pg_roles where rolname='$DB_USER'" | grep -q 1; then
    sudo -u postgres psql -c "alter role $DB_USER with login password '$password'"
  else
    sudo -u postgres psql -c "create role $DB_USER with login password '$password'"
  fi
  sudo -u postgres psql -tAc "select 1 from pg_database where datname='$DB_NAME'" | grep -q 1 \
    || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
  # Postgres listens on localhost only (the Debian/Ubuntu default) — not opened to the internet.
  echo "Database ready: $DB_NAME owned by $DB_USER (password in $DB_PASSWORD_FILE)"
}

write_env() {
  [ -f "$ENV_SOURCE" ] || { echo "Missing $ENV_SOURCE: upload the production env file first (see runbook)."; exit 1; }
  local password; password="$(cat "$DB_PASSWORD_FILE")"
  {
    grep -vE '^(DATABASE_URL|DIRECT_DATABASE_URL|SUPABASE_[A-Z_]*|CHROME_PATH)=' "$ENV_SOURCE" | tr -d '\r'
    echo "DATABASE_URL=postgres://$DB_USER:$password@127.0.0.1:5432/$DB_NAME"
    echo "CHROME_PATH=/usr/bin/google-chrome-stable"
  } > "$APP_DIR/.env.local"
  chown "$APP_USER:$APP_USER" "$APP_DIR/.env.local"
  chmod 600 "$APP_DIR/.env.local"
}

app() {
  log "Code ($BRANCH)"
  if [ -d "$APP_DIR/.git" ]; then
    sudo -u "$APP_USER" git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
    sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard "origin/$BRANCH"
  else
    sudo -u "$APP_USER" git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
  fi
  sudo -u "$APP_USER" git -C "$APP_DIR" log --oneline -1

  log "Environment"
  write_env

  log "Dependencies"
  sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && npm ci --no-audit --no-fund"

  log "Database migrations"
  sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && npx drizzle-kit migrate"

  log "Build"
  sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && npm run build"

  log "Start"
  sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && APP_PORT=$APP_PORT pm2 startOrReload deploy/ecosystem.config.cjs --update-env && pm2 save"
  # Restart PM2 (and the app) after a reboot.
  env PATH="$PATH" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" >/dev/null

  log "Smoke test"
  sleep 5
  curl -s -o /dev/null -w "GET / -> %{http_code} in %{time_total}s\n" "http://127.0.0.1:$APP_PORT/" || true
  curl -s -o /dev/null -w "GET /corporate -> %{http_code} in %{time_total}s\n" "http://127.0.0.1:$APP_PORT/corporate" || true
}

case "${1:-}" in
  inspect) inspect ;;
  install) install ;;
  app) app ;;
  *) echo "usage: sudo bash $0 inspect|install|app"; exit 1 ;;
esac
