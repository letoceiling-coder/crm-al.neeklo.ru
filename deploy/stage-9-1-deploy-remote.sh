#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/crm-al-tokens"
BACKUP="/var/backups/crm-al-tokens-pre-stage9-1-$(date +%Y%m%d%H%M%S)"
PORT="${PORT:-3075}"
TARBALL="${1:-/tmp/stage-9-1-deploy.tgz}"

echo "==> Backup"
mkdir -p /var/backups
cp -a "$APP_DIR" "$BACKUP"
echo "Backup: $BACKUP"

echo "==> Preserve .env"
cp "$APP_DIR/apps/api/.env" /tmp/crm-al-api.env.bak

echo "==> Extract tarball"
cd "$APP_DIR"
tar -xzf "$TARBALL"
cp /tmp/crm-al-api.env.bak "$APP_DIR/apps/api/.env"

echo "==> npm install (root)"
cd "$APP_DIR"
npm install --omit=dev 2>/dev/null || npm install

echo "==> prisma generate + migrate deploy"
npm run db:generate
cd "$APP_DIR/apps/api"
npx prisma migrate deploy

echo "==> Skip server build — using prebuilt dist from tarball"
test -f "$APP_DIR/apps/api/dist/src/main.js" || { echo "ERROR: missing API dist"; exit 1; }
test -f "$APP_DIR/apps/web/dist/index.html" || { echo "ERROR: missing web dist"; exit 1; }

echo "==> pm2 restart"
pm2 restart crm-al-tokens-api --update-env
pm2 save

sleep 8

echo "==> migration count"
MIG_DISK=$(ls -1 "$APP_DIR/apps/api/prisma/migrations" | wc -l)
echo "migrations_on_disk=$MIG_DISK"
npx prisma migrate status 2>&1 | tail -8

echo "==> verify routes"
for path in \
  /api/health \
  /api/docs \
  /api/v1/marketplace/packages \
  /api/v1/marketplace/categories \
  /api/v1/marketplace/featured \
  /api/v1/marketplace/installed; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 15 "http://127.0.0.1:${PORT}${path}")
  echo "${path} => ${code}"
done

echo "==> Done Stage 9.1 deploy"
