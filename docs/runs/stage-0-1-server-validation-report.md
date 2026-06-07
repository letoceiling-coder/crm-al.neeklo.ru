# Stage 0.1 — Server Validation Report

**Date:** 2026-06-07  
**Server:** `root@212.67.9.173`  
**Domain:** https://crm-al.neeklo.ru  
**PM2 process:** `crm-al-tokens-api` (port 3075)  
**Validation script:** `/tmp/stage-0-1-validate.sh` (uploaded from `deploy/stage-0-1-validate.sh`)

---

## Executive Summary

Stage 0 infrastructure was **validated on the production server**. The server currently runs **v1.0 API code** (pre–Stage 0). **Stage 0 code and migrations are NOT deployed.**

| Result | Verdict |
|--------|---------|
| **Stage 0.1** | **NO-GO** |
| **Stage 1** | **BLOCKED** until blockers resolved |

Only **Redis** passed. All Stage 0-specific components failed or could not be tested.

---

## Environment Split (reference)

| Local | Server |
|-------|--------|
| Development, typecheck, lint, unit tests | `prisma migrate deploy`, integration/e2e tests |
| | Parser, S3, Redis, BullMQ validation |

---

## Validation Checklist Results

### 1. Database

| Check | Result | Evidence |
|-------|--------|----------|
| PostgreSQL version | **PASS** | PostgreSQL **16.14** (Alpine/musl) |
| pgvector installed | **FAIL** | `SELECT extname FROM pg_extension WHERE extname='vector'` → empty |
| Migrations applied (Stage 0) | **FAIL** | Only **7** migrations (v1.0); latest: `20250602180000_usage_log_profile_slug` |
| Stage 0 tables | **FAIL** | `organizations`, `encrypted_secrets`, `provider_accounts`, `embedding_profiles`, etc. — **MISSING** |
| `api_keys.organization_id` | **FAIL** | Column **MISSING** |
| Foreign keys / indexes | **NOT TESTED** | Blocked — schema not migrated |

**Commands executed:**

```bash
bash /tmp/stage-0-1-psql-check.sh
# psql with DATABASE_URL (schema param stripped for psql CLI)
SELECT version();
SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10;
```

**Log excerpt:**

```
PostgreSQL 16.14 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
 migration_name                          | finished_at
 20250602180000_usage_log_profile_slug  | 2026-06-02 ...
 ... (7 rows total, no m0_* migrations)
```

---

### 2. Prisma

| Check | Result | Evidence |
|-------|--------|----------|
| `npx prisma migrate deploy` | **NOT RUN** | Stage 0 migration files absent on server (`prisma/migrations/` count = **7**) |
| Pending migrations | **4+ pending** | `m0_0`, `m0_4`, `m0_5`, `m0_8` not on server |
| Schema synchronized | **FAIL** | Server schema = v1.0 |

**Note:** `@prisma/client` lives in `/var/www/crm-al-tokens/node_modules` (monorepo root), not in `apps/api/node_modules`.

---

### 3. Redis

| Check | Result | Evidence |
|-------|--------|----------|
| Connection | **PASS** | Node `ioredis` ping → `PONG` |
| BullMQ queues | **NOT TESTED** | Stage 0 QueueModule not deployed |
| Workers | **NOT TESTED** | No Stage 0 workers |

Expected queues (not created yet): `knowledge-ingest`, `knowledge-reembed`, `memory-summarize`, `workflow-run`, `parser-jobs`.

---

### 4. BullBoard

| Check | Result | Evidence |
|-------|--------|----------|
| `/api/admin/queues` | **FAIL** | HTTP **404** |
| Admin protected | **NOT TESTED** | Route does not exist on v1.0 API |

```bash
curl -s http://127.0.0.1:3075/api/admin/queues  # → 404
```

---

### 5. ParserClient (pars-site.neeklo.ru)

| Check | Result | Evidence |
|-------|--------|----------|
| External `/health` | **FAIL** | nginx **502 Bad Gateway** |
| Local parser `:3180` | **FAIL** | No listener on 3180 |
| Parse sozd.duma.gov.ru | **NOT RUN** | `PARSER_API_KEY` not in server `.env` |
| okContent validation | **NOT RUN** | Blocked |

**Root cause (parser-html-site PM2):**

```
Error: listen EADDRINUSE: address already in use 127.0.0.1:3080
```

- PM2 `parser-html-site`: **132+ restarts**, crash loop
- Port **3080** occupied by `bun` (agro-neeklo)
- Last successful listen on **3180**: 2026-06-05

**Commands:**

```bash
curl -s https://pars-site.neeklo.ru/health          # 502
pm2 logs parser-html-site --lines 15 --nostream
ss -tlnp | grep -E '3075|3080|3180'
```

---

### 6. Storage (Selectel S3)

| Check | Result | Evidence |
|-------|--------|----------|
| S3_ENDPOINT | **FAIL** | Not in `.env` |
| S3_REGION | **FAIL** | Not in `.env` |
| S3_BUCKET | **FAIL** | Not in `.env` |
| S3_ACCESS_KEY / SECRET | **FAIL** | Not in `.env` |
| upload/download/presign/delete | **NOT TESTED** | StorageModule not deployed |

