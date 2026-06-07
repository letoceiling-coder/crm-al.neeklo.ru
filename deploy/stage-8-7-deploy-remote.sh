#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/crm-al-tokens"
BACKUP="/var/backups/crm-al-tokens-pre-stage8-7-$(date +%Y%m%d%H%M%S)"
PORT="${PORT:-3075}"

echo "==> Backup"
mkdir -p /var/backups
cp -a "$APP_DIR" "$BACKUP"
echo "Backup: $BACKUP"

echo "==> Preserve .env"
cp "$APP_DIR/apps/api/.env" /tmp/crm-al-api.env.bak

echo "==> Extract tarball"
cd "$APP_DIR"
tar -xzf /tmp/stage-8-7-deploy.tgz
cp /tmp/crm-al-api.env.bak "$APP_DIR/apps/api/.env"

echo "==> npm install"
cd "$APP_DIR"
npm install

echo "==> prisma generate + migrate deploy"
npm run db:generate
cd "$APP_DIR/apps/api"
npx prisma migrate deploy

echo "==> seed"
cd "$APP_DIR"
npm run db:seed || echo "WARN: seed returned non-zero (may be idempotent partial)"

echo "==> build api + web"
npm run build --workspace=apps/api
npm run build --workspace=apps/web

echo "==> pm2 restart"
pm2 restart crm-al-tokens-api --update-env
pm2 save

sleep 6

echo "==> migration count"
MIG_DISK=$(ls -1 "$APP_DIR/apps/api/prisma/migrations" | wc -l)
echo "migrations_on_disk=$MIG_DISK"
npx prisma migrate status 2>&1 | tail -5

echo "==> verify routes"
for path in \
  /api/health \
  /api/docs \
  /api/v1/assistants \
  /api/v1/knowledge-bases \
  /api/v1/crm/clients \
  /api/v1/workflows \
  /api/v1/memory/profiles \
  /api/v1/integrations/providers \
  /api/v1/workflows/templates; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 15 "http://127.0.0.1:${PORT}${path}")
  echo "${path} => ${code}"
done

echo "==> Done Stage 8.7 deploy"
