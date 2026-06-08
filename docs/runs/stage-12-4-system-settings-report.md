# Stage 12.4 — System Integrations Admin Panel

**Date:** 2026-06-08  
**Production target:** https://crm-al.neeklo.ru  
**Scope:** Launch-critical settings moved from `.env` to admin UI

---

## Summary

Stage 12.4 implements a **System Settings** admin panel at `/system/settings` with separate pages (no modals/popups). All commercial launch settings are stored in PostgreSQL via `SystemSettingsService`, with secrets encrypted in `EncryptedSecret` (platform org `org_platform_system`). ENV vars remain as **fallback only**.

---

## Migrations

| ID | File | Content |
|----|------|---------|
| M12_4 | `20250610120300_m12_4_system_settings` | `system_settings` table, audit enum values, default seeds |
| M12_5 | `20250610120400_m12_5_system_integrations` | Payment provider config defaults, platform org, SMTP config key |

**Total migrations after deploy:** 73 (71 + M12_4 + M12_5)

---

## Backend

### Module: `apps/api/src/system-settings/`

| Component | Purpose |
|-----------|---------|
| `SystemSettingsService` | CRUD + env fallback |
| `SystemSettingsCache` | 60s in-memory TTL cache |
| `SystemIntegrationsService` | Payments, SMTP, alerts, launch readiness |
| `SystemSettingsController` | Admin API `v1/system/settings/*` |
| `SystemLaunchController` | `GET v1/system/launch` |
| `SystemSettingsPublicController` | Public registration flag |

### Audit actions (new)

- `SYSTEM_SETTING_UPDATED`
- `PAYMENT_PROVIDER_UPDATED`
- `SMTP_UPDATED`
- `ALERT_UPDATED`

### Consumer rewiring

| Service | Before | After |
|---------|--------|-------|
| `SignupService` | `REGISTRATION_ENABLED` env | `registration.enabled` in DB |
| `AuthController` | env | `SystemSettingsService.isRegistrationEnabled()` |
| `EmailService` | SMTP env at startup | DB + `EncryptedSecret`, dynamic transporter |
| `AlertingService` | `ALERT_EMAIL` env | `alerts.email` + per-type toggles |
| `YooKassaAdapter` | env credentials | DB + encrypted secret via `SystemIntegrationsService` |

---

## Admin UI

### Routes (ADMIN only — `ProtectedAdmin`)

| Path | Page |
|------|------|
| `/system/settings/general` | Public URL |
| `/system/settings/payments` | YooKassa, Stripe, Robokassa, CloudPayments |
| `/system/settings/email` | SMTP + test send |
| `/system/settings/alerts` | Alert email + toggles |
| `/system/settings/registration` | Registration flags |
| `/system/settings/billing` | Currency, invoice prefix, timeouts |
| `/system/settings/security` | Security diagnostics link |
| `/system/settings/storage` | S3 status |
| `/system/settings/monitoring` | Integration health matrix |
| `/system/launch` | Launch Center (GO/NO-GO, 0–100%) |

Sidebar: **Настройки системы**, **Launch Center** under admin nav.

---

## Secrets

- SMTP password → `EncryptedSecret` key `system:smtp:password`
- Payment secret keys → `system:payment:{PROVIDER}:secret_key`
- UI shows `hasPassword` / `hasSecretKey` — never plaintext

---

## Launch Center

Checks (all must pass for GO):

1. YooKassa configured (shop ID + secret, mock off)
2. SMTP configured
3. Alert email set
4. Registration enabled
5. Webhook reachable
6. Payment test passed
7. Email test passed

Displays **Launch Readiness %** and **GO / NO-GO** verdict.

---

## Tests

| Suite | Result |
|-------|--------|
| `stage-12-4-system-settings.spec.ts` | **5/5 PASS** |
| `stage-12-enterprise-launch.spec.ts` (regression) | **4/4 PASS** |

Covers: settings CRUD, audit, encrypted secret masking, launch NO-GO, registration DB gate, YooKassa mock mode.

---

## ENV After Stage 12.4

**Required in `.env` (infrastructure only):**

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `APP_SECRET` / `SECRET_ENCRYPTION_KEY`

**Managed via UI (DB primary, env fallback):**

- YooKassa credentials, mock mode
- SMTP_*
- ALERT_EMAIL
- REGISTRATION_ENABLED
- APP_PUBLIC_URL
- Billing defaults

---

## Deploy Notes

1. Apply migrations M12_4 + M12_5 on production
2. Deploy API + web build
3. Login as ADMIN → `/system/settings/payments` — configure YooKassa
4. `/system/settings/email` — configure SMTP, send test
5. `/system/settings/alerts` — set alert email
6. `/system/settings/registration` — enable when ready
7. `/system/launch` — verify GO before public launch

Existing `.env` values continue to work until overridden in UI.

---

## Verdict

**Stage 12.4 COMPLETE** — Launch-critical commercial settings can be managed without editing `.env`. Enables Stage 12.3 re-validation entirely through admin panel after deploy.
