# Stage 12.2 — YooKassa Production Validation

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Server:** `212.67.9.173` (`/var/www/crm-al-tokens`)  
**Scripts:** `deploy/stage-12-2-configure-launch.sh`, `deploy/stage-12-payment-e2e.py`, `deploy/stage-12-1-env-audit.py`

---

## Phase 1 — Configuration Audit

| Variable | Production | Required |
|----------|------------|----------|
| `YOOKASSA_SHOP_ID` | ❌ MISSING | Shop ID from YooKassa merchant cabinet |
| `YOOKASSA_SECRET_KEY` | ❌ MISSING | Secret key (live or test) |
| `PAYMENT_MOCK_MODE` | ⚠️ `true` | Must be `false` for real payments |
| `APP_PUBLIC_URL` | ✅ `https://crm-al.neeklo.ru` | Return URL base |

**Secrets file:** `/root/crm-al-launch-secrets.env` — **NOT FOUND**

**Configure script:** `deploy/stage-12-2-configure-launch.sh` uploaded to `/tmp/` — exits with instructions when secrets file absent (expected).

### YooKassa adapter behavior

When `PAYMENT_MOCK_MODE=true` **or** `YOOKASSA_SHOP_ID` is empty, the adapter runs in **mock mode** (`yookassa.adapter.ts`). Real API calls to `api.yookassa.ru` are **not made**.

---

## Webhook Endpoint

| Item | Value | Status |
|------|-------|--------|
| URL | `POST https://crm-al.neeklo.ru/api/v1/payments/webhook/yookassa` | ✅ Reachable |
| HTTP test (empty body) | `201` | ✅ Endpoint active |
| Registered in YooKassa cabinet | — | ❌ Not done (no keys) |

**Action required:** In YooKassa merchant settings, register webhook URL above for events `payment.succeeded`, `payment.canceled`.

---

## Return URL

| Item | Status |
|------|--------|
| Path after payment | `/billing/invoices?paid=1` |
| Full URL | `https://crm-al.neeklo.ru/billing/invoices?paid=1` |
| Config source | `APP_PUBLIC_URL` + billing UI | ✅ |

---

## Phase 2 — Payment Test Results

### Mock payment E2E — PASS (regression)

**Script:** `stage-12-payment-e2e.py` — **8/8 PASS** (2026-06-08)

| Step | Result |
|------|--------|
| Login admin | ✅ |
| Reset org to FREE | ✅ |
| Upgrade PRO → OPEN invoice | ✅ |
| `POST /payments/invoices/:id/pay` | ✅ 201 |
| Mock complete | ✅ |
| Invoice → PAID | ✅ |
| Subscription → PRO | ✅ |
| Plan limits synced | ✅ |

### Real YooKassa test-card payment — NOT RUN

| Step | Status |
|------|--------|
| Create test organization | ⏳ Blocked (no real payment path) |
| FREE → Upgrade PRO | ✅ (mock path only) |
| Invoice OPEN | ✅ (mock path only) |
| Redirect to YooKassa checkout | ❌ Mock URL only |
| Pay with YooKassa test card | ❌ Not executed |
| Webhook from YooKassa | ❌ Not received |
| Invoice PAID via webhook | ❌ Not verified |
| Subscription ACTIVE | ✅ Mock only |
| PlanLimits updated | ✅ Mock only |

### Database snapshot (production)

| Table | State |
|-------|-------|
| `payments` | 2 × SUCCEEDED (mock) |
| `payment_events` | Logged on mock/webhook |
| `invoices` | PAID after mock-complete |
| `subscriptions` | PRO after mock payment |
| `payment_providers` | YOOKASSA row exists; `is_enabled` pending secrets apply |

---

## GO Criteria (YooKassa)

| Criterion | Status |
|-----------|--------|
| Real YooKassa payment succeeded | ❌ |
| Webhook from YooKassa received | ❌ |
| Invoice → PAID (real) | ❌ |
| Subscription activated (real) | ❌ |

---

## Verdict — YooKassa

**FAIL** — Real YooKassa production payment path is **not configured and not validated**.

---

## Ops Runbook (when credentials available)

1. Create `/root/crm-al-launch-secrets.env` on server:

```env
YOOKASSA_SHOP_ID=<shop_id>
YOOKASSA_SECRET_KEY=<secret_key>
PAYMENT_MOCK_MODE=false
SMTP_HOST=...
SMTP_PORT=587
SMTP_TLS=true
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=noreply@crm-al.neeklo.ru
ALERT_EMAIL=ops@yourdomain.com
APP_PUBLIC_URL=https://crm-al.neeklo.ru
```

2. Run: `bash /tmp/stage-12-2-configure-launch.sh`
3. Register webhook in YooKassa → `https://crm-al.neeklo.ru/api/v1/payments/webhook/yookassa`
4. Create test org → upgrade PRO → pay with YooKassa test card `5555 5555 5555 4444` (exp 12/30, CVC 123)
5. Verify DB: `payments`, `payment_events`, `invoices`, `subscriptions`
6. Re-run this validation and update verdict
