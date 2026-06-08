# Stage 11.1 — Commercial Smoke Test Report

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Script:** `deploy/stage-11-1-commercial-smoke.py`  
**API base:** `http://127.0.0.1:3075/api`

---

## Executive Summary

Full commercial lifecycle smoke test executed on production. **13 PASS**, **1 WARN**, **0 FAIL**.

| Verdict | **PASS** |

---

## Phase 13 — Full Commercial Smoke Scenario

| Step | Result | Notes |
|------|--------|-------|
| Login admin | ✅ PASS | |
| Upgrade plan → PRO | ✅ PASS | Elevates RPM/limits for smoke |
| Create organization invitation | ✅ PASS | Token returned |
| Create assistant | ✅ PASS | `cmq5cf22d0045vt32e7aqee0m` |
| Create knowledge base | ⚠️ WARN | Plan limit — reused existing KB |
| KB binding | ✅ PASS | 201 |
| Upload document | ✅ PASS | 201 |
| Create workflow | ✅ PASS | |
| Run workflow | ✅ PASS | 201 (after `isActive` default) |
| Create CRM lead | ✅ PASS | 201 |
| Publish marketplace package (PAID) | ✅ PASS | 201, billingType=PAID |
| Change plan → BUSINESS | ✅ PASS | 201 |
| OPEN invoice | ✅ PASS | Present after tier change |
| Download usage export (CSV) | ✅ PASS | Non-empty file |

---

## Smoke Flow Diagram

```
Organization (invite)
    ↓
Assistant → KB → Document
    ↓
Workflow → Run
    ↓
CRM Lead
    ↓
Marketplace Package (PAID)
    ↓
Plan Change (BUSINESS) → Invoice
    ↓
Usage Export (CSV)
```

**Entire cycle completed without blocking errors.**

---

## Warnings (non-blocking)

| Warning | Cause | Mitigation |
|---------|-------|------------|
| KB limit — reused existing | Admin org at max 5 KB on current plan | Expected on long-lived production org; not a functional defect |

---

## Related Probes

| Script | Result |
|--------|--------|
| `stage-11-1-org-probe.py` | Accept ✅, role change ✅, remove ✅ |
| `stage-11-1-plan-probe.py` | Limits endpoint ✅, enforcement counters ✅ |

---

## Summary

```json
{
  "pass": 13,
  "warn": 1,
  "fail": 0,
  "failures": []
}
```

**Full commercial smoke: PASS**

---

## GO / NO-GO — Stage 12 Enterprise Launch Readiness

### Mandatory Criteria

| Criterion | Status |
|-----------|--------|
| 68 migrations applied | ✅ |
| Billing works | ✅ (after BigInt hotfix) |
| Plan enforcement works | ✅ |
| Organization invitations work | ✅ |
| Marketplace pricing works | ✅ |
| Exports work | ✅ |
| Support dashboard works | ✅ |
| Backup center works | ✅ |
| Legal pages accessible | ✅ |
| Commercial metrics work | ✅ |
| Full commercial smoke PASS | ✅ |
| Regression PASS | ✅ (35/35 enterprise validation) |

### Verdict

# **GO** → Stage 12 — Enterprise Launch Readiness

All mandatory gates passed on production.

---

## Commercial Launch Readiness (Additional)

### 1. What remains before public launch

- Payment gateway integration (card/invoice payment, webhook → PAID status)
- Email delivery for organization invitations
- Public marketing site / onboarding funnel
- SLA monitoring and alerting for billing/enforcement
- Customer-facing invoice PDF and payment instructions
- Data retention and GDPR export automation beyond admin exports
- Load testing at commercial scale with realistic plan tiers

### 2. What blocks first paying customers

| Blocker | Severity |
|---------|----------|
| No payment gateway — invoices stay OPEN | **Critical** |
| No automated invoice payment confirmation | **Critical** |
| No email invitation delivery | High |
| No self-service signup + org creation flow | High |
| No dunning / failed payment handling | Medium |

### 3. Free tier launch requirements

| Requirement | Status |
|-------------|--------|
| FREE plan seeded | ✅ Done |
| Plan limits enforced | ✅ Done |
| Usage tracking | ✅ Done |
| Legal pages | ✅ Done |
| Self-service registration | ⏳ Needs product decision |
| Abuse prevention (IP/signup rate limits) | ⏳ Partial (ThrottlerGuard only) |

**Free tier can launch for invited/beta users today; public self-service needs signup hardening.**

### 4. Pro tier launch requirements

| Requirement | Status |
|-------------|--------|
| PRO plan catalog + limits | ✅ Done |
| Plan change → OPEN invoice | ✅ Done |
| Payment collection | ❌ Not implemented |
| Auto-activation on payment | ❌ Not implemented |
| Pro feature differentiation in UI | ⏳ Partial (limits only) |

**Pro tier requires payment gateway before accepting money.**

### 5. Business tier launch requirements

Same as Pro, plus:

| Requirement | Status |
|-------------|--------|
| Higher limits (600 RPM, 100M tokens) | ✅ Seeded |
| Priority worker routing | ⏳ Not differentiated in workers |
| Dedicated support channel | ⏳ Support dashboard admin-only |

### 6. Enterprise tier requirements

| Requirement | Status |
|-------------|--------|
| Custom pricing / contract workflow | ⏳ Manual (ENTERPRISE tier seeded, price=0) |
| SSO / SAML | ❌ Not implemented |
| Dedicated infrastructure option | ❌ Not implemented |
| Custom SLA + DPA signing flow | ⏳ DPA page static only |
| Volume discount / committed use | ❌ Not implemented |

### 7. Platform readiness estimate

| Dimension | % |
|-----------|---|
| Core platform (assistants, KB, CRM, workflow, marketplace) | **95%** |
| Commercial infrastructure (billing, limits, exports, legal) | **88%** |
| Production parity (Stage 11 on crm-al.neeklo.ru) | **95%** |
| Revenue readiness (payment + onboarding) | **35%** |
| Enterprise readiness (SSO, SLA, dedicated) | **40%** |
| **Overall platform readiness** | **78%** |
| **Stage 12 engineering readiness** | **92%** |

---

## Recommendation

Proceed to **Stage 12 — Enterprise Launch Readiness** for SSO, SLA tooling, enterprise onboarding, and payment gateway design. Do **not** open public paid signup until payment gateway is integrated and tested end-to-end.
