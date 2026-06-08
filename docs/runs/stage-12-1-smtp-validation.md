# Stage 12.1 — SMTP Validation

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru

---

## Configuration Audit

| Variable | Production |
|----------|------------|
| SMTP_HOST | ❌ MISSING |
| SMTP_PORT | ❌ MISSING |
| SMTP_USER | ❌ MISSING |
| SMTP_PASSWORD | ❌ MISSING |
| SMTP_FROM | ❌ MISSING |
| SMTP_TLS | ❌ MISSING |

**Result:** EmailModule runs in **stub mode** — messages logged to PM2, not delivered.

---

## Template Coverage (Code Ready)

| Email | Trigger | Production Delivery |
|-------|---------|---------------------|
| Organization Invitation | `invite()` | ❌ Stub only |
| Password Reset | `POST /auth/forgot-password` | ❌ Stub only |
| Payment Confirmation | Payment succeeded | ❌ Stub only |
| Subscription Activated | Plan applied | ❌ Stub only |
| Marketplace Purchase | `sendMarketplacePurchase()` | ❌ Not triggered |
| Alert emails | `AlertingService` | ❌ ALERT_EMAIL unset |

---

## Tests Not Executed

Real delivery tests require SMTP credentials. Recommended provider: any transactional SMTP (Mailgun, SendGrid, Yandex 360, etc.).

### Required Post-Config Test Plan

1. Set all `SMTP_*` vars in `apps/api/.env`
2. `pm2 restart crm-al-tokens-api --update-env`
3. Send org invitation to real inbox → verify receipt
4. `POST /auth/forgot-password` → verify reset link
5. Complete mock/real payment → verify payment + subscription emails

---

## Verdict

**SMTP validation: FAIL** — no SMTP configured, no real email delivery confirmed.

Public launch **blocked** until transactional email works for invitations and password reset.
