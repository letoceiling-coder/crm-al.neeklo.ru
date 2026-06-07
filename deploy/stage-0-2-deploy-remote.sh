#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/crm-al-tokens"
BACKUP="/var/backups/crm-al-tokens-pre-stage0-$(date +%Y%m%d%H%M%S)"

echo "==> Backup current deployment"
mkdir -p /var/backups
cp -a "$APP_DIR" "$BACKUP"
echo "Backup: $BACKUP"

echo "==> Preserve production .env"
cp "$APP_DIR/apps/api/.env" /tmp/crm-al-api.env.bak

echo "==> Extract Stage 0 tarball"
cd "$APP_DIR"
tar -xzf /tmp/stage0-deploy.tgz

echo "==> Restore .env"
cp /tmp/crm-al-api.env.bak "$APP_DIR/apps/api/.env"

echo "==> Append Stage 0 env vars if missing"
ENV_FILE="$APP_DIR/apps/api/.env"
touch "$ENV_FILE"

append_if_missing() {
  local key="$1"
  local val="$2"
  if ! grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

SECRET_KEY=$(openssl rand -hex 32)
append_if_missing "SECRET_ENCRYPTION_KEY" "$SECRET_KEY"
append_if_missing "PARSER_BASE_URL" "https://pars-site.neeklo.ru"
append_if_missing "PARSER_API_KEY" "a2a180ed0a2fbf0e78a8d0f9d289dc25327c609554781ae995a85da5a53de8bd"
append_if_missing "PARSER_DEFAULT_TIMEOUT_MS" "120000"
append_if_missing "PARSER_POLL_INTERVAL_MS" "4000"
append_if_missing "PARSER_MAX_POLL_MS" "600000"
append_if_missing "PARSER_MAX_RETRIES" "2"
append_if_missing "S3_ENDPOINT" "https://s3.ru-3.storage.selcloud.ru"
append_if_missing "S3_REGION" "ru-3"
append_if_missing "S3_BUCKET" "crm-al-knowledge"
append_if_missing "BULL_BOARD_PATH" "/admin/queues"

echo "Migration folders: $(ls -1 apps/api/prisma/migrations | wc -l)"

echo "==> npm install"
cd "$APP_DIR"
npm install
npm install @nestjs/platform-express --workspace=apps/api 2>/dev/null || true

echo "==> prisma generate"
npm run db:generate

echo "==> pgvector pre-check"
docker exec crm-al-tokens-postgres psql -U crm_al_gateway -d crm_al_gateway -c "CREATE EXTENSION IF NOT EXISTS vector;" || {
  echo "pgvector install fallback: compile in container"
  docker exec crm-al-tokens-postgres sh -c '
    apk add --no-cache git build-base postgresql16-dev clang llvm19-dev 2>/dev/null || apk add --no-cache git build-base clang llvm-dev
    cd /tmp
    rm -rf pgvector
    git clone --depth 1 --branch v0.8.0 https://github.com/pgvector/pgvector.git
    cd pgvector
    make OPTFLAGS="" && make install
  '
  docker restart crm-al-tokens-postgres
  sleep 5
  docker exec crm-al-tokens-postgres psql -U crm_al_gateway -d crm_al_gateway -c "CREATE EXTENSION IF NOT EXISTS vector;"
}

docker exec crm-al-tokens-postgres psql -U crm_al_gateway -d crm_al_gateway -c "SELECT extname, extversion FROM pg_extension WHERE extname='vector';"

echo "==> prisma migrate deploy"
cd "$APP_DIR/apps/api"
npx prisma migrate deploy

echo "==> seed"
cd "$APP_DIR"
export $(grep -v '^#' apps/api/.env | xargs)
npm run db:seed

echo "==> build API"
npm run build --workspace=apps/api

echo "==> PM2 restart"
pm2 restart crm-al-tokens-api || pm2 start "$APP_DIR/deploy/ecosystem.config.cjs"
pm2 save

sleep 4
curl -s "http://127.0.0.1:3075/api/health" | head -c 2000
echo

echo "==> Deploy complete"
