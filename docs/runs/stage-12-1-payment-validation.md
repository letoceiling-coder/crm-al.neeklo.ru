# Stage 12.1 — Payment Validation

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Scripts:** `deploy/stage-12-payment-e2e.py`, `deploy/stage-12-1-production-validation.py`

---

## Environment

| Config | Status |
|--------|--------|
| YOOKASSA_SHOP_ID | ❌ Not set |
| YOOKASSA_SECRET_KEY | ❌ Not set |
| PAYMENT_MOCK_MODE | ✅ `true` |
| Webhook URL | `POST https://crm-al.neeklo.ru/api/v1/payments/webhook/yookassa` — reachable ✅ |
| Return URL | `/billing/invoices?paid=1` — configured via `APP_PUBLIC_URL` ✅ |

---

## Mock Payment E2E — PASS

**Script:** `stage-12-payment-e2e.py` — **8/8 PASS**

| Step | Result |
|------|--------|
| Login admin | ✅ |
| Reset FREE | ✅ |
| PRO upgrade → pending invoice | ✅ |
| Initiate payment | ✅ 201 |
| Mock complete | ✅ |
| Subscription tier=PRO | ✅ |
| Invoice PAID | ✅ |
| Registration status endpoint | ✅ |

### Database

| Table | Snapshot |
|-------|----------|
| `payments` | 2 × SUCCEEDED |
| `payment_events` | logged on mock/webhook |
| `invoices` | PAID after mock-complete |
| `subscriptions` | planId → PRO after payment |

---

## Real YooKassa E2E — NOT RUN

| Criterion | Status |
|-----------|--------|
| PAYMENT_MOCK_MODE=false | ❌ Not applied |
| YooKassa test/live keys | ❌ Missing |
| Real card payment | ❌ Not executed |
| Real webhook from YooKassa | ❌ Not received |

**Blocker:** Ops must add `YOOKASSA_SHOP_ID` + `YOOKASSA_SECRET_KEY`, set `PAYMENT_MOCK_MODE=false`, register webhook in YooKassa dashboard, and re-run E2E with test card.

---

## Invoice Flow (Mock) — PASS

```
FREE → change PRO → Invoice OPEN (targetPlanTier=PRO)
  → POST /payments/invoices/:id/pay
  → mock confirmationUrl
  → POST /payments/:id/mock-complete
  → Invoice PAID → applyPaidPlan → PlanLimits synced
```

---

## Verdict

| Test | Result |
|------|--------|
| Mock payment E2E | **PASS** |
| Real YooKassa payment | **FAIL** (not configured) |
| Webhook endpoint | **PASS** (reachable) |

**Payment validation for public launch: FAIL** — real YooKassa required.
