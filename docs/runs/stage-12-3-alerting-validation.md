# Stage 12.3 — Alerting Validation

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Module:** `apps/api/src/alerting/alerting.service.ts`

---

## Phase 5 — Alerting Configuration

| Item | Status |
|------|--------|
| `ALERT_EMAIL` set | ❌ MISSING |
| `EmailService` configured | ❌ Stub mode |
| Alert routing active | ❌ Logs only |

When `ALERT_EMAIL` is unset, alerting methods write to logger but **do not send email**.

---

## Alert Types — Test Matrix

| Alert | Method | Trigger test | Delivered to ALERT_EMAIL |
|-------|--------|--------------|--------------------------|
| Payment failure | `paymentFailed()` | Simulate failed webhook / cancelled payment | ❌ NOT RUN |
| SMTP failure | `smtpFailure()` | Force SMTP error | ❌ NOT RUN |
| Queue backlog | `queueBacklog()` | Threshold exceeded | ❌ NOT RUN |
| Storage warning | `storageLimitWarning()` | Org near storage limit | ❌ NOT RUN |

### Planned trigger methods (post-config)

1. **Payment failure** — POST invalid/cancelled payload to webhook or let real payment fail
2. **SMTP failure** — Temporarily set wrong SMTP password, trigger any email
3. **Queue backlog** — Lower threshold in code OR enqueue >threshold jobs (ops manual)
4. **Storage warning** — Upload to org near `storageLimitMb` on FREE tier

**Stage 12.3:** None of the above executed — blocked by missing `ALERT_EMAIL` and SMTP.

---

## Payment Success Alert (bonus)

`paymentSucceeded()` also sends to `ALERT_EMAIL` when configured — not tested.

---

## Verdict — Alerting

| Test | Result |
|------|--------|
| ALERT_EMAIL configured | **FAIL** |
| Payment failure alert | **NOT RUN** |
| SMTP failure alert | **NOT RUN** |
| Queue backlog alert | **NOT RUN** |
| Storage warning alert | **NOT RUN** |

**Phase 5: FAIL** — Alerting infrastructure present in code; delivery not validated.
