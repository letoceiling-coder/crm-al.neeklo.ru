#!/usr/bin/env bash
set -uo pipefail

API_DIR="/var/www/crm-al-tokens/apps/api"
REPORT="/tmp/stage-8-6-audit.log"
: > "$REPORT"

log() { echo "$*" | tee -a "$REPORT"; }

log "=== STAGE 8.6 PRODUCTION PARITY AUDIT ==="
log "Host: $(hostname)"
log "Date: $(date -Iseconds)"

log ""
log "--- GIT ---"
if [ -d /var/www/crm-al-tokens/.git ]; then
  cd /var/www/crm-al-tokens
  log "branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
  log "commit: $(git log -1 --format='%H %s' 2>/dev/null)"
  git branch -a 2>/dev/null | tee -a "$REPORT"
else
  log "git: NOT A REPOSITORY (tarball deploy)"
fi

log ""
log "--- PRISMA MIGRATIONS ON DISK ---"
MIG_DISK=$(ls -1 "$API_DIR/prisma/migrations" 2>/dev/null | wc -l)
log "count: $MIG_DISK"
log "last: $(ls -1 "$API_DIR/prisma/migrations" 2>/dev/null | tail -3 | tr '\n' ' ')"

cd "$API_DIR" || exit 1
set -a; source .env; set +a
DBURL="${DATABASE_URL//\?schema=public/}"

log ""
log "--- PRISMA MIGRATE STATUS ---"
npx prisma migrate status 2>&1 | tee -a "$REPORT"

log ""
log "--- APPLIED MIGRATIONS IN DB ---"
psql "$DBURL" -t -A -c "SELECT count(*) FROM _prisma_migrations;" 2>&1 | tee -a "$REPORT"
psql "$DBURL" -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 12;" 2>&1 | tee -a "$REPORT"

log ""
log "--- M8_5 CHECK ---"
for m in 20250609185000_m8_5_0_workflow_hardening 20250609186000_m8_5_1_workflow_templates; do
  C=$(psql "$DBURL" -t -A -c "SELECT count(*) FROM _prisma_migrations WHERE migration_name='$m';" 2>/dev/null || echo 0)
  log "$m applied=$C"
done

log ""
log "--- TABLES ---"
for tbl in organizations knowledge_bases knowledge_sources knowledge_documents knowledge_chunks memory_profiles workflows workflow_templates integration_accounts conversations messages crm_clients crm_leads; do
  EXISTS=$(psql "$DBURL" -t -A -c "SELECT to_regclass('public.$tbl');" 2>/dev/null)
  log "$tbl => ${EXISTS:-null}"
done

log ""
log "--- PM2 ---"
pm2 list 2>&1 | grep -E "crm-al|knowledge|workflow|ingest|memory" | tee -a "$REPORT" || true
pm2 describe crm-al-tokens-api 2>&1 | tee -a "$REPORT" | tail -20

log ""
log "--- REDIS / QUEUES ---"
PORT="${PORT:-3075}"
curl -s -m 10 "http://127.0.0.1:${PORT}/api/health" 2>&1 | tee -a "$REPORT"
log ""
curl -s -m 10 "http://127.0.0.1:${PORT}/api/health/queues" 2>&1 | tee -a "$REPORT"

log ""
log "--- API ROUTES ---"
for path in /api/health /api/docs /api/v1/assistants /api/v1/workflows /api/v1/memory/profiles /api/v1/crm/clients /api/v1/knowledge-bases /api/v1/integrations/providers /api/v1/workflows/templates /api/v1/workflows/metrics; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "http://127.0.0.1:${PORT}${path}")
  log "$path => $CODE"
done

log ""
log "--- WEB STATIC ---"
WEB="/var/www/crm-al-tokens/apps/web/dist"
if [ -d "$WEB" ]; then
  JS=$(ls -1 "$WEB/assets"/index-*.js 2>/dev/null | head -1)
  log "bundle: $JS"
  for label in "AI Ассистенты" "Базы знаний" "Инструменты" "CRM" "Память" "Автomatизация" "Интеграции" "Сообщения" "Автоматизация"; do
    if grep -q "$label" "$JS" 2>/dev/null; then log "menu $label: FOUND"; else log "menu $label: MISSING"; fi
  done
else
  log "web dist: MISSING"
fi

log ""
log "=== AUDIT COMPLETE ==="
