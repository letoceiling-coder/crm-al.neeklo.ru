# Stage 12.5 — Alert Validation

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru

---

## Configuration

| Setting | Production |
|---------|------------|
| `alertEmail` (System Settings) | ❌ empty |
| `ALERT_EMAIL` (`.env`) | ❌ MISSING |

Launch Center: `alertEmailConfigured=false`

---

## Alert Types

| Alert | Event creation | Email send | Logging |
|-------|----------------|------------|---------|
| Queue Alert | ⚠️ Not triggered | ❌ No recipient | ✅ Ops endpoints available |
| Payment Alert | ⚠️ Not triggered | ❌ | ✅ Payment events in DB |
| SMTP Alert | ❌ N/A | ❌ | — |
| Storage Alert | ⚠️ Not triggered | ❌ | ✅ `/v1/system/health` OK |
| Security Alert | ⚠️ Not triggered | ❌ | ✅ Audit log module active |

Alerting service requires configured `alertEmail` + SMTP to deliver. Neither is set.

---

## Ops Infrastructure (available)

| Endpoint | Status |
|----------|--------|
| `GET /v1/system/health` | ✅ 200 |
| `GET /v1/system/queues` | ✅ 200 |
| `GET /v1/system/dependencies` | ✅ 200 |

---

## Verdict — Alerting

**NO-GO** — Alert email not configured; end-to-end alert delivery not validated.

### Required actions

1. Set **Alert Email** in **Система → Оповещения**
2. Configure SMTP first
3. Trigger test alert (e.g. queue threshold) and confirm delivery
