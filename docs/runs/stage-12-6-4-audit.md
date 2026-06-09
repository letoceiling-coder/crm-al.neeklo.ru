# Stage 12.6.4 — Audit & Plan

**Date:** 2026-06-08  
**Branch:** `feature/v2-platform` @ `a7c9921`  
**Production:** https://crm-al.neeklo.ru

## Production audit (verified live)

| Item | State |
|------|-------|
| PM2 CRM processes | 6/6 online (post 12.6.3) |
| YooKassa | shopId=1258020, hasSecretKey, isEnabled, **testMode=true** |
| SMTP | smtp.beget.com:465, configured, lastSuccess set |
| Alert email | dsc-23@yandex.ru |
| Telegram (old) | disabled, no bot token |
| Launch Center | **63% NO-GO** |

### Launch Center root cause (verified)

Checks object has **8 keys**, **5 pass**:

| Check | Value | Issue |
|-------|-------|-------|
| paymentConfigured | false | Requires `!mockMode` but `PAYMENT_MOCK_MODE` defaults env `'true'` + provider testMode |
| yookassaConfigured | false | **Duplicate** of paymentConfigured — double-penalizes |
| smtpConfigured | true | OK |
| alertEmailConfigured | true | OK |
| registrationEnabled | false | Counted as failure though registration may be intentionally off |
| webhookReachable | true | Hardcoded `true`, not verified |
| paymentTestPassed | true | OK |
| emailTestPassed | true | OK |

**Fix plan:**
1. `paymentConfigured` = shopId + secretKey saved (ignore mock/test mode)
2. Remove duplicate `yookassaConfigured` from scoring
3. Remove `registrationEnabled` from required GO checks (informational only)
4. `paymentTestPassed` = connection test OR real test payment flag

## Local branch

Clean working tree at `a7c9921`. Tag `stage-12-6-3-production-stable` on prior commit.

## Implementation plan

### Phase 1 — Russian localization
- Target: `apps/web/src/pages/system/**`, sidebar admin labels, billing payment-methods
- Launch Center labels per spec
- System settings buttons/fields

### Phase 2–6 — Telegram platform
- Migration: `telegram_users`, `telegram_notifications`
- Module: webhook `/api/v1/telegram/webhook`, auto setWebhook
- Admin UI: Настройки / Пользователи / История
- Remove Chat ID from alerts UI
- `/start` → PENDING user + welcome message
- Approve/Reject workflow

### Phase 5 — Alert routing
- Email + Telegram to all APPROVED users
- Types: QUEUE_ERROR, PARSER_ERROR, SMTP_ERROR, PAYMENT_ERROR, SECURITY_ALERT, SYSTEM_ALERT, STORAGE_WARNING
- Log to telegram_notifications

### Phase 7–8 — Launch Center + YooKassa
- Fix readiness calculation
- Russian labels in API response optional (UI-only Russian)

### Phase 9–10 — Validation + reports

## Out of scope
- Stage 13
- Full app-wide i18n framework (system admin scope first)
