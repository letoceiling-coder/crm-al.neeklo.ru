#!/bin/bash
# Stage 12.9: Deploy KB customer-ready changes to production
# Runs: auto-taxonomy, history tab, AI analysis endpoint, document status
set -e

APP_DIR=/var/www/crm-al-tokens
API_DIR=$APP_DIR/apps/api

echo "=== Stage 12.9 Deploy ==="

# 1. Pull latest code
cd $APP_DIR
git pull origin main

# 2. Install API dependencies
cd $API_DIR
npm install --legacy-peer-deps

# 3. Run Prisma migration (creates knowledge_history_events table)
npx prisma migrate deploy

# 4. Regenerate Prisma client
npx prisma generate

# 5. Build API
cd $APP_DIR
npm run build --workspace=apps/api

# 6. Build Web
npm run build --workspace=apps/web

# 7. Restart API workers
pm2 restart crm-al-api --update-env
pm2 restart crm-al-worker --update-env 2>/dev/null || true

# 8. Reload nginx for web
cp -r apps/web/dist/* /var/www/crm-al-web/ 2>/dev/null || true

echo "=== Deploy complete ==="
pm2 status
