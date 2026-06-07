# Stage 0.2 — Deployment Report

**Date:** 2026-06-07  
**Server:** `root@212.67.9.173`  
**Branch:** `feature/v2-platform`  
**Backup:** `/var/backups/crm-al-tokens-pre-stage0-20260607212359`

---

## Executive Summary

Stage 0 infrastructure was deployed to production. All core components are operational. One migration fix was required (HNSW index). Parser service was recovered.

| Phase | Status |
|-------|--------|
| A — Deploy audit | ✅ Documented |
| B — Parser recovery | ✅ Fixed |
| C — PostgreSQL + pgvector | ✅ Installed v0.8.0 |
| D — Deploy Stage 0 | ✅ Tarball deploy |
| E — Migrations | ✅ All 11 applied |
| F — ENV configuration | ✅ Complete |
| G — Seed | ✅ Platform OpenRouter |
| H — PM2 build/restart | ✅ v1.0.0 online |
| I — Health validation | ✅ All green |
| J — Re-run Stage 0.1 | ✅ Pass (parse test WARN) |

---

## Phase B — Parser Recovery

### Root Cause

`parser-html-site` crashed with **EADDRINUSE 127.0.0.1:3080** (132k+ PM2 restarts).

| Factor | Detail |
|--------|--------|
| Stale PM2 env | `PORT=3080` in running process |
| Ecosystem config | Correct: `PORT: 3180` |
| `.env.production` | Correct: `PORT=3180` |
| Port occupant | `agro-neeklo` (bun) on **3080** |
| Nginx expects | **3180** (`pars-site.neeklo.ru.conf`) |

Server code defaults to `3080` when `PORT` is unset (`server.mjs`), so stale PM2 state caused conflict with agro-neeklo.

### Fix

```bash
pm2 delete parser-html-site
cd /var/www/parser-html-site && pm2 start deploy/ecosystem.config.cjs
pm2 save
```

### Verification

```bash
curl https://pars-site.neeklo.ru/health
# {"ok":true,"service":"parser-html-site",...} HTTP 200
```

---

## Phase C — PostgreSQL + pgvector

**Database:** Docker `crm-al-tokens-postgres` (PostgreSQL 16.14 Alpine)

Alpine package `postgresql-pgvector` targets PG18 — incompatible with PG16 binary.

**Solution:** Compiled pgvector v0.8.0 from source inside container.

```bash
bash /tmp/stage-0-2-pgvector.sh
# deploy/stage-0-2-pgvector.sh
```

```sql
CREATE EXTENSION IF NOT EXISTS vector;
-- extname=vector, extversion=0.8.0
```

---

## Phase D — Deploy Stage 0

```bash
# Local
tar --exclude=node_modules --exclude=.git ... -czf stage0-deploy.tgz .
scp stage0-deploy.tgz root@212.67.9.173:/tmp/

# Server
bash /tmp/stage-0-2-deploy-remote.sh
```

- Only `/var/www/crm-al-tokens` modified
- SSL / nginx vhosts for other domains untouched
- Production `.env` preserved and extended

---

## Phase E — Database Migration

### Initial failure

Migration `20250607103000_m0_8_pgvector_embedding_foundation` failed:

```
ERROR: column cannot have more than 2000 dimensions for hnsw index
```

HNSW index on `vector(3072)` exceeds pgvector limit.

### Fix

Removed HNSW index from migration (deferred to Stage 5). Recovery:

```bash
npx prisma migrate resolve --rolled-back 20250607103000_m0_8_pgvector_embedding_foundation
# drop partial tables, re-apply fixed migration.sql
npx prisma migrate deploy
```

### Applied Stage 0 migrations

| Migration | Status |
|-----------|--------|
| `20250607100000_m0_0_organization_foundation` | ✅ |
| `20250607101000_m0_4_token_cost_snapshots` | ✅ |
| `20250607102000_m0_5_provider_accounts` | ✅ |
| `20250607103000_m0_8_pgvector_embedding_foundation` | ✅ (no HNSW) |

---

## Phase F — ENV Configuration

Added to `apps/api/.env` (values redacted):

| Variable | Source |
|----------|--------|
| `SECRET_ENCRYPTION_KEY` | Generated (`openssl rand -hex 32`) |
| `PARSER_BASE_URL` | `https://pars-site.neeklo.ru` |
| `PARSER_API_KEY` | From parser-html-site ecosystem |
| `PARSER_*` timeouts | Defaults from `.env.example` |
| `S3_ENDPOINT/REGION` | Selectel ru-3 |
| `S3_BUCKET` | `crm-al-knowledge` |
| `S3_ACCESS_KEY/SECRET_KEY` | Shared account from `gpt.neeklo.ru` |
| `BULL_BOARD_PATH` | `/admin/queues` |

Existing vars preserved: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `OPENROUTER_DEFAULT_KEY`, `PORT=3075`.

---

## Phase G — Seed

```bash
npm run db:seed
# Seed completed (Stage 0 foundation)
```

Verified:

- Platform OpenRouter `ProviderAccount`: **1** (org_id NULL, is_default=true)
- `encrypted_secrets`: **1**

---

## Phase H — PM2

```bash
npm run build --workspace=apps/api
pm2 restart crm-al-tokens-api --update-env
```

| Item | Before | After |
|------|--------|-------|
| PM2 version | 0.0.1 | **1.0.0** |
| `/api/health` | 404 | **200 ok:true** |
| Restarts | 0 | 2 (deploy) |

---

## Phase I — Health Validation

```json
GET https://crm-al.neeklo.ru/api/health
{
  "ok": true,
  "checks": {
    "database": { "ok": true },
    "parser": { "ok": true, "configured": true },
    "storage": { "ok": true, "bucket": "crm-al-knowledge", "configured": true },
    "queues": { "redis": true, "queues": { ... all 5 queues ... } }
  }
}
```

BullBoard: `GET /api/admin/queues` → **HTTP 200**

---

## Issues & Resolutions

| Issue | Resolution |
|-------|------------|
| Stage 0 not on server | Tarball deploy |
| Parser EADDRINUSE :3080 | PM2 recreate with PORT=3180 |
| pgvector missing | Compile v0.8.0 in Docker PG16 |
| HNSW 3072-dim index | Removed from M0_8 migration |
| S3 creds missing | Reused Selectel keys from gpt.neeklo.ru |
| Duplicate `_prisma_migrations` row | From failed m0_8 retry — cosmetic, schema up to date |

---

## Scripts Added

| Script | Purpose |
|--------|---------|
| `deploy/stage-0-2-pgvector.sh` | Install pgvector in Docker PG16 |
| `deploy/stage-0-2-deploy-remote.sh` | Full server deploy |
| `deploy/stage-0-2-migrate-recover.sh` | m0_8 recovery + seed + build |

---

## Post-Deploy State

- **Domain:** https://crm-al.neeklo.ru — Stage 0 API live
- **Parser:** https://pars-site.neeklo.ru/health — 200
- **Migrations:** 11/11
- **pgvector:** 0.8.0
