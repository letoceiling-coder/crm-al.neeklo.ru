# Stage 12.1 — Pre-Deploy Audit

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Server:** `root@212.67.9.173`

---

## Git State

| Item | Value |
|------|-------|
| Branch | `feature/v2-platform` |
| Tag | `stage-12-release` |
| Baseline | Stage 11.1 (`cb6486b`) |
| Deploy rule | Committed code only |

---

## M12 Migrations

| Migration | Status |
|-----------|--------|
| M12_0 `20250610120000_m12_0_payment_providers` | ✅ |
| M12_1 `20250610120100_m12_1_payments` | ✅ |
| M12_2 `20250610120200_m12_2_payment_events` | ✅ |

**Expected migrations after deploy:** 71

---

## Module Audit

| Module | Path | Status |
|--------|------|--------|
| PaymentsModule | `apps/api/src/payments/` | ✅ |
| EmailModule | `apps/api/src/email/` | ✅ |
| SignupService | `apps/api/src/auth/signup.service.ts` | ✅ |
| OnboardingModule | `apps/api/src/onboarding/` | ✅ |
| EnterpriseModule | `apps/api/src/enterprise/` | ✅ |
| AlertingModule | `apps/api/src/alerting/` | ✅ |

---

## Production Baseline (Stage 11.1)

| Item | Value |
|------|-------|
| Migrations | 69 (68 repo + 1 legacy) |
| PM2 processes | 6 |
| Deploy method | Local build + tarball |

---

## Deploy Strategy

1. `git tag stage-12-release && git push`
2. Local build API + Web
3. Tarball → scp → `deploy/stage-12-1-deploy-remote.sh`
4. Append Stage 12 env defaults if missing
5. `prisma migrate deploy` → 71
6. PM2 restart + validation scripts
