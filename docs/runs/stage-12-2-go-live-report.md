# Stage 12.2 — Go-Live Report

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Prior verdict:** Stage 12.1 — NO-GO  
**Stage:** 12.2 Launch Operations & Go-Live Validation

---

# FINAL VERDICT: **NO-GO** — PUBLIC COMMERCIAL LAUNCH

Public commercial launch remains **forbidden** until all mandatory GO criteria pass.

---

## Executive Summary

Stage 12.2 executed operational validation on production. Infrastructure (API, PostgreSQL, Redis, BullMQ, S3, parser, PM2 workers) is **healthy**. Registration, onboarding, and mock billing flows **pass**. The two launch blockers from Stage 12.1 are **unchanged**:

1. **YooKassa** — `YOOKASSA_SHOP_ID` and `YOOKASSA_SECRET_KEY` not configured; `PAYMENT_MOCK_MODE=true`
2. **SMTP** — all `SMTP_*` variables missing; email runs in stub mode

No real payment, no YooKassa webhook from merchant, no email delivery to real inboxes was possible without ops-provided credentials.

---

## GO Criteria Checklist

| # | Criterion | Stage 12.2 Status |
|---|-----------|-------------------|
| 1 | Real YooKassa payment succeeded | ❌ Not configured |
| 2 | Webhook from YooKassa received | ❌ No keys / not registered |
| 3 | Invoice → PAID (real) | ❌ Mock only |
| 4 | Subscription activated (real) | ❌ Mock only |
| 5 | SMTP works | ❌ Not configured |
| 6 | All emails delivered to real inbox | ❌ Not tested |
| 7 | Registration works | ✅ 7/7 PASS |
| 8 | Onboarding works | ✅ PASS |
| 9 | Full user journey PASS | ❌ Partial (mock payment, no email) |
| 10 | Alerting works | ❌ ALERT_EMAIL unset |
| 11 | No critical production errors | ✅ Health 200, 6/6 PM2 online |

**Mandatory failures:** 1, 2, 3, 4, 5, 6, 9, 10.

---

## Validation Summary by Phase

| Phase | Focus | Result | Report |
|-------|-------|--------|--------|
| 1 | YooKassa production config | ❌ FAIL | [yookassa-validation](./stage-12-2-yookassa-validation.md) |
| 2 | Real payment test | ❌ NOT RUN | [yookassa-validation](./stage-12-2-yookassa-validation.md) |
| 3 | SMTP production config | ❌ FAIL | [smtp-validation](./stage-12-2-smtp-validation.md) |
| 4 | Email E2E | ❌ NOT RUN | [smtp-validation](./stage-12-2-smtp-validation.md) |
| 5 | Alerting | ❌ FAIL | [smtp-validation](./stage-12-2-smtp-validation.md) |
| 6 | Registration | ✅ PASS | [final-user-journey](./stage-12-2-final-user-journey.md) |
| 7 | Full user journey | ⚠️ PARTIAL | [final-user-journey](./stage-12-2-final-user-journey.md) |
| 8 | 48h readiness | ⚠️ Infra PASS / Launch FAIL | [final-user-journey](./stage-12-2-final-user-journey.md) |

---

## What Passed (Stage 12.2)

| Test | Result |
|------|--------|
| Public API health | ✅ HTTP 200 |
| Mock payment E2E | ✅ 8/8 |
| Registration E2E (temp enable) | ✅ 7/7 |
| Webhook endpoint reachable | ✅ POST → 201 |
| Stage 11 billing regression | ✅ 65/65 (Stage 12.1) |
| PM2 processes | ✅ 6/6 online |
| Redis / PostgreSQL / queues | ✅ |
| Configure script ready | ✅ `/tmp/stage-12-2-configure-launch.sh` |

---

## Blockers — Required Before GO

### 1. Provide launch secrets

Create on server: `/root/crm-al-launch-secrets.env`

```env
YOOKASSA_SHOP_ID=<from YooKassa cabinet>
YOOKASSA_SECRET_KEY=<from YooKassa cabinet>
PAYMENT_MOCK_MODE=false
SMTP_HOST=<smtp provider>
SMTP_PORT=587
SMTP_TLS=true
SMTP_USER=<user>
SMTP_PASSWORD=<password>
SMTP_FROM=noreply@crm-al.neeklo.ru
ALERT_EMAIL=<ops inbox>
APP_PUBLIC_URL=https://crm-al.neeklo.ru
```

### 2. Apply configuration

```bash
bash /tmp/stage-12-2-configure-launch.sh
```

### 3. Register YooKassa webhook

URL: `https://crm-al.neeklo.ru/api/v1/payments/webhook/yookassa`

### 4. Re-run validation

- Real test-card payment E2E
- Email delivery to real inbox (5 types)
- Alert trigger tests
- Set `REGISTRATION_ENABLED=true` only after payment + SMTP PASS
- Update Stage 12.2 reports and issue new GO/NO-GO verdict

---

## Platform Readiness: **82%**

| Dimension | % | Change from 12.1 |
|-----------|---|------------------|
| Core platform (deployed) | 95% | — |
| Billing + mock payments | 90% | — |
| Real payment (YooKassa) | 15% | — |
| Email delivery | 10% | — |
| Registration / onboarding | 95% | +5% (re-validated) |
| Ops tooling (configure script) | 90% | +90% (new) |
| **Public launch readiness** | **82%** | +4% |

