#!/bin/bash
set -euo pipefail

DOMAIN="crm-al.neeklo.ru"
APP_DIR="/var/www/crm-al-tokens"
NGINX_AVAILABLE="/etc/nginx/sites-available/${DOMAIN}.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/${DOMAIN}.conf"
API_PORT=3075

echo "==> Deploying ${DOMAIN} to ${APP_DIR}"

cd "$APP_DIR"

echo "==> Starting isolated Postgres + Redis"
docker compose -f docker-compose.prod.yml up -d

echo "==> Installing dependencies"
npm install
npm install @nestjs/platform-express --workspace=apps/api

echo "==> Generating Prisma client"
npm run db:generate

echo "==> Running migrations"
cd apps/api
if [ -d prisma/migrations ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  npx prisma migrate deploy
else
  npx prisma db push
fi
cd "$APP_DIR"

echo "==> Seeding database"
npm run db:seed || true

echo "==> Building API"
npm run build --workspace=apps/api

echo "==> Building frontend"
npm run build --workspace=apps/web

echo "==> PM2 restart API"
pm2 delete crm-al-tokens-api 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save

echo "==> Nginx config (isolated, no other sites touched)"
if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  echo "==> HTTP-only bootstrap for certbot"
  cp deploy/nginx.crm-al.neeklo.ru.http.conf "$NGINX_AVAILABLE"
  ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
  nginx -t && systemctl reload nginx

  echo "==> Issuing SSL certificate for ${DOMAIN} only"
  certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" --cert-name "$DOMAIN" --non-interactive --agree-tos -m admin@neeklo.ru
fi

cp deploy/nginx.crm-al.neeklo.ru.conf "$NGINX_AVAILABLE"
ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"

echo "==> Testing nginx"
nginx -t

echo "==> Reloading nginx"
systemctl reload nginx

echo "==> Health check"
sleep 3
curl -sf "http://127.0.0.1:${API_PORT}/api/auth/login" -X POST -H 'Content-Type: application/json' -d '{}' >/dev/null 2>&1 && echo "API responds" || echo "API starting..."

echo "==> Done! https://${DOMAIN}"
