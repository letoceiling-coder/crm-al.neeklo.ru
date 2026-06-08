# Stage 12.1 — Production Deploy Report

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Server:** `root@212.67.9.173`  
**Branch:** `feature/v2-platform`  
**Tag:** `stage-12-release` (`74cf990`)  
**Deploy path:** `/var/www/crm-al-tokens`

---

## Executive Summary

Stage 12 deployed to production from git tag `stage-12-release`. M12 migrations applied. PM2 ecosystem (6 processes) restarted. Payment mock flow validated. **YooKassa and SMTP not configured on server.**

| Item | Result |
|------|--------|
| Git tag `stage-12-release` | ✅ pushed |
| Backups | ✅ 4 artifacts |
| Migrations | ✅ 71 repo / 72 DB (legacy row) |
| PM2 | ✅ 6 processes online |
| `/api/health` | ✅ 200 |
| `/api/docs` | ✅ 200 |

---

## Phase 1 — Git Release

| Item | Value |
|------|-------|
| Branch | `feature/v2-platform` |
| Commit | `74cf990` — feat: Stage 12 enterprise launch readiness |
| Tag | `stage-12-release` |
| Working tree | Clean at deploy |

---

## Phase 3 — Backups

| Artifact | Path |
|----------|------|
| Application | `/var/backups/crm-al-tokens-pre-stage12-1-20260608155709` |
| Database | `/var/backups/crm-al-gateway-db-pre-stage12-1-20260608155709.sql` |
| PM2 | `/var/backups/pm2-dump-pre-stage12-1-20260608155709.json` |
| Nginx | `/var/backups/nginx-crm-al-pre-stage12-1-20260608155709.conf` |

---

## Phase 4 — Deploy

| Step | Result |
|------|--------|
| Local build | ✅ |
| Tarball from `74cf990` | ✅ |
| `prisma migrate deploy` | ✅ M12_0–M12_2 |
| PM2 restart | ✅ |
| Env appended | `APP_PUBLIC_URL`, `PAYMENT_MOCK_MODE=true`, `REGISTRATION_ENABLED=false` |

### Migrations Applied

```
20250610120000_m12_0_payment_providers
20250610120100_m12_1_payments
20250610120200_m12_2_payment_events
```

---

## Production Env State (Post-Deploy)

| Variable | Set |
|----------|-----|
| YOOKASSA_SHOP_ID | ❌ |
| YOOKASSA_SECRET_KEY | ❌ |
| PAYMENT_MOCK_MODE | ✅ true |
| SMTP_* | ❌ |
| REGISTRATION_ENABLED | ✅ false |
| ALERT_EMAIL | ❌ |
| APP_PUBLIC_URL | ✅ |

---

## Verdict

**Deploy: SUCCESS** — Stage 12 live on production.  
**Public launch blockers remain:** YooKassa credentials, SMTP, real payment validation.
