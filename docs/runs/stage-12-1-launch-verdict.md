# Stage 12.1 — Launch Verdict

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Tag:** `stage-12-release` (`74cf990`)

---

# VERDICT: **NO-GO** — PUBLIC COMMERCIAL LAUNCH

Public launch is **forbidden** until all mandatory gates pass.

---

## GO Criteria Checklist

| # | Criterion | Status |
|---|-----------|--------|
| 1 | 71 migrations applied | ✅ 71 repo / 72 DB |
| 2 | YooKassa real payment PASS | ❌ Keys not configured; mock only |
| 3 | Webhook PASS | ⚠️ Endpoint reachable; no real YooKassa webhook |
| 4 | Invoice → PAID PASS | ✅ Mock only |
| 5 | Subscription activation PASS | ✅ Mock only |
| 6 | SMTP delivery PASS | ❌ SMTP not configured |
| 7 | Registration PASS | ✅ Tested (temp enable) |
| 8 | Onboarding PASS | ✅ |
| 9 | Billing PASS | ✅ Stage 11 regression 65/65 |
| 10 | Marketplace PASS | ⚠️ Package create ✅; purchase checkout backlog |
| 11 | Full Public Smoke PASS | ❌ Real payment missing |
| 12 | No critical production errors | ✅ Health 200, workers online |

**Mandatory failures:** Real YooKassa, SMTP delivery, full public smoke with real payment.

---

## Platform Readiness: **78%**

| Dimension | % |
|-----------|---|
| Core platform (deployed) | 95% |
| Billing + mock payments | 90% |
| Real payment (YooKassa) | 15% |
| Email delivery | 10% |
| Self-service registration (code) | 90% |
| Public launch readiness | **78%** |

---

## Residual Risks

1. **No real payment path tested** — revenue collection untested in production
2. **No email delivery** — invitations/password reset fail silently (stub logs only)
3. **REGISTRATION_ENABLED=false** — correct for now; enabling without SMTP/payment creates broken UX
4. **Marketplace purchase checkout** — not implemented (backlog)
5. **Shared server** — 30+ PM2 processes; resource contention under load
6. **FREE tier RPM=30** — burst traffic from public signup may hit 429 quickly

---

## Plan: First 7 Days After Launch (When GO)

| Day | Action |
|-----|--------|
| D0 | Enable registration; monitor signups hourly |
| D1 | Review payment webhooks + failed invoices |
| D2 | SMTP bounce monitoring; fix invitation delivery |
| D3 | Capacity review — Redis, Postgres, worker queues |
| D4 | First paying customer support playbook |
| D5 | Billing reconciliation — invoices vs YooKassa dashboard |
| D6 | Onboarding completion rate analysis |
| D7 | GO/NO-GO retrospective; tune FREE limits if needed |

---

## Monitoring Plan

| Signal | Tool | Threshold |
|--------|------|-----------|
| API health | `/api/health` | 5xx > 0 → alert |
| Payment failures | `payments` table + PM2 logs | Any FAILED → ALERT_EMAIL |
| Queue backlog | `/api/v1/system/queues` | waiting > 100 → alert |
| SMTP errors | PM2 `EmailService` logs | Any error → alert |
| Registration rate | Audit logs | Spike > 50/hr → review |
| Plan enforcement 429 | API logs | Sustained > 10% → tune limits |

Set `ALERT_EMAIL` before launch.

---

## Incident Response Plan

1. **Payment down** — switch `PAYMENT_MOCK_MODE=true` only for emergency internal testing; notify users; check YooKassa status page
2. **SMTP down** — invitations show token in UI fallback; queue retries when restored
3. **DB issue** — restore from `/var/backups/crm-al-gateway-db-pre-stage12-1-*`
4. **API crash** — `pm2 restart crm-al-tokens-api`; rollback tarball from app backup if needed
5. **Runbook:** `docs/runbooks/recovery-runbooks.md`

---

## Infrastructure Capacity Estimate

**Current server:** shared VPS (`212.67.9.173`), 6 CRM workers + API (~180MB each).

| Tier | Estimated concurrent orgs | Notes |
|------|---------------------------|-------|
| FREE (light usage) | **50–100** | RPM 30/org limits burst |
| Mixed FREE + PRO | **20–40 paying** | Depends on KB/workflow load |
| Hard limit | **~150 registered orgs** | Before dedicated infra recommended |

Recommendation: dedicated CRM server or worker isolation before >100 active orgs.

---

## Required Actions Before GO

1. Add **YOOKASSA_SHOP_ID** + **YOOKASSA_SECRET_KEY** to production `.env`
2. Set **PAYMENT_MOCK_MODE=false**
3. Register webhook in YooKassa → `https://crm-al.neeklo.ru/api/v1/payments/webhook/yookassa`
4. Run real test-card payment E2E
5. Configure **SMTP_*** + verify 4 email types deliver
6. Set **ALERT_EMAIL**
7. Re-run `stage-12-payment-e2e.py` with mock disabled + manual YooKassa test
8. Set **REGISTRATION_ENABLED=true** only after steps 1–7 PASS

---

## Summary

Stage 12 is **deployed and functional on production** with mock payments and gated registration. **Public commercial launch remains NO-GO** until YooKassa live payment and SMTP delivery are configured and validated.
