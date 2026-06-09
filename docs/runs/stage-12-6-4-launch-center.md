# Stage 12.6.4 — Launch Center Fix

## Problem (verified on production before fix)

Launch Center showed **63% NO-GO** despite:
- SMTP configured + email test passed
- YooKassa Shop ID + Secret Key saved
- Alert email set
- Payment connection test passed

## Root causes

| Issue | Detail |
|-------|--------|
| `paymentConfigured` false | Required `!mockMode` while `PAYMENT_MOCK_MODE` env defaults `true` and provider `testMode=true` |
| Duplicate check | `yookassaConfigured` duplicated `paymentConfigured` (8 checks, double penalty) |
| `registrationEnabled` | Counted as required failure though registration intentionally disabled |
| `webhookReachable` | Hardcoded `true` without logic |

## Fix

```typescript
// paymentConfigured = credentials saved (Shop ID + Secret Key)
paymentConfigured = !!(shopId && secretKey);

// 6 required checks (no duplicate, no registration)
checks = {
  paymentConfigured,
  smtpConfigured,
  alertEmailConfigured,
  webhookReachable: provider.isEnabled && paymentConfigured,
  paymentTestPassed,
  emailTestPassed,
};

// informational only (not scored)
informational = {
  registrationEnabled,
  yookassaTestMode,
  yookassaEnabled,
};
```

## Production result (after deploy)

```
readinessPercent: 100
verdict: GO

paymentConfigured: true
smtpConfigured: true
alertEmailConfigured: true
webhookReachable: true
paymentTestPassed: true
emailTestPassed: true

informational.registrationEnabled: false
informational.yookassaTestMode: true
```

## UI

Launch Center renamed to **Центр запуска** with Russian check labels per spec.
