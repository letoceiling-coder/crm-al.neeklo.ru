#!/usr/bin/env bash
# Stage 12.6.2 — Deploy API + Web (includes 12.6.1 fixes)
set -euo pipefail

APP_DIR="/var/www/crm-al-tokens"
STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP_APP="/var/backups/crm-al-tokens-pre-stage12-6-2-${STAMP}"
TARBALL="${1:-/tmp/stage-12-6-2-deploy.tgz}"
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

echo "==> npm install (with devDependencies for build)"
cd "$APP_DIR"
npm install

echo "==> Build API"
cd "$APP_DIR/apps/api"
npx nest build || { echo "ERROR: API build failed"; exit 1; }

echo "==> Build Web"
cd "$APP_DIR/apps/web"
npx vite build || { echo "ERROR: Web build failed"; exit 1; }

echo "==> Verify dist markers"
grep -q 'MinLength' "$APP_DIR/apps/api/dist/src/knowledge/dto/knowledge-taxonomy.dto.js" || {
  echo "ERROR: taxonomy dto still old"
  exit 1
}
if grep -q 'IsUUID' "$APP_DIR/apps/api/dist/src/knowledge/dto/knowledge-taxonomy.dto.js" 2>/dev/null; then
  if grep -q 'ListTaxonomyQueryDto' "$APP_DIR/apps/api/dist/src/knowledge/dto/knowledge-taxonomy.dto.js" && \
     grep -A2 'ListTaxonomyQueryDto.prototype, "knowledgeBaseId"' "$APP_DIR/apps/api/dist/src/knowledge/dto/knowledge-taxonomy.dto.js" | grep -q IsUUID; then
    echo "ERROR: ListTaxonomyQueryDto still uses IsUUID"
    exit 1
  fi
fi

JS=$(grep -o 'index-[^"]*\.js' "$APP_DIR/apps/web/dist/index.html" | head -1)
grep -q 'Create Test Payment' "$APP_DIR/apps/web/dist/assets/$JS" || {
  echo "ERROR: web bundle missing Create Test Payment"
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
echo "==> Stage 12.6.2 deploy complete"
