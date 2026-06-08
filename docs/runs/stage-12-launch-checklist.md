# Stage 12 — Launch Checklist

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Rule:** Public launch forbidden until full Payment → Invoice → Subscription → Plan Activation cycle passes on production.

---

## Pre-Launch Gates (Mandatory)

| # | Gate | Local | Production |
|---|------|-------|------------|
| 1 | M12 migrations applied (71 total) | ⏳ migrate | ⏳ |
| 2 | Payment E2E mock PASS | ✅ | ⏳ |
| 3 | Real YooKassa payment PASS | N/A | ⏳ |
| 4 | SMTP configured + test email | ⏳ stub | ⏳ |
| 5 | Invitation email E2E | ✅ code | ⏳ |
| 6 | Registration E2E (gated) | ✅ code | ⏳ |
| 7 | REGISTRATION_ENABLED=false until sign-off | ✅ default | ✅ |

---

## Platform Checklist

| Area | Check | Local | Prod |
|------|-------|-------|------|
| Registration | `/register` + FREE org | ✅ | ⏳ |
| Email | SMTP / stub | ✅ | ⏳ |
| Payment | YooKassa mock | ✅ | ⏳ |
| Billing | plans, subscription, invoices | ✅ | ✅ Stage 11 |
| Plan enforcement | limits block | ✅ | ✅ Stage 11 |
| Marketplace | pricing fields | ✅ | ✅ Stage 11 |
| Assistants | CRUD | ✅ | ✅ |
| Knowledge | upload + RAG | ✅ | ✅ |
| Workflow | create + run | ✅ | ✅ |
| CRM | leads | ✅ | ✅ |
| Memory | profiles | ✅ | ✅ |
| Integrations | providers | ✅ | ✅ |
| Exports | CSV/XLSX/PDF | ✅ | ✅ Stage 11 |
| Support | dashboard | ✅ | ✅ Stage 11 |
| Backups | status | ✅ | ✅ Stage 11 |
| Legal | pages | ✅ | ✅ Stage 11 |
| Onboarding | `/onboarding` | ✅ | ⏳ |
| Enterprise | contracts API | ✅ | ⏳ |

---

## Launch Sequence (Recommended)

1. Deploy Stage 12 to production (git tag + tarball)
2. `npx prisma migrate deploy` — expect 71 migrations
3. Set `PAYMENT_MOCK_MODE=true`, run `stage-12-payment-e2e.py` on server
4. Configure YooKassa test shop → real payment test → `PAYMENT_MOCK_MODE=false`
5. Configure SMTP → send test invitation + password reset
6. Run Stage 11 commercial validation regression
7. Set `REGISTRATION_ENABLED=true` only after steps 1–6 PASS
8. Monitor `ALERT_EMAIL` for first 48h

---

## Forbidden Until GO

- ❌ Open public registration (`REGISTRATION_ENABLED=true`)
- ❌ Accept real payments without webhook validation
- ❌ Sell paid tiers without YooKassa keys
- ❌ Paid advertising traffic

---

## GO / NO-GO — PUBLIC COMMERCIAL LAUNCH

### Criteria

| Criterion | Required |
|-----------|----------|
| 71 migrations on production | ✅ required |
| Real YooKassa payment E2E | ✅ required |
| SMTP delivery confirmed | ✅ required |
| Registration E2E on production | ✅ required |
| Stage 11 regression PASS | ✅ required |
| Payment → Invoice → Subscription cycle | ✅ required |

### Verdict

# **NO-GO** — PUBLIC COMMERCIAL LAUNCH

Stage 12 is **implemented and validated locally**. Production deploy, real YooKassa credentials, SMTP configuration, and production E2E are **required** before public launch.

---

## Readiness After Stage 12 (Local)

| Dimension | % |
|-----------|---|
| Payment infrastructure | **90%** (mock validated; live keys pending) |
| Email infrastructure | **85%** (code ready; SMTP pending) |
| Self-service signup | **90%** (gated; production enable pending) |
| Enterprise contracts | **75%** (admin API; no self-service DPA signing) |
| Overall commercial launch readiness | **82%** |

**Estimated to public launch:** 1 production deploy cycle + YooKassa test shop + SMTP setup (~2–3 days ops).
