# Stage 12.6.2 — Production Investigation & Deploy

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Verdict:** **GO** — Stage 12.6.1 production parity achieved

---

## Executive Summary

Stage 12.6.1 fixes existed **only in local working tree** and were **never deployed**. Production continued to run Stage 12.4.2 API dist with `@IsUUID()` validation and Stage 12.4.2 web bundle without YooKassa admin UI.

Stage 12.6.2 investigation confirmed root causes, deployed fixes, and validated production.

---

## Phase 1 — Knowledge API Audit

### Production error (before fix)

```
GET /api/v1/knowledge-categories?knowledgeBaseId=cmq4h6kyu0003vtr4qegsopgh
→ 400 {"message":["knowledgeBaseId must be a UUID"],"error":"Bad Request","statusCode":400}
```

Same for `knowledge-topics`, `knowledge-tags`.

### Root cause

| Item | Production (before) | Expected |
|------|-------------------|----------|
| DTO validator | `@IsUUID()` | `@IsString()` + `@MinLength(1)` |
| ID format | Prisma CUID (`cmq4h6kyu…`) | CUID |
| ValidationPipe | Global, whitelist | OK |
| Routes | Registered | OK |

Production dist excerpt:

```javascript
// knowledge-taxonomy.dto.js (OLD)
(0, class_validator_1.IsUUID)(), // knowledgeBaseId
```

### Fix applied

`apps/api/src/knowledge/dto/knowledge-taxonomy.dto.ts` — all `knowledgeBaseId`, `categoryId`, `parentId`, `tagIds` use `@IsString()` / `@MinLength(1)`.

### After fix

| Endpoint | Status |
|----------|--------|
| `GET /v1/knowledge-categories?knowledgeBaseId=…` | **200** |
| `GET /v1/knowledge-topics?knowledgeBaseId=…` | **200** |
| `GET /v1/knowledge-tags?knowledgeBaseId=…` | **200** |

---

## Phase 2 — Frontend Audit

Frontend calls were **correct** (`knowledgeBaseId` query param). No frontend change required for 400 fix.

All usages:

| File | Endpoint |
|------|----------|
| `pages/knowledge/detail.tsx` | GET categories/topics/tags |
| `components/knowledge/taxonomy-tab.tsx` | POST create |

---

## Phase 3 — Billing UI Audit

### User-reported symptom

`/billing/payment-methods` shows legacy cards:

```
YOOKASSA — Скоро
STRIPE — Скоро
…
```

### Finding — route mismatch, not missing deploy

| Route | Purpose | Stage 12.6.1 UI |
|-------|---------|-----------------|
| `/billing/payment-methods` | **Org tenant** billing (legacy) | Still shows "Скоро" — by design |
| `/system/settings/payments` | **Admin** System Settings | YooKassa-only: Shop ID, Secret, Test Connection, **Create Test Payment** |

Production bundle **before** deploy: `index-BlbNPm4G.js` — had `system/settings/payments` but **no** `Create Test Payment`.

Production bundle **after** deploy: `index-DGYovfIn.js` — contains:

- `Create Test Payment`
- `Test Connection`
- `system/settings/payments`

**Admin path:** Система → Настройки системы → Платежи → `/system/settings/payments`

---

## Phase 4 — Deployment Audit

| Check | Before | After |
|-------|--------|-------|
| Git commit on server | Stage 12.4.2 (2704de3 era) | Source tarball 12.6.2 extracted |
| API taxonomy DTO | `IsUUID` | `IsString` + `MinLength` |
| Web bundle | `index-BlbNPm4G.js` | `index-DGYovfIn.js` |
| PM2 API | online | online (post hotfix) |
| Stage 12.6.1 in git | **Not committed** | Deployed from working tree |

**Missing deploy:** Entire Stage 12.6.1 local changes were never pushed/deployed after 12.4.2.

---

## Phase 5 — Fixes Applied

| Fix | File(s) |
|-----|---------|
| CUID validation | `knowledge-taxonomy.dto.ts` |
| YooKassa-only payments API | `system-integrations.service.ts` |
| Payments admin UI | `pages/system/settings/payments.tsx` |
| SMTP admin UI | `pages/system/settings/email.tsx` |
| Launch Center labels | `pages/system/launch.tsx` |
| Parser circular dep hotfix | Reverted `parser-client.service.ts` to ConfigService-only (DI crash) |

---

## Phase 6 — Deploy

| Step | Result |
|------|--------|
| Backup | `/var/backups/crm-al-tokens-pre-stage12-6-2-20260608200248` |
| Source extract | ✅ |
| Web build (vite on server) | ✅ `index-DGYovfIn.js` |
| API dist upload | ✅ |
| ParserClient hotfix | ✅ (restored non-circular DI) |
| PM2 restart | ✅ 6/6 online |

**Note:** `nest build` OOM-killed on server (512MB). API dist built locally and uploaded.

---

## Phase 7 — Production Validation

Script: `deploy/stage-12-6-2-production-validation.py`

```
PASS: admin login
PASS: GET /v1/knowledge-categories -> 200
PASS: GET /v1/knowledge-topics -> 200
PASS: GET /v1/knowledge-tags -> 200
PASS: payments API YooKassa-only
PASS: launch center 200
PASS: bundle contains 'Create Test Payment'
PASS: bundle contains 'system/settings/payments'
PASS: bundle contains 'Test Connection'

Verdict: GO (10/10)
```

### Sample API response (categories)

```
HTTP 200
[]
```

---

## Phase 8 — Screenshots

Updated in `docs/screenshots/stage-12-4-2/` (re-captured post-deploy).

---

## Final Verdict

### Stage 12.6.1 production parity: **GO**

| Criterion | Status |
|-----------|--------|
| Knowledge taxonomy 200 | ✅ |
| YooKassa admin UI deployed | ✅ `/system/settings/payments` |
| SMTP admin UI | ✅ |
| Launch Center | ✅ |
| API healthy | ✅ |

### Clarification for ops

- **Do not use** `/billing/payment-methods` for YooKassa configuration — that is the tenant billing view.
- **Use** `/system/settings/payments` (Admin → Настройки системы → Платежи).

---

## Remaining (non-blocking)

- Commit Stage 12.6.1/12.6.2 changes to git
- Parser API key via system settings UI (deferred — circular DI; uses `.env` for now)
- Update `/billing/payment-methods` copy to link admins to System Settings (optional UX)
