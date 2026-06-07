#!/usr/bin/env bash
set -uo pipefail

API_DIR="/var/www/crm-al-tokens/apps/api"
REPORT="/tmp/stage-0-1-validation.log"
: > "$REPORT"

log() { echo "[$(date -Iseconds)] $*" | tee -a "$REPORT"; }
pass() { log "PASS: $*"; }
fail() { log "FAIL: $*"; }
warn() { log "WARN: $*"; }

log "=== STAGE 0.1 SERVER VALIDATION ==="
log "Host: $(hostname)"
log "API_DIR: $API_DIR"

cd "$API_DIR" || { fail "API dir missing"; exit 1; }

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  DBURL="${DATABASE_URL//\?schema=public/}"
else
  fail ".env missing"
  DBURL=""
fi

log "--- PostgreSQL ---"
if command -v psql >/dev/null 2>&1 && [ -n "$DBURL" ]; then
  PGVER=$(psql "$DBURL" -t -A -c "SELECT version();" 2>>"$REPORT") && pass "PostgreSQL: ${PGVER:0:80}..."
  VECTOR=$(psql "$DBURL" -t -A -c "SELECT extname FROM pg_extension WHERE extname='vector';" 2>>"$REPORT")
  if [ "$VECTOR" = "vector" ]; then pass "pgvector extension installed"; else fail "pgvector NOT installed"; fi

  log "Applied migrations:"
  psql "$DBURL" -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 12;" 2>>"$REPORT" | tee -a "$REPORT"

  for tbl in organizations organization_members plan_limits encrypted_secrets provider_accounts token_cost_snapshots embedding_profiles knowledge_embeddings; do
    EXISTS=$(psql "$DBURL" -t -A -c "SELECT to_regclass('public.$tbl');" 2>>"$REPORT")
    if [ -n "$EXISTS" ] && [ "$EXISTS" != "null" ]; then pass "table $tbl exists"; else fail "table $tbl MISSING"; fi
  done

  ORG_COL=$(psql "$DBURL" -t -A -c "SELECT column_name FROM information_schema.columns WHERE table_name='api_keys' AND column_name='organization_id';" 2>>"$REPORT")
  if [ "$ORG_COL" = "organization_id" ]; then pass "api_keys.organization_id column exists"; else fail "api_keys.organization_id MISSING"; fi
else
  fail "psql or DATABASE_URL unavailable"
fi

log "--- Prisma migrate status ---"
MIG_COUNT=$(ls -1 prisma/migrations 2>/dev/null | wc -l)
log "Migration folders on disk: $MIG_COUNT"
if [ "$MIG_COUNT" -ge 11 ]; then
  cd "$API_DIR" && npx prisma migrate status 2>&1 | tee -a "$REPORT" || fail "prisma migrate status failed"
else
  fail "Stage 0 migration files not deployed (expected >= 11, got $MIG_COUNT)"
fi

log "--- Redis ---"
REDIS_OK=0
if [ -n "${REDIS_URL:-}" ]; then
  node -e "
const Redis=require('ioredis');
const r=new Redis(process.env.REDIS_URL,{maxRetriesPerRequest:1,connectTimeout:5000});
r.ping().then(x=>{console.log(x);process.exit(0);}).catch(e=>{console.error(e.message);process.exit(1);});
" 2>&1 | tee -a "$REPORT" && REDIS_OK=1
else
  fail "REDIS_URL empty"
fi
[ "$REDIS_OK" = 1 ] && pass "Redis reachable" || fail "Redis unreachable"

log "--- API Health (localhost) ---"
PORT="${PORT:-3075}"
HEALTH=$(curl -s -m 10 "http://127.0.0.1:${PORT}/api/health" 2>&1) || HEALTH="curl failed"
log "GET http://127.0.0.1:${PORT}/api/health => $HEALTH"
echo "$HEALTH" | grep -q '"ok":true' && pass "local /api/health ok=true" || fail "local /api/health not green"

HEALTHQ=$(curl -s -m 10 "http://127.0.0.1:${PORT}/api/health/queues" 2>&1) || true
log "GET /api/health/queues => $HEALTHQ"

BULL=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "http://127.0.0.1:${PORT}/api/admin/queues" 2>&1)
log "GET /api/admin/queues HTTP $BULL"

log "--- Public domain ---"
PUB=$(curl -s -m 15 "https://crm-al.neeklo.ru/api/health" 2>&1) || PUB="failed"
log "GET https://crm-al.neeklo.ru/api/health => $PUB"

log "--- Parser (pars-site.neeklo.ru) ---"
PARSER_LOCAL=$(curl -s -m 5 "http://127.0.0.1:3180/health" 2>&1) || PARSER_LOCAL="failed"
log "Parser local :3180 => $PARSER_LOCAL"

PARSER_HEALTH=$(curl -s -m 20 "https://pars-site.neeklo.ru/health" 2>&1) || PARSER_HEALTH="failed"
log "Parser /health => $PARSER_HEALTH"
echo "$PARSER_HEALTH" | grep -q '"ok":true' && pass "Parser health ok" || fail "Parser health failed"

if [ -n "${PARSER_API_KEY:-}" ]; then
  PARSE=$(curl -s -m 120 -X POST "https://pars-site.neeklo.ru/v1/parse" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $PARSER_API_KEY" \
    -d '{"url":"https://sozd.duma.gov.ru","timeoutMs":90000,"mode":"standard"}' 2>&1) || PARSE="failed"
  log "Parser parse sozd.duma.gov.ru (truncated): ${PARSE:0:500}"
  echo "$PARSE" | grep -q '"ok":true' && pass "Parser ok=true" || fail "Parser ok!=true"
  echo "$PARSE" | grep -q '"okContent":true' && pass "Parser okContent=true" || fail "Parser okContent!=true"
else
  warn "PARSER_API_KEY not in .env — skip authenticated parse test"
fi

log "--- S3 configuration ---"
for v in S3_ENDPOINT S3_REGION S3_BUCKET S3_ACCESS_KEY S3_SECRET_KEY; do
  if [ -n "${!v:-}" ]; then pass "$v set"; else fail "$v NOT set"; fi
done

log "--- Seed data ---"
if command -v psql >/dev/null 2>&1 && [ -n "$DBURL" ]; then
  PA=$(psql "$DBURL" -t -A -c "SELECT count(*) FROM provider_accounts WHERE organization_id IS NULL AND is_default=true;" 2>>"$REPORT" || echo 0)
  log "Platform default provider_accounts: $PA"
  [ "${PA:-0}" -gt 0 ] && pass "Platform ProviderAccount seeded" || fail "Platform ProviderAccount NOT seeded"
  ES=$(psql "$DBURL" -t -A -c "SELECT count(*) FROM encrypted_secrets;" 2>>"$REPORT" || echo 0)
  log "encrypted_secrets count: $ES"
  [ "${ES:-0}" -gt 0 ] && pass "EncryptedSecret records exist" || fail "No EncryptedSecret records"
fi

log "=== VALIDATION COMPLETE — see $REPORT ==="
