# Stage 12.3 — Payment E2E Validation

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Prior stage:** 12.2 NO-GO (credentials missing)

---

## Phase 1 — YooKassa Activation Audit

### Environment variables

| Variable | Production | Required |
|----------|------------|----------|
| `YOOKASSA_SHOP_ID` | ❌ MISSING | Shop ID |
| `YOOKASSA_SECRET_KEY` | ❌ MISSING | Secret key |
| `PAYMENT_MOCK_MODE` | ⚠️ `true` | Must be `false` |
| `APP_PUBLIC_URL` | ✅ Set | `https://crm-al.neeklo.ru` |

**Secrets file:** `/root/crm-al-launch-secrets.env` — **NOT FOUND**

### payment_providers (PostgreSQL)

| provider | is_enabled | is_default |
|----------|------------|------------|
| YOOKASSA | ❌ `false` | ✅ `true` |
| STRIPE | `false` | `false` |
| ROBOKASSA | `false` | `false` |
| CLOUDPAYMENTS | `false` | `false` |

YooKassa is default provider but **not enabled** — expected until credentials applied via `stage-12-2-configure-launch.sh`.

### Webhook

| Item | Status |
|------|--------|
| URL | `POST https://crm-al.neeklo.ru/api/v1/payments/webhook/yookassa` |
| Reachability | ✅ HTTP 201 |
| Registered in YooKassa cabinet | ❌ Not done (no keys) |

### Return URL

| Path | Status |
|------|--------|
| `/billing/invoices?paid=1` | ✅ Configured via `APP_PUBLIC_URL` |

---

## Phase 2 — Real Payment E2E

### Target flow (NOT COMPLETED)

```
FREE → Upgrade PRO → Invoice OPEN → YooKassa Checkout
  → Test Card → Webhook → Invoice PAID → Subscription ACTIVE → Plan Limits Updated
```

### Real payment test — NOT RUN

| Step | Status |
|------|--------|
| Create new test organization | ⏳ Blocked |
| FREE tier | — |
| Upgrade PRO | — |
| Invoice OPEN | — |
| YooKassa Checkout redirect | ❌ Mock URL only |
| Test card payment | ❌ Not executed |
| Webhook from YooKassa | ❌ Not received |
| Invoice PAID (real) | ❌ |
| Subscription ACTIVE (real) | ❌ |
| Plan limits updated (real) | ❌ |

**Blocker:** No YooKassa credentials; adapter stays in mock mode when `PAYMENT_MOCK_MODE=true` or shop ID empty.

### Mock payment regression — PASS

**Script:** `deploy/stage-12-payment-e2e.py` — **8/8 PASS**

| Step | Result |
|------|--------|
| Login admin | ✅ |
| Reset FREE | ✅ |
| PRO upgrade → pending invoice | ✅ |
| Initiate payment | ✅ 201 |
| Mock complete | ✅ |
| Subscription PRO | ✅ |
| Invoice PAID | ✅ |
| Registration status | ✅ |

### Database snapshot

| Table | State |
|-------|-------|
| `payments` | 4 × SUCCEEDED (all mock) |
| `payment_events` | Logged on mock/webhook |
| `invoices` | PAID after mock-complete |
| `subscriptions` | PRO after mock payment |
| `audit_logs` | Not verified (real flow N/A) |
| `usage` | Not verified (real flow N/A) |

---

## Verdict — Payment E2E

| Test | Result |
|------|--------|
| YooKassa activation | **FAIL** |
| Real payment E2E | **NOT RUN** |
| Mock payment regression | **PASS** |
| Webhook endpoint | **PASS** |

**Phase 1–2: FAIL** — Real YooKassa payment path not activated.
