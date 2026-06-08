# Stage 12 — Enterprise Launch Readiness Report

**Date:** 2026-06-08  
**Production baseline:** https://crm-al.neeklo.ru (Stage 11.1 GO)  
**Scope:** Payment gateway, invoice flow, SMTP, self-service signup, onboarding, subscription management, enterprise contracts, alerting, runbooks

---

## Executive Summary

Stage 12 implements commercial launch infrastructure: YooKassa payment gateway with extensible provider architecture, full invoice→payment→subscription activation flow, SMTP email delivery, gated public registration, onboarding wizard, billing UI extensions, enterprise contracts, and operational alerting/runbooks.

| Block | Status |
|-------|--------|
| Block 1 — Payment Gateway (YooKassa + stubs) | ✅ |
| Block 2 — Invoice Flow (OPEN → PAID → Active) | ✅ |
| Block 3 — Email Delivery (SMTP) | ✅ |
| Block 4 — Self-Service Signup | ✅ (gated) |
| Block 5 — Onboarding | ✅ |
| Block 6 — Subscription Management UI | ✅ |
| Block 7 — Enterprise Contracts | ✅ |
| Block 8 — Alerting | ✅ |
| Block 9 — Recovery Runbooks | ✅ |
| Block 10 — Launch Checklist | ✅ |

**Build:** API ✅ · Web ✅ · Stage 12 tests 4/4 PASS

---

## Block 1 — Payment Gateway

### Migrations

| Migration | Content |
|-----------|---------|
| M12_0 | `payment_providers` — YOOKASSA, STRIPE, ROBOKASSA, CLOUDPAYMENTS seeded |
| M12_1 | `payments`, `invoices.target_plan_tier`, user onboarding fields |
| M12_2 | `payment_events`, `password_reset_tokens`, `enterprise_contracts` |

**Total migrations after apply:** 71 (68 + M12_0–M12_2)

### Architecture

```
PaymentProviderAdapter (interface)
├── YooKassaAdapter     ✅ live + mock mode
├── StripeAdapter       ⏳ stub
├── RobokassaAdapter    ⏳ stub
└── CloudPaymentsAdapter ⏳ stub
```

**Module:** `apps/api/src/payments/`

### Payment model fields

`invoiceId`, `organizationId`, `provider`, `amount`, `currency`, `status`, `externalId`, `paidAt` — all implemented.

---

## Block 2 — Invoice Flow

```
Plan Change (paid tier)
    ↓
Invoice OPEN (targetPlanTier set)
    ↓
POST /v1/payments/invoices/:id/pay
    ↓
YooKassa / Mock confirmation
    ↓
Webhook or mock-complete
    ↓
Invoice PAID
    ↓
Subscription ACTIVE + applyPaidPlan()
    ↓
PlanLimits synced
    ↓
Emails: payment confirmation + subscription activated
```

FREE / ENTERPRISE: immediate activation (no payment).

**E2E script:** `deploy/stage-12-payment-e2e.py`

---

## Block 3 — Email Delivery

**Module:** `apps/api/src/email/`

| Env var | Purpose |
|---------|---------|
| SMTP_HOST | SMTP server |
| SMTP_PORT | Port (default 587) |
| SMTP_TLS | true/false |
| SMTP_USER | Username |
| SMTP_PASSWORD | Password |
| SMTP_FROM | From address |

| Template | Trigger |
|----------|---------|
| Organization Invitation | `OrganizationMembersService.invite()` |
| Password Reset | `POST /auth/forgot-password` |
| Payment Confirmation | Payment succeeded |
| Subscription Activated | Plan applied after payment |
| Marketplace Purchase | Ready via `EmailService.sendMarketplacePurchase()` |
| Alerts | `AlertingService` |

When SMTP unset: emails logged as stub (dev-safe).

---

## Block 4 — Self-Service Signup

| Item | Implementation |
|------|----------------|
| `POST /auth/register` | User + COMPANY org + OWNER + FREE subscription |
| `GET /auth/registration-status` | Public status check |
| `/register` | Web UI |
| Gate | `REGISTRATION_ENABLED=true` required |

**Default:** registration **disabled** until ops enables after validation.

---

## Block 5 — Onboarding

| Route | Purpose |
|-------|---------|
| `/onboarding` | Step wizard |
| `GET /v1/onboarding/status` | Progress API |
| Steps | assistant → knowledge-base → integration → workflow |

User fields: `onboardingCompleted`, `onboardingStep`.

---

## Block 6 — Subscription Management

| Page | Path |
|------|------|
| Subscription | `/billing/subscription` — upgrade, cancel, renew |
| Payment methods | `/billing/payment-methods` |
| History | `/billing/history` |
| Invoices + Pay | `/billing/invoices` |

API: `POST /subscription/cancel`, `POST /subscription/renew`

---

## Block 7 — Enterprise Contracts

**Model:** `EnterpriseContract` — contractNumber, slaLevel, dpaSignedAt, customPriceMonthlyRub, customLimits

| API | Purpose |
|-----|---------|
| `GET /v1/enterprise/contract` | Tenant view |
| `POST /v1/enterprise/contracts` | Admin create |
| `POST /v1/enterprise/contracts/:id/activate` | Apply ENTERPRISE + custom limits |

---

## Block 8 — Alerting

**Module:** `apps/api/src/alerting/`

- Payment succeeded / failed
- Queue backlog
- Storage limit warning
- SMTP failure logging

Env: `ALERT_EMAIL` for admin notifications.

---

## Block 9 — Recovery Runbooks

**Path:** `docs/runbooks/recovery-runbooks.md`

Covers: billing, payment, SMTP, S3, Redis, PostgreSQL failures.

---

## Environment Variables (Stage 12)

```env
# Payment
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=
PAYMENT_MOCK_MODE=true          # false in production with real keys
APP_PUBLIC_URL=https://crm-al.neeklo.ru

# Registration (keep false until launch)
REGISTRATION_ENABLED=false

# SMTP
SMTP_HOST=
SMTP_PORT=587
SMTP_TLS=true
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@crm-al.neeklo.ru

# Alerts
ALERT_EMAIL=ops@example.com
```

---

## Verdict — Stage 12 Implementation

**GO** — Enterprise launch readiness **implemented locally**.

**PUBLIC COMMERCIAL LAUNCH:** see [stage-12-launch-checklist.md](./stage-12-launch-checklist.md) — **NO-GO** until production deploy + real payment + SMTP + registration enablement.
