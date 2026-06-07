#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/crm-al-tokens"
BACKUP="/var/backups/crm-al-tokens-pre-stage1a-$(date +%Y%m%d%H%M%S)"

echo "==> Backup"
mkdir -p /var/backups
cp -a "$APP_DIR" "$BACKUP"
echo "Backup: $BACKUP"

echo "==> Preserve .env"
cp "$APP_DIR/apps/api/.env" /tmp/crm-al-api.env.bak

echo "==> Extract tarball"
cd "$APP_DIR"
tar -xzf /tmp/stage1a-deploy.tgz
cp /tmp/crm-al-api.env.bak "$APP_DIR/apps/api/.env"

echo "==> npm install"
cd "$APP_DIR"
npm install

echo "==> prisma generate + migrate"
npm run db:generate
cd "$APP_DIR/apps/api"
npx prisma migrate deploy

echo "==> seed"
cd "$APP_DIR"
npm run db:seed

echo "==> build api + web"
npm run build --workspace=apps/api
npm run build --workspace=apps/web

echo "==> pm2 restart"
pm2 restart crm-al-tokens-api --update-env
pm2 save

sleep 4

echo "==> verify"
curl -s -o /dev/null -w "docs:%{http_code}\n" http://127.0.0.1:3075/api/docs
curl -s -o /dev/null -w "docs-json:%{http_code}\n" http://127.0.0.1:3075/api/docs-json
echo "templates (no auth):"
curl -s -o /dev/null -w "templates:%{http_code}\n" http://127.0.0.1:3075/api/v1/assistants/templates

echo "==> Done"
