# Stage 12.5 — Payment Configuration Audit

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Script:** `deploy/stage-12-5-production-audit.py`

---

## Phase 1 — System → Платежи

| Provider | isEnabled | isDefault | testMode | shopId | secretKey | Webhook | Return URL |
|----------|-----------|-----------|----------|--------|-----------|---------|------------|
| **YooKassa** | ❌ false | ✅ true | ❌ true | ❌ empty | ❌ no | ✅ set | ✅ set |
| Stripe | false | false | true | empty | no | set | set |
| Robokassa | false | false | true | empty | no | set | set |
| CloudPayments | false | false | true | empty | no | set | set |

### YooKassa URLs (production)

| Field | Value |
|-------|-------|
| Webhook | `https://crm-al.neeklo.ru/api/v1/payments/webhook/yookassa` |
| Return | `https://crm-al.neeklo.ru/billing/invoices?paid=1` |

---

## Environment (server `.env`)

| Key | Status |
|-----|--------|
| `YOOKASSA_SHOP_ID` | ❌ MISSING |
| `YOOKASSA_SECRET_KEY` | ❌ MISSING |
| `PAYMENT_MOCK_MODE` | ⚠️ `true` |
| `/root/crm-al-launch-secrets.env` | ❌ NOT FOUND |

DB `payment_providers`: YooKassa default but disabled, no shopId, no encrypted secret.

---

## Phase 2 — YooKassa Production Validation

| Step | Status | Notes |
|------|--------|-------|
| Real credentials configured | ❌ BLOCKED | No shopId/secret |
| `POST …/payments/YOOKASSA/test` | ❌ NOT RUN | Requires credentials |
| Payment created (real) | ❌ NOT RUN | Mock mode active |
| Redirect to YooKassa | ❌ NOT RUN | — |
| Webhook callback | ⚠️ PARTIAL | Endpoint reachable; mock accepts unsigned payloads |
| Invoice OPEN → PAID | ⚠️ MOCK ONLY | Stage 12.1 flow passes via `mock-complete` |
| Subscription ACTIVE | ✅ | Verified in mock flow (admin org) |
| Audit log | ✅ | Historical `SUCCEEDED:4` payments in DB |

### Required flow (commercial)

```
Invoice OPEN → Payment Created → Pending → Succeeded → Invoice PAID → Subscription ACTIVE
```

**Result:** Only mock path validated. **Real YooKassa flow NOT validated.**

---

## Verdict — Payment

**NO-GO** — Cannot certify commercial payments without real YooKassa credentials and production test.

### Required actions

1. Create `/root/crm-al-launch-secrets.env` with `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `PAYMENT_MOCK_MODE=false`
2. Configure via **Система → Платежи → YooKassa**: enable, disable test mode, enter credentials
3. Run **Проверить подключение** (sets `launch.payment_test_passed`)
4. Execute one real test payment and confirm webhook + invoice PAID
