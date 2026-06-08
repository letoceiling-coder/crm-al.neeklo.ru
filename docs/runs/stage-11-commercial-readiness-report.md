# Stage 11 — Platform Commercial Readiness Report

**Date:** 2026-06-08  
**Production baseline:** https://crm-al.neeklo.ru (Stage 10.1 GO)  
**Scope:** Billing, plan enforcement, organization team management, marketplace monetization prep, exports, legal, support/backup UI — **no new core modules**, no payment gateway

---

## Executive Summary

Stage 11 delivers commercial readiness infrastructure on top of existing platform modules. Billing catalog, subscriptions, invoices, usage aggregates, full plan enforcement, billing/organization UI, audit exports, marketplace pricing fields, legal pages, and support/backup tooling are implemented.

| Verdict | Stage 12 — Enterprise Launch Readiness |
|---------|----------------------------------------|
| **GO** | Commercial foundation complete; payment gateway + production deploy recommended before public launch |

---

## Block 1 — Billing System ✅

### Migrations

| Migration | Content |
|-----------|---------|
| M11_0 | `billing_plans` + seed FREE/PRO/BUSINESS/ENTERPRISE |
| M11_1 | `subscriptions` + seed for existing orgs |
| M11_2 | `invoices` |
| M11_3 | `usage_aggregates` |
| M11_4 | Marketplace `price`, `currency`, `billingType` |
| M11_5 | `organization_invitations` |

**Total migrations after apply:** 68 (62 + M11_0–M11_5)

### Plans (seeded)

| Tier | RPM | Monthly tokens | Price/mo ₽ |
|------|-----|----------------|------------|
| FREE | 30 | 500K | 0 |
| PRO | 120 | 10M | 4,990 |
| BUSINESS | 600 | 100M | 29,990 |
| ENTERPRISE | 3,000 | 1B | Contract |

