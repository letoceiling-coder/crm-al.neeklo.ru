# Stage 12.5 — Security Validation

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Script:** `deploy/stage-12-5-security-validation.py`

---

## Results (11/11 automated checks PASS)

| Check | Result |
|-------|--------|
| Admin-only `/v1/system/settings/payments` | ✅ 401 unauth |
| Admin-only `/v1/system/settings/email` | ✅ 401 unauth |
| Admin-only `/v1/system/launch` | ✅ 401 unauth |
| YooKassa secret not in API | ✅ `hasSecretKey` only |
| Stripe / Robokassa / CloudPayments secrets hidden | ✅ |
| SMTP password not in API | ✅ `hasPassword` only |
| Registration blocked/throttled | ✅ 15/15 → 403 |
| Webhook unsigned payload | ⚠️ **201** (see below) |

---

## Webhook Signature

Unsigned `POST /v1/payments/webhook/yookassa` returned **201** on production.

**Context:** `PAYMENT_MOCK_MODE=true`; mock webhook path may accept test payloads. For commercial launch with real YooKassa, verify IP/signature validation when `testMode=false`.

**Action:** Re-test after enabling production YooKassa; unsigned payloads should be rejected.

---

## Secrets Handling

| Secret | API exposure | Storage |
|--------|--------------|---------|
| YooKassa secret | ✅ Hidden | EncryptedSecret (when set) |
| SMTP password | ✅ Hidden | EncryptedSecret (when set) |
| `.env` on server | ✅ Not in git | `/var/www/crm-al-tokens/apps/api/.env` |

---

## Verdict — Security

**CONDITIONAL PASS** — Admin routes protected; secrets not leaked via settings API. **Webhook hardening must be re-verified after disabling mock mode.**

Commercial launch security gate: **NOT CLEARED** until production payment mode validated.
