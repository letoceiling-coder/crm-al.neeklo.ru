# Stage 12.3 — Email E2E Validation

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Module:** `apps/api/src/email/email.service.ts`

---

## Phase 3 — SMTP Activation Audit

| Variable | Production | Required |
|----------|------------|----------|
| `SMTP_HOST` | ❌ MISSING | SMTP hostname |
| `SMTP_PORT` | ❌ MISSING | Typically `587` |
| `SMTP_USER` | ❌ MISSING | Auth user |
| `SMTP_PASSWORD` | ❌ MISSING | Auth password |
| `SMTP_FROM` | ❌ MISSING | e.g. `noreply@crm-al.neeklo.ru` |
| `SMTP_TLS` | ❌ MISSING | `true` recommended |
| `ALERT_EMAIL` | ❌ MISSING | Ops inbox |

**EmailService.isConfigured():** `false` — transporter not initialized.

**Current behavior:** All emails logged as `[EMAIL STUB]` in PM2; **zero outbound delivery**.

### SMTP connection test

| Test | Status |
|------|--------|
| Nodemailer transporter init | ❌ Not configured |
| SMTP verify / send test | ❌ NOT RUN |

---

## Phase 4 — Email Delivery E2E

All tests require real SMTP. **None executed in Stage 12.3.**

| Email type | Trigger | Delivered to external inbox |
|------------|---------|----------------------------|
| Organization invitation | `sendOrganizationInvitation()` | ❌ Stub only |
| Password reset | `POST /auth/forgot-password` | ❌ Stub only |
| Payment confirmation | Payment succeeded | ❌ Stub only |
| Subscription activated | `applyPaidPlan()` | ❌ Stub only |
| Alert email | `AlertingService` | ❌ ALERT_EMAIL unset |

### External inbox confirmation

**NOT CONFIRMED** — No SMTP credentials available to send test messages.

---

## Post-Config Test Plan (for re-run after GO prep)

1. Apply `/root/crm-al-launch-secrets.env` via `stage-12-2-configure-launch.sh`
2. Verify PM2 log: `SMTP not configured` warning **absent** after restart
3. Send invitation to external Gmail/Yandex inbox → confirm receipt
4. Trigger password reset → confirm link works
5. Complete real YooKassa payment → confirm payment + subscription emails
6. Document message IDs from PM2 / provider dashboard

---

## Verdict — Email E2E

| Test | Result |
|------|--------|
| SMTP activation | **FAIL** |
| SMTP connection | **NOT RUN** |
| Invitation delivery | **FAIL** |
| Password reset delivery | **FAIL** |
| Payment confirmation | **FAIL** |
| Subscription activated | **FAIL** |
| Alert email | **FAIL** |

**Phase 3–4: FAIL** — No SMTP configuration; no real email delivery confirmed.
