# Stage 0.2 — Production Validation

**Date:** 2026-06-07  
**Validation script:** `/tmp/stage-0-1-validate.sh` (re-run post-deploy)  
**Log:** `/tmp/stage-0-1-validation-rerun.log`

---

## Final Verdict

# GO

Stage 0 infrastructure is deployed and healthy on production. Stage 1 may proceed.

---

## GO Criteria (user-defined)

| Criterion | Result |
|-----------|--------|
| Parser unhealthy | **PASS** — `/health` returns 200, `ok:true` |
| pgvector missing | **PASS** — extension 0.8.0 |
| Migrations missing | **PASS** — 11/11, schema up to date |
| Health endpoint red | **PASS** — all checks green |

---

## Validation Results

### Database

| Check | Result |
|-------|--------|
| PostgreSQL 16.14 | PASS |
| pgvector | PASS (0.8.0) |
| m0_0, m0_4, m0_5, m0_8 | PASS |
| Stage 0 tables | PASS (all exist) |
| `api_keys.organization_id` | PASS |
| Prisma migrate status | PASS — up to date |

### Redis & Queues

| Check | Result |
|-------|--------|
| Redis PONG | PASS |
| knowledge-ingest | PASS (0 waiting) |
| knowledge-reembed | PASS |
| memory-summarize | PASS |
| workflow-run | PASS |
| parser-jobs | PASS |

### BullBoard

| Check | Result |
|-------|--------|
| `/api/admin/queues` localhost | HTTP 200 |
| Public via nginx | HTTP 200 |

### Parser

| Check | Result |
|-------|--------|
| `https://pars-site.neeklo.ru/health` | PASS — 200, ok:true |
| Local `:3180/health` | PASS |
| Parse sozd.duma.gov.ru | **WARN** — Oxylabs content error |

**Note:** Parse test failure is an **external Oxylabs** issue (`"Oxylabs did not return usable content"`), not parser service availability. Health endpoint and auth are green. Infrastructure criterion is **parser healthy** — satisfied.

### Storage (Selectel S3)

| Check | Result |
|-------|--------|
| S3 env vars | PASS (all set) |
| Health check | PASS — bucket `crm-al-knowledge` reachable |

### ProviderAccount & EncryptedSecret

| Check | Result |
|-------|--------|
| Platform OpenRouter default | PASS (count=1) |
| EncryptedSecret records | PASS (count=1) |

### Health Endpoint

```bash
curl https://crm-al.neeklo.ru/api/health
```

| Component | ok |
|-----------|-----|
| database | ✅ true |
| parser | ✅ true |
| storage | ✅ true |
| queues.redis | ✅ true |
| Overall | ✅ **ok: true** |

---

## Stage 0.1 Re-run Summary

```
PASS: PostgreSQL, pgvector, all tables, migrations
PASS: Redis, /api/health, BullBoard
PASS: Parser /health
PASS: S3 configuration, ProviderAccount, EncryptedSecret
WARN: Parser parse sozd.duma.gov.ru (Oxylabs)
```

---

## Known Follow-ups (non-blocking)

1. **Oxylabs parse test** — retry sozd.duma.gov.ru when Oxylabs quota/content available
2. **Duplicate `_prisma_migrations` row** for m0_8 — optional cleanup
3. **HNSW index** — implement in Stage 5 with dimension strategy (≤2000 or IVFFlat)
4. **Dedicated S3 bucket keys** — currently shared Selectel account with gpt.neeklo.ru
5. **PM2 env_file** — consider adding `env_file: apps/api/.env` to ecosystem for clarity
6. **Parser default port** — change fallback in `server.mjs` from 3080 → 3180 to prevent future conflicts

---

## Comparison: Stage 0.1 vs Stage 0.2

| Component | Stage 0.1 | Stage 0.2 |
|-----------|-----------|-----------|
| API version | 0.0.1 | 1.0.0 |
| `/api/health` | 404 | ok:true |
| Migrations | 7 | 11 |
| pgvector | missing | 0.8.0 |
| Parser | 502 | 200 |
| S3 | not configured | configured |
| Verdict | NO-GO | **GO** |

---

## Sign-off

**Stage 0.2 = GO**  
**Stage 1 = UNBLOCKED**

Validated: 2026-06-07T21:26 UTC