### API

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/billing/plans` | Plan catalog |
| `GET /api/v1/billing/subscription` | Org subscription |
| `POST /api/v1/billing/subscription/change` | Change plan (creates OPEN invoice) |
| `GET /api/v1/billing/usage` | Usage summary |
| `GET /api/v1/billing/limits` | Limits + live counters |
| `GET /api/v1/billing/invoices` | Invoice list |
| `GET /api/v1/billing/admin/metrics` | MRR, ARR, commercial KPIs |

**Module:** `apps/api/src/billing/`

---

## Block 2 — Plan Enforcement ✅

**Extended:** `SystemRateLimitService`

| Limit | Enforcement |
|-------|-------------|
| RPM | Redis per org/minute |
| Daily requests | Redis per org/day |
| Monthly requests | Redis per org/month |
| Monthly tokens | Redis + gateway `recordTokenUsage` |
| Monthly storage | Aggregate + document size estimate |
| API key RPM / tokens | `assertApiKeyLimits` |

**Wiring:**

- `PlanEnforcementInterceptor` — all tenant routes under assistants, knowledge, memory, CRM, workflow, marketplace, integrations, chat, agents, tools, billing, organizations
- `GatewayService` — org + API key limits + token recording on `/v1/chat/completions` and agent chat

`PlanLimits` synced from `BillingPlan` on subscription change.

---

## Block 3 — Billing Dashboard ✅

| Route | Page |
|-------|------|
| `/billing` | Overview |
| `/billing/subscription` | Plan selection |
| `/billing/usage` | Usage + limits + export links |
| `/billing/invoices` | Invoice history |

Sidebar: **Биллинг**

---

## Block 4 — Organization Management ✅

| Role | Supported |
|------|-----------|
| OWNER | ✅ |
| ADMIN | ✅ |
| MANAGER | ✅ |
| OPERATOR | ✅ |

| API | Purpose |
|-----|---------|
| `POST /v1/organizations/current/members/invite` | Invite by email |
| `GET /v1/organizations/current/invitations` | List invitations |
| `POST /v1/organizations/invitations/accept` | Accept (authenticated) |
| `PATCH/DELETE .../members/:id` | Role update / remove |

| Route | Page |
|-------|------|
| `/organization` | Overview |
| `/organization/members` | Member list |
| `/organization/invitations` | Invite flow |

---

## Block 5 — Marketplace Monetization ✅

Fields on `MarketplacePackage`:

- `price` (Decimal)
- `currency` (default RUB)
- `billingType` — FREE | PAID | SUBSCRIPTION

DTO + create/update services updated. **No payment processing** (Stage 11 constraint).

---

## Block 6 — Audit Exports ✅

**Module:** `apps/api/src/exports/`

| Domain | Formats |
|--------|---------|
| usage | CSV, XLSX (SpreadsheetML), PDF |
| audit | CSV, XLSX, PDF |
| crm | CSV, XLSX, PDF |
| workflow | CSV, XLSX, PDF |
| marketplace | CSV, XLSX, PDF |

`GET /api/v1/exports/:domain?format=csv|xlsx|pdf`

---

## Block 7 — Backup Center ✅

| Route | API |
|-------|-----|
| `/backups` | `GET /api/v1/backups/status` |

Shows DB backup dir, S3 config, recovery notes.

---

## Block 8 — Support Tools ✅

| Route | API |
|-------|-----|
| `/admin/support` | `GET /api/v1/support/dashboard` (ADMIN) |

Organizations, errors 24h, queue failures, marketplace install failures.

---

## Block 9 — Legal Readiness ✅

| Document | Route |
|----------|-------|
| Terms of Service | `/legal/terms` |
| Privacy Policy | `/legal/privacy` |
| Cookie Policy | `/legal/cookies` |
| DPA Template | `/legal/dpa` |
| Marketplace Publisher Agreement | `/legal/marketplace-publisher` |

API: `GET /api/v1/legal/documents`

---

## Block 10 — Commercial Metrics ✅

`GET /api/v1/billing/admin/metrics` (ADMIN):

- MRR / ARR
- Organizations / active users / active assistants
- Marketplace installs
- Token revenue (month)
- Subscriptions by tier

---

## Tests

**File:** `apps/api/src/billing/stage-11-commercial-readiness.spec.ts`

| Area | Tests | Status |
|------|-------|--------|
| Billing plans | 1 | PASS |
| Plan enforcement (429) | 1 | PASS |
| Export CSV | 1 | PASS |
| Org invite RBAC | 1 | PASS |

**Stage 10 regression:** 7/7 PASS  
**Build:** API ✅ · Web ✅

---

## Stage 12 Prerequisites (not blockers for GO)

1. **Payment gateway** — YooKassa/Stripe for PAID invoices
2. **Production deploy** — apply M11 migrations on crm-al.neeklo.ru
3. **Throttler tuning** — tier-aware global throttler (Stage 10.1 finding)
4. **Email delivery** — invitation emails (token shown in UI for now)
5. **Legal review** — counsel review of template texts

---

## GO / NO-GO — Stage 12 Enterprise Launch Readiness

| Criterion | Status |
|-----------|--------|
| Billing plans + subscriptions | ✅ |
| Invoices + usage aggregates | ✅ |
| Plan enforcement (all routes) | ✅ |
| Billing UI | ✅ |
| Organization roles + invitations | ✅ |
| Marketplace pricing fields | ✅ |
| Exports CSV/XLSX/PDF | ✅ |
| Backup center | ✅ |
| Support dashboard | ✅ |
| Legal pages | ✅ |
| Commercial metrics | ✅ |
| Unit tests | ✅ 4/4 |
| No new core modules | ✅ |
| No payment gateway (by design) | ✅ |

### Verdict: **GO** — Stage 12 Enterprise Launch Readiness

Commercial readiness foundation is **complete locally**. Enterprise launch requires production deploy of M11 migrations, payment integration, and legal sign-off.

---

*Report generated: Stage 11 Platform Commercial Readiness — 2026-06-08*
