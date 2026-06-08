# Stage 12.6.3 — Git Audit

**Date:** 2026-06-08  
**Branch:** `feature/v2-platform`  
**Base commit:** `2704de3` (docs: Stage 12.1 production deploy)  
**Target tag:** `stage-12-6-3-production-stable`

## Purpose

Consolidate all uncommitted Stage 12.4–12.6 work, hotfixes, deploy scripts, and run reports before commercial launch hardening (Stage 12.6.3). Stage 13 is explicitly out of scope.

## Summary

| Category | Modified | Untracked | Notes |
|----------|----------|-----------|-------|
| API core | 17 | 3 dirs | System settings, KB fixes, alerting |
| Web UI | 6 | 2 dirs | Launch Center, admin settings, KB health |
| Migrations | — | 2 | M12_4, M12_5 |
| Deploy scripts | — | 12 | Stages 12.2–12.6 |
| Docs/reports | — | 28 | Run reports + screenshots |
| Root | 1 | — | package-lock.json |

**Total:** 24 modified + ~45 untracked paths → single consolidated commit.

---

## Stage 12.6.1 — Verified in tree

| Area | Files | Change |
|------|-------|--------|
| KB taxonomy 400 fix | `knowledge/dto/knowledge-taxonomy.dto.ts` | `@IsString()` + `@MinLength(1)` (CUID IDs) |
| URL parser mode | `knowledge.utils.ts`, `ingest-runner.service.ts` | `parser-html-site` forced |
| Source health UI | `source-health-panel.tsx`, `knowledge-source.service.ts` | PENDING/PROCESSING/COMPLETED/FAILED |
| YooKassa-only admin | `system-integrations.service.ts`, `payments.tsx` | Filter + single provider UI |
| SMTP admin UI | `email.tsx` | Host/port/TLS/save/test |
| ParserClient DI hotfix | `parser-client.service.ts` | ConfigService-only (no circular DI) |
| Test payment | `system-settings.controller.ts` | `POST .../yookassa/test-payment` |

## Stage 12.6.2 — Deploy artifacts

| File | Purpose |
|------|---------|
| `deploy/stage-12-6-2-deploy-remote.sh` | Production deploy script |
| `deploy/stage-12-6-2-production-validation.py` | Post-deploy smoke |
| `docs/runs/stage-12-6-2-production-investigation.md` | Root cause: 12.6.1 never deployed |

## Stage 12.6.3 — This commit adds

| Phase | Files | Change |
|-------|-------|--------|
| SMTP 465/SSL | `common/utils/smtp-transport.util.ts`, `email.service.ts`, `system-integrations.service.ts` | Beget-compatible implicit SSL |
| Telegram alerts | `system-settings.constants.ts`, `system-integrations.service.ts`, `alerting.service.ts`, `alerts.tsx` | Optional Bot Token + Chat ID |
| Parser alerts | `ingest-runner.service.ts`, `knowledge.module.ts` | `parserFailure` on ingest error |
| Billing UX | `billing/pages.tsx`, `payments.service.ts` | Platform billing message; tenant API YooKassa-only |
| Deploy/validate | `deploy/stage-12-6-3-*` | Hardening deploy + smoke |

---

## Modified files (24)

```
apps/api/package.json
apps/api/prisma/schema.prisma
apps/api/src/alerting/alerting.service.ts
apps/api/src/app.module.ts
apps/api/src/auth/auth.controller.ts
apps/api/src/auth/signup.service.ts
apps/api/src/billing/stage-12-enterprise-launch.spec.ts
apps/api/src/email/email.service.ts
apps/api/src/knowledge/dto/knowledge-taxonomy.dto.ts
apps/api/src/knowledge/ingest-runner.service.ts
apps/api/src/knowledge/knowledge-source.service.ts
apps/api/src/knowledge/knowledge.utils.ts
apps/api/src/knowledge/knowledge.module.ts
apps/api/src/parser-client/parser-client.module.ts
apps/api/src/parser-client/parser-client.service.ts
apps/api/src/payments/providers/yookassa.adapter.ts
apps/api/src/payments/payments.service.ts
apps/api/src/secrets/secret-encryption.service.ts
apps/api/src/system/system.module.ts
apps/web/package.json
apps/web/src/App.tsx
apps/web/src/components/knowledge/source-health-panel.tsx
apps/web/src/components/layout/sidebar.tsx
apps/web/src/lib/knowledge.ts
apps/web/src/pages/billing/pages.tsx
apps/web/src/pages/system/index.tsx
package-lock.json
```

## New directories / files (untracked → added)

### API — System Settings module
- `apps/api/src/system-settings/` — controllers, services, specs, constants
- `apps/api/src/common/validators/is-cuid.validator.ts`
- `apps/api/src/common/utils/smtp-transport.util.ts`
- `apps/api/prisma/migrations/20250610120300_m12_4_system_settings/`
- `apps/api/prisma/migrations/20250610120400_m12_5_system_integrations/`

### Web — Admin panel
- `apps/web/src/lib/system-settings.ts`
- `apps/web/src/pages/system/launch.tsx`
- `apps/web/src/pages/system/settings/` — general, payments, email, alerts, parser, monitoring

### Deploy scripts
- `deploy/stage-12-2-configure-launch.sh`
- `deploy/stage-12-2-readiness-check.py`
- `deploy/stage-12-4-1-production-audit.py`
- `deploy/stage-12-4-2-deploy-remote.sh`
- `deploy/stage-12-4-2-production-validation.py`
- `deploy/stage-12-4-2-screenshots.{js,py}`
- `deploy/stage-12-5-*.py`
- `deploy/stage-12-6-2-*`
- `deploy/stage-12-6-3-*`

### Documentation (`docs/runs/`, `docs/screenshots/`)
All Stage 12.2–12.6 run reports and validation artifacts.

---

## Hotfixes included

1. **SystemModule DI** — export `SystemHealthService`, `SystemDependenciesService` (12.4.2)
2. **KB taxonomy UUID validation** — CUID-compatible DTOs (12.6.1)
3. **ParserClient circular DI** — revert to env `PARSER_API_KEY` (12.6.2)
4. **SMTP port 465** — implicit SSL via `buildSmtpTransportOptions` (12.6.3)

---

## Commit plan

```
feat(stage-12): system settings, production hardening 12.6.3

Consolidate Stage 12.4–12.6: admin System Settings (YooKassa, SMTP,
Launch Center), KB taxonomy fix, parser source health, optional
Telegram alerts, billing UX cleanup, deploy/validation scripts.
```

**Tag:** `stage-12-6-3-production-stable`

---

## Exclusions

- No `.env` or secrets committed
- Stage 13 features not included
- `node_modules/`, `dist/` remain gitignored

## Post-commit actions

1. Deploy tarball to `212.67.9.173:/var/www/crm-al-tokens`
2. Run `deploy/stage-12-6-3-deploy-remote.sh`
3. Configure YooKassa + SMTP (smtp.beget.com:465) via admin UI
4. Run `deploy/stage-12-6-3-production-validation.py`
