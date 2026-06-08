#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/crm-al-tokens"
STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP_APP="/var/backups/crm-al-tokens-pre-stage10-1-${STAMP}"
BACKUP_DB="/var/backups/crm-al-gateway-db-pre-stage10-1-${STAMP}.sql"
BACKUP_PM2="/var/backups/pm2-dump-pre-stage10-1-${STAMP}.json"
BACKUP_NGINX="/var/backups/nginx-crm-al-pre-stage10-1-${STAMP}.conf"
PORT="${PORT:-3075}"
TARBALL="${1:-/tmp/stage-10-1-deploy.tgz}"

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
  cp /etc/nginx/sites-enabled/crm-al.neeklo.ru.conf "$BACKUP_NGINX" 2>/dev/null || \
  echo "NGINX_BACKUP=skipped"
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

echo "==> prisma generate + migrate deploy"
npm run db:generate
cd "$APP_DIR/apps/api"
npx prisma migrate deploy

echo "==> Verify dist"
test -f "$APP_DIR/apps/api/dist/src/main.js" || { echo "ERROR: missing main.js"; exit 1; }
test -f "$APP_DIR/apps/api/dist/src/worker.js" || { echo "ERROR: missing worker.js"; exit 1; }
test -f "$APP_DIR/apps/web/dist/index.html" || { echo "ERROR: missing web dist"; exit 1; }

echo "==> PM2 Enterprise Mode (6 processes)"
cd "$APP_DIR"
pm2 delete crm-al-worker-knowledge crm-al-worker-workflow crm-al-worker-memory \
  crm-al-worker-integrations crm-al-worker-tools 2>/dev/null || true
pm2 startOrRestart deploy/ecosystem.config.cjs --update-env
pm2 save

sleep 12

echo "==> PM2 status"
pm2 status | grep -E 'crm-al-tokens-api|crm-al-worker' || pm2 status

MIG_DISK=$(ls -1 "$APP_DIR/apps/api/prisma/migrations" | wc -l)
echo "migrations_on_disk=$MIG_DISK"
npx prisma migrate status 2>&1 | tail -10

echo "==> Route verification"
for path in \
  /api/health \
  /api/docs \
  /api/v1/system/queues \
  /api/v1/marketplace/categories; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 15 "http://127.0.0.1:${PORT}${path}")
  echo "${path} => ${code}"
done

echo "BACKUPS:"
echo "  APP=$BACKUP_APP"
echo "  DB=$BACKUP_DB"
echo "  PM2=$BACKUP_PM2"
echo "  NGINX=$BACKUP_NGINX"
echo "==> Done Stage 10.1 deploy"
