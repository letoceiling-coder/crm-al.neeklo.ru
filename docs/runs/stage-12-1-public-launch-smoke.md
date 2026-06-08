# Stage 12.1 — Public Launch Smoke Test

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru

---

## Automated Validation

**Script:** `deploy/stage-12-1-production-validation.py`

| Block | Result |
|-------|--------|
| Stage 12 API modules | ✅ (2 script bugs: 401 without token on public endpoints — not production issue) |
| Billing tiers FREE–ENTERPRISE | ✅ |
| Mock payment flow | ✅ |
| Webhook endpoint | ✅ |
| Onboarding API | ✅ |
| Marketplace PAID package create | ✅ |
| Marketplace purchase checkout | ⚠️ Backlog |
| Operations (queues/health/deps) | ✅ |
| Regression (assistants/KB/workflow/CRM/marketplace) | ✅ |
| Public `/register`, `/legal/terms` | ✅ |

**Stage 11 commercial validation:** 65/65 PASS (post-deploy regression)

---

## Registration E2E — PASS

**Script:** `deploy/stage-12-1-registration-test.py` — **7/7 PASS**

| Step | Result |
|------|--------|
| REGISTRATION_ENABLED=true (temp) | ✅ |
| POST /auth/register | ✅ token |
| FREE subscription | ✅ |
| OWNER role | ✅ |
| Onboarding status | ✅ |
| Onboarding advance | ✅ |
| Restored REGISTRATION_ENABLED=false | ✅ |

---

## Full Public User Journey — PARTIAL

| Step | Status | Notes |
|------|--------|-------|
| Registration | ✅ | Tested with temp enable |
| Organization created | ✅ | COMPANY type |
| Assistant | ⏳ | Not in automated smoke (plan limits on admin org) |
| Knowledge base + document | ⏳ | Manual |
| Workflow | ⏳ | Manual |
| CRM | ✅ | Regression API 200 |
| Marketplace browse | ✅ | Regression |
| Upgrade PRO | ✅ | Pending invoice created |
| Real payment | ❌ | Mock only |
| Access after payment | ✅ | Mock path activates PRO |

---

## Verdict

**Full public smoke: PARTIAL PASS**

- Platform core + billing mock cycle: **PASS**
- Real payment step: **FAIL**
- End-to-end new user with real payment: **NOT COMPLETED**
