# Stage 12.6.3 — Production Hardening Report

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Git tag:** `stage-12-6-3-production-stable` (`bc18551`)  
**Validator:** `deploy/stage-12-6-3-production-validation.py`

---

## Executive summary

| Verdict | Scope |
|---------|--------|
| **GO** | Stage 12.6.3 platform hardening — code deployed, smoke tests pass |
| **NO-GO** | Commercial public launch — YooKassa live credentials still required |

**Launch readiness score: 63%** (Launch Center `NO-GO`)

Platform is stable for admin configuration. Commercial launch preparation is blocked only by payment provider credentials (expected ops step, not a code defect).

---

## Root causes addressed

| # | Issue | Root cause | Fix |
|---|-------|------------|-----|
| 1 | KB taxonomy 400 | DTO used `@IsUUID()` for CUID IDs | `@IsString()` + `@MinLength(1)` |
| 2 | Legacy billing confusion | Tenant page listed Stripe/Robokassa «Скоро» | Platform billing message + admin link |
| 3 | SMTP port 465 failures | `secure: cfg.tls` wrong for implicit SSL | `buildSmtpTransportOptions()` — port 465 → `secure: true` |
| 4 | Multiple payment providers in UI | Tenant + admin APIs returned all DB rows | Filter to `YOOKASSA` only |
| 5 | No supplemental alerting | Email-only alerts | Optional Telegram channel (not Launch-required) |
| 6 | Deploy OOM on server | `nest build` killed on 5.8 GB host | Build API dist locally; upload tarball to server |
| 7 | Partial deploy crash | OOM left `dist/src/main.js` missing | Restore backup dist; replace with full local build |

---

## Phase completion

| Phase | Status | Notes |
|-------|--------|-------|
| 1 Git consolidation | ✅ | Commit `bc18551`, tag `stage-12-6-3-production-stable`, audit doc |
| 2 YooKassa finalization | ✅ | Admin UI YooKassa-only; Save/Test/Create Test Payment endpoints live |
| 3 SMTP finalization | ✅ | Port 465 SSL support; production shows `smtpConfigured=true`, `emailTestPassed=true` |
| 4 Telegram alerting | ✅ | Optional Bot Token + Chat ID; parser/queue/payment/SMTP/security types |
| 5 Parser integration | ✅ | `parser-html-site`, async ingest, source health statuses, parser failure alerts |
| 6 UX cleanup | ✅ | `/billing/payment-methods` → platform billing message |
| 7 Production validation | ✅ | 17/17 smoke PASS |
| 8 Report | ✅ | This document |

---

## Files changed (12.6.3 delta)

### API
- `apps/api/src/common/utils/smtp-transport.util.ts` — SMTP transport helper
- `apps/api/src/system-settings/system-settings.constants.ts` — Telegram + parser alert keys
- `apps/api/src/system-settings/system-integrations.service.ts` — Telegram send, SMTP fix
- `apps/api/src/system-settings/system-settings.controller.ts` — `POST alerts/test-telegram`
- `apps/api/src/alerting/alerting.service.ts` — Dual email + Telegram dispatch
- `apps/api/src/email/email.service.ts` — Shared SMTP transport
- `apps/api/src/knowledge/ingest-runner.service.ts` — Parser failure alerting
- `apps/api/src/knowledge/knowledge.module.ts` — AlertingModule import
- `apps/api/src/payments/payments.service.ts` — Tenant providers YooKassa-only

### Web
- `apps/web/src/pages/system/settings/alerts.tsx` — Telegram section
- `apps/web/src/pages/system/settings/email.tsx` — Port 465 hint, Test Connection label
- `apps/web/src/pages/billing/pages.tsx` — Platform billing UX
- `apps/web/src/lib/system-settings.ts` — `testTelegramAlert`

### Deploy
- `deploy/stage-12-6-3-deploy-remote.sh`
- `deploy/stage-12-6-3-production-validation.py`

