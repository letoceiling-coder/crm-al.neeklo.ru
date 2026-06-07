#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/crm-al-tokens"
cd "$APP_DIR/apps/api"

echo "==> Resolve failed m0_8 migration"
npx prisma migrate resolve --rolled-back 20250607103000_m0_8_pgvector_embedding_foundation

echo "==> Drop partial m0_8 objects if any"
docker exec crm-al-tokens-postgres psql -U crm_al_gateway -d crm_al_gateway -c "
DROP TABLE IF EXISTS knowledge_embeddings CASCADE;
DROP TABLE IF EXISTS embedding_profiles CASCADE;
"

echo "==> Re-apply migrations"
npx prisma migrate deploy

echo "==> S3 env from gpt.neeklo.ru (shared Selectel account)"
ENV_FILE="$APP_DIR/apps/api/.env"
GPT_ENV="/var/www/gpt.neeklo.ru/.env.production"
set_kv() {
  local k="$1" v="$2"
  if grep -q "^${k}=" "$ENV_FILE"; then
    sed -i "s|^${k}=.*|${k}=${v}|" "$ENV_FILE"
  else
    echo "${k}=${v}" >> "$ENV_FILE"
  fi
}
S3_ACCESS=$(grep '^S3_ACCESS_KEY=' "$GPT_ENV" | cut -d= -f2-)
S3_SECRET=$(grep '^S3_SECRET_KEY=' "$GPT_ENV" | cut -d= -f2-)
set_kv S3_ENDPOINT "https://s3.ru-3.storage.selcloud.ru"
set_kv S3_REGION "ru-3"
set_kv S3_BUCKET "crm-al-knowledge"
set_kv S3_ACCESS_KEY "$S3_ACCESS"
set_kv S3_SECRET_KEY "$S3_SECRET"

echo "==> seed"
cd "$APP_DIR"
set -a; source apps/api/.env; set +a
npm run db:seed

echo "==> build"
npm run build --workspace=apps/api

echo "==> pm2 restart"
pm2 restart crm-al-tokens-api
pm2 save
sleep 5

echo "==> health"
curl -s http://127.0.0.1:3075/api/health
