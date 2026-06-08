# Stage 11.1 — Production Deploy Report

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Server:** `root@212.67.9.173`  
**Branch:** `feature/v2-platform`  
**Tag:** `stage-11-release` (`d9b2671`)  
**Post-deploy hotfix:** `a794def` — billing BigInt serialization  
**Deploy path:** `/var/www/crm-al-tokens`

---

## Executive Summary

Stage 11 Platform Commercial Readiness deployed to production from committed git code. Six M11 migrations applied. PM2 ecosystem (6 processes) restarted. One production bug (BigInt JSON serialization on billing endpoints) fixed and hot-deployed.

| Item | Result |
|------|--------|
| Git freeze | ✅ `feature/v2-platform` pushed, tag `stage-11-release` |
| Working tree | ✅ Clean at deploy; hotfix `a794def` pushed after deploy |
| Backups | ✅ 4 artifacts |
| Migrations | ✅ 68 repo migrations applied (69 rows in `_prisma_migrations` incl. legacy) |
| PM2 | ✅ 6 processes online |
| `/api/health` | ✅ 200 |
| `/api/docs` | ✅ 200 |

---

## Phase 1 — Git Freeze

| Item | Value |
|------|-------|
| Branch | `feature/v2-platform` |
| Release commit | `d9b2671` — feat: Stage 11 commercial readiness |
| Hotfix commit | `a794def` — fix(billing): serialize BigInt fields |
| Tag | `stage-11-release` → pushed to origin |
| Deploy source | Git commit tarball only (no uncommitted code) |

---

## Phase 2 — Pre-Deploy Audit

See: [stage-11-1-pre-deploy-audit.md](./stage-11-1-pre-deploy-audit.md)

All M11_0–M11_5 migrations and modules verified present before deploy.

---

## Phase 3 — Backups

| Artifact | Path |
|----------|------|
| Application | `/var/backups/crm-al-tokens-pre-stage11-1-20260608145910` |
| Database | `/var/backups/crm-al-gateway-db-pre-stage11-1-20260608145910.sql` |
| PM2 | `/var/backups/pm2-dump-pre-stage11-1-20260608145910.json` |
| Nginx | `/var/backups/nginx-crm-al-pre-stage11-1-20260608145910.conf` |

---

## Phase 4 — Deploy

| Step | Result |
|------|--------|
| Local build (API + Web) | ✅ |
| Tarball `stage-11-1-deploy.tgz` from `d9b2671` | ✅ |
| Extract to `/var/www/crm-al-tokens` | ✅ |
| Preserve `apps/api/.env` | ✅ |
| `npm install` | ✅ |
| `prisma migrate deploy` | ✅ M11_0–M11_5 applied |
| `pm2 startOrRestart deploy/ecosystem.config.cjs` | ✅ |

### Migrations Applied

```
20250609189000_m11_0_billing_plans
20250609189100_m11_1_subscriptions
20250609189200_m11_2_invoices
20250609189300_m11_3_usage_aggregates
20250609189400_m11_4_marketplace_pricing
20250609189500_m11_5_organization_invitations
```

**Prisma:** 68 migrations in repo — all applied  
**DB count:** 69 (includes 1 legacy migration from Stage 10.1 baseline)

---

## Post-Deploy Hotfix

| Issue | Fix |
|-------|-----|
| `GET /v1/billing/plans` → 500 | `TypeError: Do not know how to serialize a BigInt` |
| Root cause | `BillingPlan.monthlyTokens` is `BigInt` in Prisma |
| Fix | `serializeBigInts()` in `BillingPlanService`, `SubscriptionService`, invoice list |
| Deploy | API `dist` hot-upload + `pm2 restart crm-al-tokens-api` |

---

## Deploy Scripts

| Script | Purpose |
|--------|---------|
| `deploy/stage-11-1-deploy-remote.sh` | Backup + deploy + migrate + PM2 |
| `deploy/stage-11-1-commercial-validation.py` | Commercial API validation |
| `deploy/stage-11-1-commercial-smoke.py` | Full commercial E2E |
| `deploy/stage-11-1-org-probe.py` | Invitation accept / role / remove |
| `deploy/stage-11-1-plan-probe.py` | Limits endpoint probe |

---

## Known Operational Notes

1. **Server OOM on `nest build`** — continue local cross-build + tarball pattern.
2. **RPM enforcement** — burst test scripts must pace requests or upgrade plan tier first; FREE tier RPM=30.
3. **Tag vs hotfix** — `stage-11-release` tag points to `d9b2671`; production API includes hotfix `a794def`.

---

## Verdict

**Production deploy: SUCCESS** — Stage 11 commercial infrastructure live on https://crm-al.neeklo.ru