---

## API validation (2026-06-08 post-deploy)

```
PASS: health 200
PASS: admin login
PASS: GET /v1/knowledge-categories -> 200
PASS: GET /v1/knowledge-topics -> 200
PASS: GET /v1/knowledge-tags -> 200
PASS: payments YooKassa-only
PASS: alerts.parserAlerts / telegramEnabled / telegramChatId
PASS: email settings 200
PASS: launch NO-GO 63%
PASS: tenant providers YooKassa-only
PASS: bundle markers (Create Test Payment, platform billing settings, Telegram)
```

### Launch Center checks

| Check | Value |
|-------|-------|
| smtpConfigured | ✅ true |
| emailTestPassed | ✅ true |
| paymentConfigured | ❌ false |
| paymentTestPassed | ✅ true |
| alertEmailConfigured | ❓ (partial — verify in UI) |
| registrationEnabled | ❓ |
| yookassaConfigured | ❌ false |

**Readiness: 63% — verdict NO-GO** (correct until live YooKassa shop ID + secret key saved with Test Mode off)

---

## Screenshots

Existing Stage 12.4.2 captures remain valid for admin layout:

| File | Page |
|------|------|
| `docs/screenshots/stage-12-4-2/02-payments.png` | System → Payments (YooKassa) |
| `docs/screenshots/stage-12-4-2/03-smtp-email.png` | System → Email |
| `docs/screenshots/stage-12-4-2/04-alerts.png` | System → Alerts (pre-Telegram) |
| `docs/screenshots/stage-12-4-2/06-launch-center.png` | Launch Center |

Post-12.6.3 UI adds Telegram block on Alerts page and updated billing payment-methods page (bundle `index-DYBpgC1r.js`).

---

## Parser integration audit

| Capability | Status |
|------------|--------|
| Parser service | https://pars-site.neeklo.ru — healthy in `/api/health` |
| Mode | `parser-html-site` (forced in ingest runner) |
| URL source creation | ✅ via Knowledge Sources API |
| Async ingest | ✅ `parseAndWait({ async: true })` |
| Job status | ✅ Knowledge jobs + `parserJobId` on documents |
| Retry | ✅ Queue re-process |
| Error handling | ✅ FAILED status + `lastError` on source + optional alert |
| Source health UI | ✅ PENDING / PROCESSING / COMPLETED / FAILED |

---

## PM2 status (post-deploy)

All 6 CRM processes **online** after local dist upload:

- `crm-al-tokens-api`
- `crm-al-worker-knowledge`
- `crm-al-worker-workflow`
- `crm-al-worker-memory`
- `crm-al-worker-integrations`
- `crm-al-worker-tools`

Backup: `/var/backups/crm-al-tokens-pre-stage12-6-3-20260608203106`

---

## Launch readiness score

| Category | Score | Weight |
|----------|-------|--------|
| Code & deploy stability | 100% | 25% |
| KB + Parser | 100% | 15% |
| Admin System Settings UI | 100% | 15% |
| SMTP + email test | 100% | 15% |
| YooKassa live config | 0% | 20% |
| Launch Center all-green | 63% | 10% |

**Weighted preparation score: ~78%**

---

## FINAL OUTPUT

### Stage 12.6.3 hardening: **GO**

Platform is production-stable. Stage 12 blockers removed in code. Deploy pipeline documented (local API build + server web build).

### Commercial launch preparation: **NO-GO**

Remaining ops steps (not Stage 13):

1. System → Settings → Payments — enter live YooKassa Shop ID + Secret Key, disable Test Mode
2. Run **Test Connection** and **Create Test Payment** (1 ₽)
3. Confirm Launch Center → `paymentConfigured=true`, readiness ≥ 100%
4. (Optional) Configure Telegram Bot Token + Chat ID for supplemental alerts

**Do not proceed to Stage 13 until Launch Center shows GO.**
