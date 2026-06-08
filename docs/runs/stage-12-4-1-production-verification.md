# Stage 12.4.1 — Production Verification Audit

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Scope:** Verify Stage 12.4 (System Settings Admin Panel) is fully deployed  
**Method:** Automated audit script `deploy/stage-12-4-1-production-audit.py` on server + repo wiring review

---

# VERDICT: **NO-GO**

Stage 12.4 is **NOT fully deployed** on production. Backend API, migrations, and new web bundle are missing. Frontend URL paths return HTTP 200 only because the SPA shell serves `index.html` for all routes — the Stage 12.4 UI is **not present** in the active JS bundle.

---

## Executive Summary

| Area | Status |
|------|--------|
| Backend API routes | ❌ All 404 |
| Database migrations M12_4 / M12_5 | ❌ Not applied |
| `system_settings` data | ❌ 0 rows (table shell may exist, seeds missing) |
| API dist (`system-settings/`) | ❌ Not deployed |
| Web bundle (Stage 12.4 markers) | ❌ Not in active bundle |
| Sidebar menu items | ❌ Not in deployed bundle |
| Repo code (local) | ✅ Complete |

---

## Backend API Audit

Unauthenticated probe (404 = route missing; 401/403 = route exists):

| Endpoint | Production | Expected |
|----------|------------|----------|
| `GET /api/v1/system/settings/general` | ❌ **404** | 401 ADMIN |
| `GET /api/v1/system/settings/payments` | ❌ **404** | 401 ADMIN |
| `GET /api/v1/system/settings/email` | ❌ **404** | 401 ADMIN |
| `GET /api/v1/system/settings/alerts` | ❌ **404** | 401 ADMIN |
| `GET /api/v1/system/settings/registration` | ❌ **404** | 401 ADMIN |
| `GET /api/v1/system/settings/billing` | ❌ **404** | 401 ADMIN |
| `GET /api/v1/system/launch` | ❌ **404** | 401 ADMIN |

**Finding:** `SystemSettingsController` and `SystemLaunchController` are **not registered** in running API.  
**Evidence:** `/var/www/crm-al-tokens/apps/api/dist/system-settings/` — **directory not found**.

---

## Frontend Audit

| Path | HTTP | Stage 12.4 UI |
|------|------|---------------|
| `/system/settings/general` | 200 | ❌ Not in bundle |
| `/system/settings/payments` | 200 | ❌ Not in bundle |
| `/system/settings/email` | 200 | ❌ Not in bundle |
| `/system/settings/alerts` | 200 | ❌ Not in bundle |
| `/system/settings/registration` | 200 | ❌ Not in bundle |
| `/system/settings/billing` | 200 | ❌ Not in bundle |
| `/system/settings/security` | 200 | ❌ Not in bundle |
| `/system/settings/storage` | 200 | ❌ Not in bundle |
| `/system/settings/monitoring` | 200 | ❌ Not in bundle |
| `/system/launch` | 200 | ❌ Not in bundle |

**Active bundle:** `index-PbT4sRPs.js` (2026-06-08 15:56 UTC)  
**Markers searched:** `Launch Center`, `system/settings`, `Настройки системы`, `SettingsPaymentsPage` — **none found**.

**Note:** HTTP 200 on all paths is **misleading** — Vite SPA fallback serves `index.html`; without Stage 12.4 routes in JS, navigation shows legacy app (404 redirect to dashboard or blank).

---

## Sidebar Audit

Expected ADMIN nav (Stage 12.4):

| Item | In repo | On production |
|------|---------|---------------|
| Система | ✅ | ✅ (pre-12.4) |
| Настройки системы | ✅ `sidebar.tsx` | ❌ Not in bundle |
| Launch Center | ✅ `sidebar.tsx` | ❌ Not in bundle |

---

## Database Audit

| Check | Production |
|-------|------------|
| Total migrations | 72 |
| `m12_4_system_settings` | ❌ **NOT in** `_prisma_migrations` |
| `m12_5_system_integrations` | ❌ **NOT in** `_prisma_migrations` |
| `system_settings` table | ⚠️ Exists (empty) |
| `system_settings` row count | **0** (expected ≥20 seeded) |
| `payment_providers.config` | `{}` empty (M12_5 defaults not applied) |

---

## API Wiring (Repository — Local)

Verified in codebase (not yet on production):

| Item | Status |
|------|--------|
| `SystemSettingsModule` in `app.module.ts` | ✅ |
| `SystemSettingsController` | ✅ `v1/system/settings/*` |
| `SystemLaunchController` | ✅ `v1/system/launch` |
| `SystemSettingsPublicController` | ✅ |
| Migrations `M12_4`, `M12_5` in repo | ✅ |

---

## UI Wiring (Repository — Local)

| Item | Status |
|------|--------|
| Routes in `App.tsx` | ✅ `/system/settings/*`, `/system/launch` |
| `SystemSettingsLayout` + subpages | ✅ |
| Sidebar admin nav entries | ✅ |
| `systemSettingsApi` client | ✅ |

---

## Screenshots

**Not captured** — Stage 12.4 UI is absent from production bundle; pages would render legacy SPA without settings panels. Screenshots should be taken **after deploy** of Stage 12.4 web build.

Recommended post-deploy captures:

1. `/system/settings/general`
2. `/system/settings/payments`
3. `/system/settings/email`
4. `/system/settings/alerts`
5. `/system/settings/registration`
6. `/system/launch`

---

## Audit Script Results

```
PASS:  14
FAIL:  11
WARN:  1
Verdict: NO-GO
```

Script location: `/tmp/stage-12-4-1-production-audit.py` on `212.67.9.173`

---

## Required Actions for GO

1. **Deploy API** build containing `apps/api/src/system-settings/`
2. **Apply migrations** M12_4 + M12_5 on production PostgreSQL
3. **Deploy web** build with Stage 12.4 bundle (verify `Launch Center` in JS)
4. **`pm2 restart crm-al-tokens-api --update-env`**
5. Re-run `stage-12-4-1-production-audit.py` — expect API 401 (not 404), migrations present, bundle markers found
6. Capture production screenshots
7. Re-issue verdict **GO**

---

## Conclusion

Stage 12.4 exists **only in the repository** (local build verified in Stage 12.4 report). Production at `crm-al.neeklo.ru` still runs **Stage 12.3-era** API and web artifacts. **NO-GO** until full deploy and re-audit pass.
