# Stage 12.5 — Load Validation

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Script:** `deploy/stage-12-5-load-validation.py`

---

## Results

| Test | Count | Status codes | Avg | P95 | Result |
|------|-------|--------------|-----|-----|--------|
| Health | 50 | 200×50 | 0.46s | 0.90s | ✅ PASS |
| Login | 50 | 201×50 | 0.68s | 0.79s | ✅ PASS |
| Registration status | 50 | 200×50 | 0.32s | 0.40s | ✅ PASS |
| Invoice list | 100 | 200×100 | 0.33s | 0.41s | ✅ PASS |
| Assistants list | 100 | 200×20, **429×80** | 0.31s | — | ⚠️ Rate limited |
| Post-load system health | 1 | 200 | — | — | ✅ PASS |

---

## Skipped (credentials missing)

| Test | Reason |
|------|--------|
| 50 registrations | Registration disabled |
| 50 real payments | YooKassa not configured |

---

## Infrastructure

| Component | Observation |
|-----------|-------------|
| **429 rate limit** | ✅ Active on assistant endpoints under burst |
| **500 errors** | ✅ None observed |
| **PM2** | ✅ 6 CRM processes online (Stage 12.4.2) |
| **PostgreSQL** | ✅ 74 migrations, queries stable |
| **Redis / BullMQ** | ✅ Queue metrics via `/v1/system/queues` |
| **Nginx** | ✅ Public HTTPS responding |

---

## Verdict — Load

**CONDITIONAL PASS** — Core read/auth/billing endpoints stable under moderate load. Rate limiting works. Full commercial load test (registrations + payments) deferred until launch config complete.