---

### 7. ProviderAccount

| Check | Result | Evidence |
|-------|--------|----------|
| Platform OpenRouter seed | **FAIL** | Table `provider_accounts` does not exist |
| Active default account | **NOT TESTED** | Blocked |

---

### 8. EncryptedSecret

| Check | Result | Evidence |
|-------|--------|----------|
| Table exists | **FAIL** | Not migrated |
| encrypt/decrypt/rotation | **NOT TESTED** | Blocked |
| SECRET_ENCRYPTION_KEY | **FAIL** | Not in `.env` |

---

### 9. TenantGuard

| Check | Result | Evidence |
|-------|--------|----------|
| Cross-tenant blocked | **NOT TESTED** | Stage 0 not deployed |
| Organization switch | **NOT TESTED** | `/api/v1/organizations/*` routes missing |
| ApiKey org resolution | **NOT TESTED** | `organizationId` column missing |

Unit tests passed **locally** (`tenant.guard.spec.ts` 4/4) — server integration not possible until deploy.

---

### 10. Health Endpoint

| Check | Result | Evidence |
|-------|--------|----------|
| `GET /api/health` | **FAIL** | HTTP **404** — route not in v1.0 |
| database | **NOT REPORTED** | — |
| redis | **NOT REPORTED** | — |
| parser | **NOT REPORTED** | — |
| storage | **NOT REPORTED** | — |
| queues | **NOT REPORTED** | — |

```json
{"message":"Cannot GET /api/health","error":"Not Found","statusCode":404}
```

Public: https://crm-al.neeklo.ru/api/health → same 404  
Legacy API (v1.0) responds on other routes (e.g. `/api/auth/login` → 400).

---

## What Passed

| Component | Status |
|-----------|--------|
| SSH access | OK |
| PostgreSQL 16 reachable | OK |
| Redis PONG | OK |
| crm-al-tokens-api PM2 online | OK (v1.0 code, port 3075) |

---

## Root Cause

**Stage 0 implementation exists only on local branch `feature/v2-platform`.**  
Server `/var/www/crm-al-tokens` is **not a git repo**, runs **API v0.0.1/v1.0** from 2026-06-02 deploy, with **7 Prisma migrations** and **no Stage 0 ENV**.

---

## Required Fixes (before re-validation)

### P0 — Deploy Stage 0

1. Deploy `feature/v2-platform` code to `/var/www/crm-al-tokens`
2. `npm install` (root + apps/api)
3. `npx prisma generate`
4. Install **pgvector** on PostgreSQL 16
5. `npx prisma migrate deploy` (M0_0, M0_4, M0_5, M0_8)
6. Add to server `.env`:
   - `SECRET_ENCRYPTION_KEY`
   - `PARSER_BASE_URL`, `PARSER_API_KEY`
   - `S3_*` (Selectel)
7. `npm run build` + `pm2 restart crm-al-tokens-api`
8. `npm run prisma:seed`

### P0 — Fix Parser

1. Resolve `parser-html-site` **EADDRINUSE :3080** (config → **3180** per architecture, or free port)
2. Verify `curl http://127.0.0.1:3180/health` → `ok: true`
3. Verify `curl https://pars-site.neeklo.ru/health` → 200

### P1 — Re-run validation

```bash
bash /tmp/stage-0-1-validate.sh
curl https://crm-al.neeklo.ru/api/health
```

---

## Commands Executed (full list)

```bash
# Connectivity
ssh root@212.67.9.173

# Validation scripts
scp deploy/stage-0-1-validate.sh → /tmp/
scp deploy/stage-0-1-psql-check.sh → /tmp/
bash /tmp/stage-0-1-validate.sh
bash /tmp/stage-0-1-psql-check.sh

# Manual checks
pm2 list | grep -E 'parser|crm-al'
pm2 logs parser-html-site --lines 15 --nostream
ss -tlnp | grep -E '3075|3080|3180'
curl http://127.0.0.1:3075/api/health
curl https://crm-al.neeklo.ru/api/health
curl https://pars-site.neeklo.ru/health
redis-cli ping  # via node ioredis in script
```

---

## GO / NO-GO

# NO-GO — Stage 0.1 FAILED

**Do NOT begin Stage 1.**

Infrastructure validation failed because **Stage 0 is not deployed on the server** and **parser service is down**.

### Unblock path

1. Complete **P0 deploy + parser fix** above  
2. Re-run Stage 0.1 validation  
3. All checklist items green → **GO for Stage 1**

---

## Appendix: Server State Snapshot

| Item | Value |
|------|-------|
| Host | jrexzkogva (Ubuntu, kernel 6.8) |
| API path | `/var/www/crm-al-tokens/apps/api` |
| API version (package.json) | `0.0.1` |
| PM2 | `crm-al-tokens-api` online, ~100MB |
| Migrations on disk | 7 |
| Migrations in DB | 7 (v1.0) |
| Git on server | **No** (fatal: not a git repository) |
| Local branch with Stage 0 | `feature/v2-platform` (not deployed) |
