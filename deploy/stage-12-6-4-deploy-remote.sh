#!/usr/bin/env bash
set -euo pipefail
APP=/var/www/crm-al-tokens
set -a
source "$APP/apps/api/.env"
set +a
cd "$APP/apps/api"
if ! psql "$DATABASE_URL" -tAc "SELECT 1 FROM information_schema.tables WHERE table_name='telegram_users'" | grep -q 1; then
  echo "==> Applying migration"
  psql "$DATABASE_URL" -f /tmp/m12_6_4_telegram.sql
else
  echo "==> Migration already applied"
fi
rm -rf dist
tar -xzf /tmp/crm-api-dist-12-6-4.tgz
npx prisma generate
cd "$APP/apps/web"
rm -rf dist
tar -xzf /tmp/crm-web-dist-12-6-4.tgz
grep -q "telegram/settings" "$APP/apps/web/dist/assets/"*.js && echo "Web bundle OK"
cd "$APP"
pm2 restart crm-al-tokens-api crm-al-worker-knowledge crm-al-worker-workflow crm-al-worker-memory crm-al-worker-integrations crm-al-worker-tools
sleep 10
curl -sf http://127.0.0.1:3075/api/health | head -c 120
echo ""
pm2 status | grep crm-al
