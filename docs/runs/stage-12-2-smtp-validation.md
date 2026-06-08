# Stage 12.2 — SMTP Production Validation

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Module:** `apps/api/src/email/email.service.ts`

---

## Phase 3 — Configuration Audit

| Variable | Production | Required |
|----------|------------|----------|
| `SMTP_HOST` | ❌ MISSING | SMTP server hostname |
| `SMTP_PORT` | ❌ MISSING | Typically `587` |
| `SMTP_USER` | ❌ MISSING | Auth username |
| `SMTP_PASSWORD` | ❌ MISSING | Auth password |
| `SMTP_FROM` | ❌ MISSING | e.g. `noreply@crm-al.neeklo.ru` |
| `SMTP_TLS` | ❌ MISSING | `true` recommended |
| `ALERT_EMAIL` | ❌ MISSING | Ops inbox for alerts |

**Current mode:** Email service runs in **stub mode** — messages logged as `[EMAIL STUB]` in PM2 logs, **not delivered**.

---

## Phase 4 — Email E2E Tests

All tests require real SMTP credentials. **None executed in Stage 12.2.**

| Email type | Trigger | Production delivery |
|------------|---------|---------------------|
| Organization invitation | `EmailService.invite()` | ❌ Stub only |
| Password reset | `POST /auth/forgot-password` | ❌ Stub only |
| Payment confirmation | Payment succeeded | ❌ Stub only |
| Subscription activated | `applyPaidPlan()` | ❌ Stub only |
| Alert email | `AlertingService` | ❌ ALERT_EMAIL unset |

### Alert types (code ready, delivery untested)

| Alert | Service method | Requires |
|-------|----------------|----------|
| Payment failure | `alerting.paymentFailed()` | ALERT_EMAIL + SMTP |
| SMTP failure | `alerting.smtpFailure()` | ALERT_EMAIL + SMTP |
| Queue backlog | `alerting.queueBacklog()` | ALERT_EMAIL + SMTP |
| Storage limit | `alerting.storageLimitWarning()` | ALERT_EMAIL + SMTP |

---

## Phase 5 — Alerting

| Item | Status |
|------|--------|
| `ALERT_EMAIL` configured | ❌ |
| Payment failure alert tested | ❌ |
| SMTP failure alert tested | ❌ |
| Queue alert tested | ❌ |
| Storage alert tested | ❌ |

**Note:** Without `ALERT_EMAIL`, alerting methods log warnings only; no outbound email.

---

## GO Criteria (SMTP & Alerting)

| Criterion | Status |
|-----------|--------|
| SMTP configured and connected | ❌ |
| Invitation email delivered to real inbox | ❌ |
| Password reset email delivered | ❌ |
| Payment confirmation delivered | ❌ |
| Subscription activated email delivered | ❌ |
| Alert emails delivered | ❌ |

---

## Verdict — SMTP

**FAIL** — No SMTP configuration; no real email delivery confirmed.

---

## Post-Config Test Plan

After running `deploy/stage-12-2-configure-launch.sh` with SMTP vars:

1. `pm2 restart crm-al-tokens-api --update-env`
2. Send org invitation to a real external inbox → verify receipt + links work
3. `POST /auth/forgot-password` for test user → verify reset link
4. Complete real YooKassa payment → verify payment + subscription emails
5. Trigger test alert (e.g. simulate failed payment webhook) → verify `ALERT_EMAIL` inbox
6. Check PM2 logs: no `[EMAIL STUB]` entries for above flows

**Recommended providers:** Yandex 360, Mailgun, SendGrid, Amazon SES — any transactional SMTP with SPF/DKIM for `crm-al.neeklo.ru`.
