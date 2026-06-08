# Stage 11.1 — Pre-Deploy Audit

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Server:** `root@212.67.9.173`

---

## Git State (pre-deploy)

| Item | Value |
|------|-------|
| Branch | `feature/v2-platform` |
| Baseline HEAD | `b67baef` — Stage 9 + 10 |
| Stage 11 commit | `d9b2671` — Stage 11 commercial readiness |
| Post-deploy hotfix | `a794def` — billing BigInt serialization |
| Tag | `stage-11-release` (on `d9b2671`, hotfix pushed separately) |
| Deploy rule | **Committed code only** — no uncommitted tarball |

---

## M11 Migrations

| Migration | File | Status |
|-----------|------|--------|
| M11_0 | `20250609189000_m11_0_billing_plans` | ✅ |
| M11_1 | `20250609189100_m11_1_subscriptions` | ✅ |
| M11_2 | `20250609189200_m11_2_invoices` | ✅ |
| M11_3 | `20250609189300_m11_3_usage_aggregates` | ✅ |
| M11_4 | `20250609189400_m11_4_marketplace_pricing` | ✅ |
| M11_5 | `20250609189500_m11_5_organization_invitations` | ✅ |

**Expected migrations after deploy:** 68 (63 production baseline + 6 M11 − possible legacy overlap)

---

## Module Audit

| Module | Path | Status |
|--------|------|--------|
| BillingModule | `apps/api/src/billing/` | ✅ |
| Organization Invitations | `apps/api/src/organizations/organization-members.service.ts` | ✅ |
| ExportsModule | `apps/api/src/exports/` | ✅ |
| SupportModule | `apps/api/src/support/` (support + backups + legal API) | ✅ |
| Plan Enforcement | `apps/api/src/common/interceptors/plan-enforcement.interceptor.ts` | ✅ |
| Web — Billing | `apps/web/src/pages/billing/` | ✅ |
| Web — Organization | `apps/web/src/pages/organization/` | ✅ |
| Web — Legal | `apps/web/src/pages/legal/` | ✅ |
| Web — Backups | route `/backups` | ✅ |
| Web — Support | route `/admin/support` | ✅ |

---

## Production Baseline (Stage 10.1)

| Item | Current |
|------|---------|
| App path | `/var/www/crm-al-tokens` |
| API port | 3075 |
| Migrations | 63 |
| PM2 processes | 6 |
| Deploy method | Local build + tarball |

---

## Deploy Strategy

1. `git commit` + `git push origin feature/v2-platform`
2. `git tag stage-11-release && git push origin stage-11-release`
3. Local `npm run build` (API + Web)
4. Tarball from committed tree
5. Backups: app, DB, PM2, nginx (`deploy/stage-11-1-deploy-remote.sh`)
6. `npx prisma migrate deploy` (expect 68 total)
7. `pm2 startOrRestart deploy/ecosystem.config.cjs`
8. Validate: health, docs, commercial validation, smoke, regression

---

## Validation Scripts

| Script | Purpose |
|--------|---------|
| `deploy/stage-11-1-deploy-remote.sh` | Backup + deploy + migrate + PM2 |
| `deploy/stage-11-1-commercial-validation.py` | Billing, org, exports, legal, metrics, regression |
| `deploy/stage-11-1-commercial-smoke.py` | Full commercial E2E cycle |
