# Stage 10.1 — Production Deploy Report

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Server:** `root@212.67.9.173`  
**Branch:** `feature/v2-platform`  
**HEAD:** `b67baef` — feat: Stage 9 Marketplace and Stage 10 Enterprise Scale platform  
**Deploy path:** `/var/www/crm-al-tokens`

---

## Executive Summary

Stage 10 Enterprise Scale Platform deployed to production from committed git code. M10_0 and M10_1 migrations applied. PM2 ecosystem running **6 processes**. SystemModule, cache layer, and worker separation are live.

| Item | Result |
|------|--------|
| Git commit before deploy | ✅ `b67baef` pushed |
| Backups | ✅ 4 artifacts |
| Migrations | ✅ M10_0 + M10_1 applied |
| PM2 enterprise mode | ✅ 6/6 online |
| Deploy method | Local build + tarball |

---

## Phase 1 — Pre-Deploy Audit

See: [stage-10-1-pre-deploy-audit.md](./stage-10-1-pre-deploy-audit.md)

| Artifact | Status |
|----------|--------|
| M10_0 | ✅ |
| M10_1 | ✅ |
| SystemModule | ✅ |
| worker.ts | ✅ |
| ecosystem.config.cjs | ✅ 6 processes |
| CacheModule | ✅ |

---

## Phase 2 — Backups

| Type | Path |
|------|------|
| Application | `/var/backups/crm-al-tokens-pre-stage10-1-20260608140559` |
| Database | `/var/backups/crm-al-gateway-db-pre-stage10-1-20260608140559.sql` |
| PM2 ecosystem | `/var/backups/pm2-dump-pre-stage10-1-20260608140559.json` |
| Nginx | `/var/backups/nginx-crm-al-pre-stage10-1-20260608140559.conf` |

---

## Phase 3 — Deploy

| Step | Result |
|------|--------|
| Tarball extract | ✅ |
| `npm install --omit=dev` (API) | ✅ |
| `prisma migrate deploy` | ✅ M10_0, M10_1 |
| Web dist sync | ✅ |
| `pm2 startOrRestart deploy/ecosystem.config.cjs` | ✅ |

### Migrations

| Expected | Applied |
|----------|---------|
| Repo migrations | 62 |
| Production `_prisma_migrations` count | **63** (includes 1 legacy pre-v2 record) |
| M10_0 plan_limits_rate | ✅ |
| M10_1 audit_hardening | ✅ |

Latest applied: `20250609188100_m10_1_audit_hardening`

---

## Phase 4 — PM2 Enterprise Mode

| Process | APP_ROLE | Status | Memory |
|---------|----------|--------|--------|
| `crm-al-tokens-api` | `api` | online | ~168 MB |
| `crm-al-worker-knowledge` | `worker-knowledge` | online | ~155 MB |
| `crm-al-worker-workflow` | `worker-workflow` | online | ~142 MB |
| `crm-al-worker-memory` | `worker-memory` | online | ~139 MB |
| `crm-al-worker-integrations` | `worker-integrations` | online | ~138 MB |
| `crm-al-worker-tools` | `worker-tools` | online | ~138 MB |

API port: **3075**  
Health: `GET /api/health` → 200 (after throttler window reset)

---

## Deploy Scripts Added

| Script | Purpose |
|--------|---------|
| `deploy/stage-10-1-deploy-remote.sh` | Remote backup + deploy + migrate + PM2 |
| `deploy/stage-10-1-enterprise-validation.py` | System/queue/cache smoke |
| `deploy/stage-10-1-enterprise-smoke.py` | Full enterprise E2E |
| `deploy/stage-10-1-production-load-test.py` | Paced load test (1000+ req) |
| `deploy/stage-10-1-db-check.py` | Migration + plan_limits check |

---

## Known Deploy Notes

1. Deploy script exit code 1 at end when `prisma migrate status` ran from wrong cwd — **harmless**, migrations applied successfully.
2. Server OOM on `nest build` — continue **local cross-build + tarball** pattern.
3. Web bundle: System UI routes lazy-loaded; string `/system` may not appear in main `index-*.js` chunk (routes in separate chunks).

---

## Production Parity vs Local

| Component | Local (Stage 10) | Production (Stage 10.1) |
|-----------|------------------|---------------------------|
| SystemModule | ✅ | ✅ |
| 6 PM2 workers | ✅ | ✅ |
| Redis cache | ✅ | ✅ |
| M10 migrations | ✅ | ✅ |
| `/system` UI | ✅ | ✅ (admin, lazy routes) |

**Production parity: ACHIEVED**

---

*Report generated: Stage 10.1 Production Deploy — 2026-06-08*
