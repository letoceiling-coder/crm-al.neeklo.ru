#!/usr/bin/env bash
set -uo pipefail

API_DIR="/var/www/crm-al-tokens/apps/api"
PORT="${PORT:-3075}"
REPORT="/tmp/stage-8-7-parity-audit.log"
: > "$REPORT"

log() { echo "$*" | tee -a "$REPORT"; }

log "=== STAGE 8.7 PARITY AUDIT ==="
log "Date: $(date -Iseconds)"

cd "$API_DIR" || exit 1
set -a; source .env; set +a
DBURL="${DATABASE_URL//\?schema=public/}"

log ""
log "--- MIGRATIONS ---"
DISK=$(ls -1 prisma/migrations | wc -l)
log "on_disk=$DISK"
npx prisma migrate status 2>&1 | tee -a "$REPORT"
DB_COUNT=$(psql "$DBURL" -t -A -c "SELECT count(*) FROM _prisma_migrations;" 2>/dev/null)
log "in_db=$DB_COUNT"

log ""
log "--- TABLES ---"
for tbl in knowledge_bases knowledge_sources knowledge_documents knowledge_chunks memory_profiles memory_entries crm_clients crm_leads crm_deals workflows workflow_templates integration_accounts conversations messages; do
  e=$(psql "$DBURL" -t -A -c "SELECT to_regclass('public.$tbl');" 2>/dev/null)
  log "$tbl => ${e:-null}"
done

log ""
log "--- PM2 ---"
pm2 list 2>&1 | grep crm-al | tee -a "$REPORT"

log ""
log "--- API ROUTES ---"
for path in /api/v1/knowledge-bases /api/v1/crm/clients /api/v1/workflows /api/v1/memory/profiles /api/v1/integrations/providers; do
  c=$(curl -s -o /dev/null -w "%{http_code}" -m 15 "http://127.0.0.1:${PORT}${path}")
  log "$path => $c"
done

log ""
log "--- WEB MENUS ---"
JS=$(ls -1 /var/www/crm-al-tokens/apps/web/dist/assets/index-*.js 2>/dev/null | head -1)
for label in "AI Ассистенты" "Базы знаний" "Инструменты" "CRM" "Память" "Автоматизация" "Интеграции" "Сообщения"; do
  if grep -q "$label" "$JS" 2>/dev/null; then log "menu $label: FOUND"; else log "menu $label: MISSING"; fi
done

log ""
log "=== END ==="
