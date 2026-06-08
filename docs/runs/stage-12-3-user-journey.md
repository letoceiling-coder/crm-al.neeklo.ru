# Stage 12.3 — Complete User Journey

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru

---

## Phase 6 — User Journey Matrix

Target: full path **without manual intervention**.

| Step | Automated | Status | Notes |
|------|-----------|--------|-------|
| Registration | ✅ | **PASS** | `stage-12-1-registration-test.py` 7/7 |
| Organization created | ✅ | **PASS** | COMPANY + OWNER |
| FREE subscription | ✅ | **PASS** | tier=FREE |
| Onboarding | ✅ | **PASS** | status + advance |
| Assistant | ❌ | **NOT RUN** | No automated UI/API journey script |
| Knowledge base | ❌ | **NOT RUN** | Manual step required |
| Document upload | ❌ | **NOT RUN** | Manual step required |
| Indexing | ❌ | **NOT RUN** | Depends on upload |
| Workflow | ❌ | **NOT RUN** | Manual step required |
| CRM | ✅ | **PASS** | Stage 11 regression (prior deploy) |
| Marketplace | ✅ | **PASS** | Browse + package create (Stage 12.1) |
| Upgrade PRO | ✅ mock | **PARTIAL** | OPEN invoice via API |
| Real YooKassa payment | ❌ | **FAIL** | Mock only |
| Email receipt | ❌ | **FAIL** | SMTP stub |
| PRO access | ✅ mock | **PARTIAL** | Mock payment activates PRO |

### Registration E2E — PASS (2026-06-08)

```
REGISTRATION_ENABLED=true (temp)
  → POST /auth/register
  → FREE subscription + OWNER role
  → onboarding status + advance
  → REGISTRATION_ENABLED=false (restored)
```

**Current:** `REGISTRATION_ENABLED=false` (correct for NO-GO).

---

## Phase 7 — 72h Stability Check

**Script:** `deploy/stage-12-2-readiness-check.py`

| Component | Status | Detail |
|-----------|--------|--------|
| API health | ✅ | HTTP 200 (recovered after PM2 restart during reg test) |
| PostgreSQL | ✅ | Docker `crm-al-tokens-postgres`, 72 migrations |
| Redis | ✅ | `crm-al-tokens-redis` |
| BullMQ queues | ✅ | 0 waiting/failed on all queues |
| S3 storage | ✅ | Bucket `crm-al-knowledge` |
| Parser | ✅ | Configured in health checks |
| PM2 workers | ✅ | 6/6 online |
| System APIs | ✅ | queues, health, dependencies |
| SMTP | ❌ | Not configured |
| Payments (real) | ❌ | Mock mode |
| Alerts | ❌ | ALERT_EMAIL unset |

**Note:** API had transient 502 during registration test (PM2 restart, 10 restarts total). Recovered within ~20s; health 200 at validation end.

**Critical errors at rest:** None in health, queues, or worker status.

---

## Automated vs Manual Gap

Full Phase 6 requires an end-to-end automation script covering assistant → KB → document → workflow. **Not present in repo** (Stage 12.3 scope: ops validation only, no new features). Stage 11/12 API regressions cover CRM/marketplace/billing APIs.

---

## Verdict — User Journey

| Criterion | Result |
|-----------|--------|
| Registration + onboarding | **PASS** |
| Full journey without manual steps | **FAIL** |
| Real payment in journey | **FAIL** |
| Email in journey | **FAIL** |
| 72h infrastructure stability | **PASS** (launch config excluded) |

**Phase 6–7: FAIL** (commercial journey incomplete).
