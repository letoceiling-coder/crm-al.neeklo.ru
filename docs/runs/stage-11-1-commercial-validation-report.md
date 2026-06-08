# Stage 11.1 — Commercial Validation Report

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Script:** `deploy/stage-11-1-commercial-validation.py`  
**API base:** `http://127.0.0.1:3075/api` (server-side)

---

## Executive Summary

Commercial validation executed on production after deploy and billing hotfix. **65/65 PASS**, 0 FAIL.

| Block | Result |
|-------|--------|
| Billing API | ✅ |
| Plan enforcement (limits structure) | ✅ |
| Organization invitations | ✅ |
| Marketplace pricing (FREE/PAID/SUBSCRIPTION) | ✅ |
| Exports (5 domains × 3 formats) | ✅ |
| Support dashboard | ✅ |
| Backup center | ✅ |
| Legal pages | ✅ |
| Commercial metrics | ✅ |
| Regression (8 core modules) | ✅ |

---

## Phase 5 — Billing Validation

| Endpoint | Status |
|----------|--------|
| `GET /api/v1/billing/plans` | ✅ 200 |
| `GET /api/v1/billing/subscription` | ✅ 200 |
| `GET /api/v1/billing/usage` | ✅ 200 |
| `GET /api/v1/billing/limits` | ✅ 200 |
| `GET /api/v1/billing/invoices` | ✅ 200 |

### Plan Tiers

| Tier | Catalog |
|------|---------|
| FREE | ✅ |
| PRO | ✅ |
| BUSINESS | ✅ |
| ENTERPRISE | ✅ |

### Plan Change → Invoice

| Check | Result |
|-------|--------|
| `POST /subscription/change` → PRO | ✅ 200/201 |
| OPEN invoice created | ✅ |

---

## Phase 6 — Plan Enforcement

Limits endpoint returns all required fields:

| Limit | Enforced via |
|-------|--------------|
| RPM | Redis per org/minute — ✅ observed 429 in burst tests |
| Daily requests | ✅ |
| Monthly requests | ✅ |
| Monthly tokens | ✅ |
| Monthly storage | ✅ |

Resource limits verified in smoke test:

| Resource | Result |
|----------|--------|
| Organization (RPM) | ✅ 429 when exceeded |
| Assistant count | ✅ 400 at max 3 on FREE |
| ApiKey | ✅ (plan_limits synced from billing plan) |

**Sample limits (admin org, FREE tier):**

| Field | Limit |
|-------|-------|
| rpm | 30 |
| dailyRequests | 500 |
| monthlyRequests | 5000 |
| monthlyTokens | 500,000 |
| monthlyStorageMb | 512 |

---

## Phase 7 — Organization Management

| Check | Result |
|-------|--------|
| Roles OWNER/ADMIN/MANAGER/OPERATOR | ✅ enum supported |
| Create invitation | ✅ |
| Accept invitation | ✅ (`stage-11-1-org-probe.py`) |
| Change role | ✅ OPERATOR |
| Remove member | ✅ |

---

## Phase 8 — Marketplace Pricing

| billingType | price | Result |
|-------------|-------|--------|
| FREE | — | ✅ |
| PAID | 990 RUB | ✅ |
| SUBSCRIPTION | 1990 RUB | ✅ |

Fields `price`, `currency`, `billingType` persisted correctly. No payment gateway invoked.

---

## Phase 9 — Exports

| Domain | CSV | XLSX | PDF |
|--------|-----|------|-----|
| usage | ✅ | ✅ | ✅ |
| audit | ✅ | ✅ | ✅ |
| crm | ✅ | ✅ | ✅ |
| workflow | ✅ | ✅ | ✅ |
| marketplace | ✅ | ✅ | ✅ |

All downloads return non-empty payloads.

---

## Phase 10 — Support & Backups

| Route | Status |
|-------|--------|
| `GET /api/v1/support/dashboard` | ✅ 200 |
| `GET /api/v1/backups/status` | ✅ 200 |
| Web `/admin/support` | ✅ (via API proxy) |
| Web `/backups` | ✅ (via API proxy) |

---

## Phase 11 — Legal

| Page | Status |
|------|--------|
| `/legal/terms` | ✅ 200 |
| `/legal/privacy` | ✅ 200 |
| `/legal/cookies` | ✅ 200 |
| `/legal/dpa` | ✅ 200 |
| `/legal/marketplace-publisher` | ✅ 200 |

---

## Phase 12 — Commercial Metrics

`GET /api/v1/billing/admin/metrics` (ADMIN):

| Metric | Value (snapshot) |
|--------|------------------|
| mrr | 0 |
| arr | 0 |
| organizations | 4 |
| activeUsers | 3 |
| activeAssistants | 0 |
| marketplaceInstalls | 3 |
| tokenRevenueRub | 2587.47 |

MRR/ARR = 0 because all orgs on FREE tier after validation reset (expected without payment gateway).

---

## Phase 14 — Regression

Stage 10 enterprise validation (`stage-10-1-enterprise-validation.py`) after RPM cooldown:

| Result | 35/35 PASS |

Stage 11 regression endpoints (within commercial validation):

| Module | Status |
|--------|--------|
| Assistants | ✅ |
| Knowledge | ✅ |
| Memory | ✅ |
| CRM | ✅ |
| Workflow | ✅ |
| Marketplace | ✅ |
| Integrations | ✅ |
| System/queues | ✅ |

---

## Validation Summary

```json
{
  "pass": 65,
  "fail": 0,
  "failures": []
}
```

**Commercial validation: PASS**
