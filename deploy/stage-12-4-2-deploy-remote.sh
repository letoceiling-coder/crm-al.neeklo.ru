#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/crm-al-tokens"
STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP_APP="/var/backups/crm-al-tokens-pre-stage12-4-2-${STAMP}"
BACKUP_DB="/var/backups/crm-al-gateway-db-pre-stage12-4-2-${STAMP}.sql"
BACKUP_PM2="/var/backups/pm2-dump-pre-stage12-4-2-${STAMP}.json"
BACKUP_NGINX="/var/backups/nginx-crm-al-pre-stage12-4-2-${STAMP}.conf"
PORT="${PORT:-3075}"
TARBALL="${1:-/tmp/stage-12-4-2-deploy.tgz}"

echo "==> Phase 2 Backups"
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

echo "==> npm install"
cd "$APP_DIR"
npm install --omit=dev 2>/dev/null || npm install

echo "==> Pre-migrate: fix orphan system_settings if M12_4 not applied"
M12_4=$(docker exec crm-al-tokens-postgres psql -U crm_al_gateway -d crm_al_gateway -tAc \
  "SELECT COUNT(1) FROM _prisma_migrations WHERE migration_name LIKE '%m12_4%';")
if [ "${M12_4:-0}" = "0" ]; then
  docker exec crm-al-tokens-postgres psql -U crm_al_gateway -d crm_al_gateway -c \
    "DROP TABLE IF EXISTS system_settings CASCADE;" || true
fi

echo "==> prisma generate + migrate deploy"
npm run db:generate
cd "$APP_DIR/apps/api"
npx prisma migrate deploy

MIG_COUNT=$(docker exec crm-al-tokens-postgres psql -U crm_al_gateway -d crm_al_gateway -tAc "SELECT COUNT(1) FROM _prisma_migrations")
SETTINGS_COUNT=$(docker exec crm-al-tokens-postgres psql -U crm_al_gateway -d crm_al_gateway -tAc "SELECT COUNT(1) FROM system_settings")
echo "migrations_applied=$MIG_COUNT system_settings_rows=$SETTINGS_COUNT"

echo "==> Verify dist"
test -f "$APP_DIR/apps/api/dist/src/main.js" || { echo "ERROR: missing main.js"; exit 1; }
test -d "$APP_DIR/apps/api/dist/src/system-settings" || { echo "ERROR: missing system-settings dist"; exit 1; }
test -f "$APP_DIR/apps/web/dist/index.html" || { echo "ERROR: missing web dist"; exit 1; }

echo "==> PM2 restart"
cd "$APP_DIR"
pm2 startOrRestart deploy/ecosystem.config.cjs --update-env
pm2 save

sleep 15
pm2 status | grep crm-al || pm2 status

echo "==> Health"
curl -sf "http://127.0.0.1:${PORT}/api/health" | head -c 200
echo ""
curl -s -o /dev/null -w "settings_general=%{http_code}\n" "http://127.0.0.1:${PORT}/api/v1/system/settings/general"

echo "BACKUPS:"
echo "  APP=$BACKUP_APP"
echo "  DB=$BACKUP_DB"
echo "  PM2=$BACKUP_PM2"
echo "  NGINX=$BACKUP_NGINX"
echo "==> Done Stage 12.4.2 deploy"
