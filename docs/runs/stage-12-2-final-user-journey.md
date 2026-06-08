# Stage 12.2 — Final Public User Journey

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru

---

## Phase 6 — Registration Validation

**Script:** `deploy/stage-12-1-registration-test.py` — **7/7 PASS**

| Step | Result |
|------|--------|
| Temporarily `REGISTRATION_ENABLED=true` | ✅ |
| `POST /auth/register` | ✅ token issued |
| Organization created (COMPANY) | ✅ |
| FREE subscription | ✅ tier=FREE |
| OWNER role assigned | ✅ |
| Onboarding status endpoint | ✅ |
| Onboarding advance | ✅ |
| Restored `REGISTRATION_ENABLED=false` | ✅ |

**Current production state:** `REGISTRATION_ENABLED=false` (correct until GO).

---

## Phase 7 — Full User Journey

| Step | Automated | Manual | Status | Notes |
|------|-----------|--------|--------|-------|
| Registration | ✅ | — | **PASS** | Temp enable test |
| Onboarding | ✅ | — | **PASS** | API advance works |
| Assistant | — | ⏳ | **NOT RUN** | Requires manual UI |
| Knowledge base | — | ⏳ | **NOT RUN** | Requires manual UI |
| Document upload | — | ⏳ | **NOT RUN** | Requires manual UI |
| Workflow | — | ⏳ | **NOT RUN** | Requires manual UI |
| CRM | ✅ | — | **PASS** | Stage 11 regression 65/65 |
| Upgrade PRO | ✅ | — | **PASS** | OPEN invoice created |
| Real payment | ✅ mock | ❌ real | **PARTIAL** | Mock 8/8; real blocked |
| Payment email | — | — | **FAIL** | SMTP stub |
| PRO access after pay | ✅ mock | ❌ real | **PARTIAL** | Mock path only |

### Mock payment flow (verified)

```
Register (temp) → FREE → Onboarding
  → Upgrade PRO → Invoice OPEN
  → Pay (mock) → Invoice PAID → Subscription PRO → PlanLimits updated
```

### Real payment flow (not completed)

```
Register → Onboarding → ... → Upgrade PRO → Invoice OPEN
  → Redirect YooKassa → Test card → Webhook
  → Invoice PAID → Subscription ACTIVE → Confirmation email
```

**Blockers:** YooKassa keys, SMTP, manual UI steps for assistant/KB/document/workflow.

---

## Phase 8 — 48h Readiness Check

**Script:** `deploy/stage-12-2-readiness-check.py` (2026-06-08)

| Component | Status | Detail |
|-----------|--------|--------|
| API health (public) | ✅ | HTTP 200, `ok: true` |
| PostgreSQL | ✅ | Docker `crm-al-tokens-postgres` |
| Redis | ✅ | `PONG` |
| BullMQ queues | ✅ | All queues 0 waiting/failed |
| S3 storage | ✅ | Bucket `crm-al-knowledge` |
| Parser service | ✅ | Configured |
| PM2 workers | ✅ | 6/6 online |
| System endpoints | ✅ | queues, health, dependencies |
| YooKassa config | ❌ | Keys missing |
| SMTP config | ❌ | Not set |
| Payments (real) | ❌ | Mock mode only |

**Critical production errors:** None observed in health, PM2, or queue metrics.

---

## GO Criteria (User Journey)

| Criterion | Status |
|-----------|--------|
| Registration works | ✅ |
| Onboarding works | ✅ |
| Full cycle without errors | ❌ (real payment + email missing) |
| Real payment in journey | ❌ |
| Email in journey | ❌ |

---

## Verdict — User Journey

**PARTIAL PASS** — Registration, onboarding, billing mock cycle, and platform regression pass. **Full public commercial journey with real payment and email: NOT COMPLETED.**