---

## Residual Risks (unchanged)

1. Real payment path never tested in production
2. Email delivery untested — broken UX if registration enabled without SMTP
3. Marketplace purchase checkout — backlog (not launch blocker for core SaaS)
4. Shared VPS — resource contention under public signup load
5. FREE tier RPM=30 — may hit 429 under burst traffic

---

## Ops Artifacts (Stage 12.2)

| Artifact | Location |
|----------|----------|
| Launch configure script | `deploy/stage-12-2-configure-launch.sh` |
| 48h readiness check | `deploy/stage-12-2-readiness-check.py` |
| Env audit | `deploy/stage-12-1-env-audit.py` |
| Payment E2E | `deploy/stage-12-payment-e2e.py` |
| Registration test | `deploy/stage-12-1-registration-test.py` |

---

# POST-GO PLANS (prepare now, execute after GO)

These plans are prepared for execution **only after** a future GO verdict.

---

## 1. Plan — First Client Launch

| Week | Action |
|------|--------|
| W0 (launch day) | Enable `REGISTRATION_ENABLED=true`; announce to 3–5 pilot orgs (hand-picked) |
| W0 | Monitor signups, payments, emails hourly for 48h |
| W1 | Onboard pilots personally — assistant, KB, first workflow |
| W1 | Collect feedback on billing UX and plan limits |
| W2 | First paying conversion target: ≥1 PRO org |
| W2 | Document common support questions → FAQ |

**Pilot criteria:** Russian-speaking B2B, ≤10 users, willing to give written feedback.

---

## 2. Plan — First 30 Days Support

| Period | Focus |
|--------|-------|
| Days 1–7 | War room: payment webhooks, SMTP bounces, registration errors |
| Days 8–14 | Weekly billing reconciliation (YooKassa dashboard vs `invoices`) |
| Days 15–21 | Onboarding completion rate; intervene on stuck orgs |
| Days 22–30 | Capacity review; tune FREE limits if 429 rate >5% |

**Support channels:** Email to ops inbox (`ALERT_EMAIL`); response SLA 4h business / 24h off-hours for pilots.

**Escalation:** Payment down → check YooKassa status; SMTP down → show invite token in UI; DB → restore from `/var/backups/`.

**Runbook:** `docs/runbooks/recovery-runbooks.md`

---

## 3. Plan — Scale to 100 Organizations

| Area | Action |
|------|--------|
| Infrastructure | Dedicated CRM VPS or isolate workers from other PM2 apps on `212.67.9.173` |
| Database | Connection pool tuning; daily pg_dump to off-server storage |
| Redis | Dedicated instance; monitor memory |
| Workers | Scale knowledge + workflow workers to 2 instances each if queue waiting >20 sustained |
| Storage | S3 lifecycle rules; per-org storage alerts already in code |
| Billing | Automated dunning for OPEN invoices >7 days |
| Monitoring | Uptime on `/api/health`; alert on queue backlog >100 |

**Capacity estimate:** 50–100 active FREE orgs or 20–40 mixed FREE+PRO on current shared server.

---

## 4. Plan — Scale to 1000 Organizations

| Area | Action |
|------|--------|
| Architecture | Split API + workers onto separate nodes; read replica for Postgres |
| Queue | Redis Cluster or dedicated BullMQ host |
| CDN | Static assets + document downloads via CDN |
| Multi-tenant isolation | Per-org rate limits review; consider org sharding for enterprise |
| Billing | YooKassa reconciliation job; finance export automation |
| Support | Tier-1 docs + chatbot; tier-2 engineering on-call rotation |
| Compliance | Backup retention policy; DPA for enterprise tier |

**Target:** Dedicated infrastructure before exceeding ~150 active orgs on shared VPS.

---

## 5. Dedicated Infrastructure Recommendations

| Component | Current | Recommended at 100 orgs | Recommended at 1000 orgs |
|-----------|---------|-------------------------|--------------------------|
| App server | Shared VPS | 4 vCPU / 8 GB dedicated | 2× API nodes (8 vCPU each) |
| Workers | 5 PM2 on shared | 5–8 dedicated worker processes | Auto-scaled worker pool |
| PostgreSQL | Docker on VPS | Managed Postgres (Yandex Cloud / Selectel) | Primary + read replica |
| Redis | Docker on VPS | Managed Redis 2 GB | Redis Cluster 4 GB+ |
| S3 | Yandex Object Storage | Same + CDN | Same + lifecycle + versioning |
| SMTP | Transactional provider | Dedicated sending domain + DKIM | Dedicated IP warm-up |
| Monitoring | PM2 + health endpoint | Grafana + Loki or external APM | Full observability stack |

**Estimated monthly cost (100 orgs):** ~15–25k RUB (dedicated VPS + managed DB).  
**Estimated monthly cost (1000 orgs):** ~80–120k RUB (multi-node + managed services).

---

## Summary

Stage 12.2 confirmed production stability and validated all **non-credential** paths. **Public commercial launch is NO-GO** until YooKassa and SMTP credentials are applied and real payment + email E2E pass. Ops tooling (`stage-12-2-configure-launch.sh`) is ready on the server for a one-command apply once `/root/crm-al-launch-secrets.env` exists.

**Next step:** Provide YooKassa + SMTP credentials → run configure script → re-validate → issue GO verdict.
