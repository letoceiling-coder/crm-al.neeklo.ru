# Stage 12.4.2 — Pre-Deploy Audit

**Date:** 2026-06-08  
**Branch:** `feature/v2-platform`  
**Target:** https://crm-al.neeklo.ru

---

## Git Status

| Check | Result |
|-------|--------|
| Branch | ✅ `feature/v2-platform` |
| HEAD | `2704de3` (Stage 12.1 reports) |
| Working tree | ⚠️ **NOT CLEAN** — Stage 12.4 uncommitted (deploy from working tree) |

Stage 12.4 code present locally (uncommitted): `system-settings/`, migrations M12_4/M12_5, web settings pages.

---

## Stage 12.4 Code Verification

| Item | Status |
|------|--------|
| `apps/api/src/system-settings/` | ✅ Present |
| `SystemSettingsModule` in `app.module.ts` | ✅ |
| M12_4 `20250610120300_m12_4_system_settings` | ✅ |
| M12_5 `20250610120400_m12_5_system_integrations` | ✅ |
| Web `/system/settings/*`, `/system/launch` | ✅ |
| Sidebar «Настройки системы», «Launch Center» | ✅ |

---

## Build Verification (Local)

| Build | Result |
|-------|--------|
| `npm run build` (API + Web) | ✅ PASS |
| API `dist/system-settings/` | ✅ Present after build |
| Web bundle markers | ✅ `Launch Center`, `system/settings` in `index-BlbNPm4G.js` |

---

## Production Baseline (Stage 12.4.1)

| Item | Pre-deploy state |
|------|------------------|
| API settings routes | 404 |
| M12_4 / M12_5 | Not applied |
| Web Stage 12.4 UI | Not in bundle |

---

## Pre-Deploy Risk

Orphan `system_settings` table on production (0 rows, no migration record) — deploy script will drop before `migrate deploy` if M12_4 not applied.

---

## Verdict

**READY TO DEPLOY** — builds pass, code complete. Git not clean (documented).
