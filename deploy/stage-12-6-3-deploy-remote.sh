#!/usr/bin/env bash
# Stage 12.6.3 — Production hardening deploy
set -euo pipefail

APP_DIR="/var/www/crm-al-tokens"
STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP_APP="/var/backups/crm-al-tokens-pre-stage12-6-3-${STAMP}"
TARBALL="${1:-/tmp/stage-12-6-3-deploy.tgz}"
PORT="${PORT:-3075}"

echo "==> Backup app"
mkdir -p /var/backups
cp -a "$APP_DIR" "$BACKUP_APP"
echo "APP_BACKUP=$BACKUP_APP"

echo "==> Preserve .env"
cp "$APP_DIR/apps/api/.env" /tmp/crm-al-api.env.bak

echo "==> Extract tarball"
cd "$APP_DIR"
tar -xzf "$TARBALL"
cp /tmp/crm-al-api.env.bak "$APP_DIR/apps/api/.env"

echo "==> npm install"
cd "$APP_DIR"
npm install

echo "==> Build API"
cd "$APP_DIR/apps/api"
if NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3072}" npx nest build; then
  echo "API build OK on server"
else
  echo "WARN: nest build failed (OOM?) — upload pre-built dist from CI/local:"
  echo "  tar -czf crm-api-dist.tgz dist && scp crm-api-dist.tgz root@HOST:/tmp/"
  echo "  ssh root@HOST 'cd $APP_DIR/apps/api && rm -rf dist && tar -xzf /tmp/crm-api-dist.tgz'"
  if [[ ! -f "$APP_DIR/apps/api/dist/src/main.js" ]]; then
    echo "ERROR: dist/src/main.js missing — aborting before PM2 restart"
    exit 1
  fi
fi

echo "==> Build Web"
cd "$APP_DIR/apps/web"
npx vite build

echo "==> Verify dist markers"
grep -q 'buildSmtpTransportOptions' "$APP_DIR/apps/api/dist/src/common/utils/smtp-transport.util.js" || {
  echo "ERROR: smtp transport util missing"
  exit 1
}
grep -q 'sendTelegramAlert' "$APP_DIR/apps/api/dist/src/system-settings/system-integrations.service.js" || {
  echo "ERROR: telegram alerts missing"
  exit 1
}

JS=$(grep -o 'index-[^"]*\.js' "$APP_DIR/apps/web/dist/index.html" | head -1)
grep -q 'platform billing settings' "$APP_DIR/apps/web/dist/assets/$JS" || {
  echo "ERROR: billing UX cleanup missing in web bundle"
  exit 1
}

echo "==> prisma generate"
cd "$APP_DIR/apps/api"
npx prisma generate

echo "==> PM2 restart"
cd "$APP_DIR"
pm2 startOrRestart deploy/ecosystem.config.cjs --update-env
pm2 save
sleep 12

pm2 status | grep crm-al || pm2 status
curl -sf "http://127.0.0.1:${PORT}/api/health" | head -c 120
echo ""
echo "==> Stage 12.6.3 deploy complete"
