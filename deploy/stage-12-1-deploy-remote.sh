#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/crm-al-tokens"
STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP_APP="/var/backups/crm-al-tokens-pre-stage12-1-${STAMP}"
BACKUP_DB="/var/backups/crm-al-gateway-db-pre-stage12-1-${STAMP}.sql"
BACKUP_PM2="/var/backups/pm2-dump-pre-stage12-1-${STAMP}.json"
BACKUP_NGINX="/var/backups/nginx-crm-al-pre-stage12-1-${STAMP}.conf"
PORT="${PORT:-3075}"
TARBALL="${1:-/tmp/stage-12-1-deploy.tgz}"

echo "==> Phase 3 Backups"
mkdir -p /var/backups
cp -a "$APP_DIR" "$BACKUP_APP"
echo "APP_BACKUP=$BACKUP_APP"

docker exec crm-al-tokens-postgres pg_dump -U crm_al_gateway crm_al_gateway > "$BACKUP_DB"
echo "DB_BACKUP=$BACKUP_DB"

pm2 save
cp /root/.pm2/dump.pm2 "$BACKUP_PM2" 2>/dev/null || pm2 jlist > "$BACKUP_PM2"
echo "PM2_BACKUP=$BACKUP_PM2"

cp /etc/nginx/sites-available/crm-al.neeklo.ru.conf "$BACKUP_NGINX" 2>/dev/null || \
  cp /etc/nginx/sites-enabled/crm-al.neeklo.ru.conf "$BACKUP_NGINX" 2>/dev/null || true
echo "NGINX_BACKUP=$BACKUP_NGINX"

echo "==> Preserve .env"
cp "$APP_DIR/apps/api/.env" /tmp/crm-al-api.env.bak

echo "==> Extract tarball"
cd "$APP_DIR"
tar -xzf "$TARBALL"
cp /tmp/crm-al-api.env.bak "$APP_DIR/apps/api/.env"

ENV_FILE="$APP_DIR/apps/api/.env"
append_if_missing() {
  local key="$1" val="$2"
  if ! grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    echo "${key}=${val}" >> "$ENV_FILE"
    echo "APPENDED $key"
  fi
}
append_if_missing "APP_PUBLIC_URL" "https://crm-al.neeklo.ru"
append_if_missing "PAYMENT_MOCK_MODE" "true"
append_if_missing "REGISTRATION_ENABLED" "false"

echo "==> npm install"
cd "$APP_DIR"
npm install --omit=dev 2>/dev/null || npm install

echo "==> prisma generate + migrate deploy"
npm run db:generate
cd "$APP_DIR/apps/api"
npx prisma migrate deploy

MIG_COUNT=$(docker exec crm-al-tokens-postgres psql -U crm_al_gateway -d crm_al_gateway -tAc "SELECT COUNT(1) FROM _prisma_migrations")
echo "migrations_applied=$MIG_COUNT"

echo "==> Verify dist"
test -f "$APP_DIR/apps/api/dist/src/main.js" || { echo "ERROR: missing main.js"; exit 1; }
test -f "$APP_DIR/apps/web/dist/index.html" || { echo "ERROR: missing web dist"; exit 1; }

echo "==> PM2 restart"
cd "$APP_DIR"
pm2 startOrRestart deploy/ecosystem.config.cjs --update-env
pm2 save

sleep 12
pm2 status | grep crm-al || pm2 status

echo "==> Health"
curl -sf "http://127.0.0.1:${PORT}/api/health" | head -c 200
echo ""
curl -s -o /dev/null -w "docs=%{http_code}\n" "http://127.0.0.1:${PORT}/api/docs"

echo "BACKUPS:"
echo "  APP=$BACKUP_APP"
echo "  DB=$BACKUP_DB"
echo "  PM2=$BACKUP_PM2"
echo "  NGINX=$BACKUP_NGINX"
echo "==> Done Stage 12.1 deploy"
