# Stage 9 — Marketplace Platform Report

**Date:** 2026-06-07  
**Architecture:** v2.3.1  
**Production:** https://crm-al.neeklo.ru  
**Branch:** `feature/v2-platform`  
**Scope:** Marketplace for publishing/installing AI Assistants, Workflows, Tools, Knowledge Templates, Automation Packages between organizations

---

## Executive Summary

Stage 9 implements a **clone-only Marketplace Platform** — no cross-tenant entity references. Packages are published with versioned manifests; installation validates visibility, clones entities into the target organization, and records an install log with local entity IDs only.

| Verdict | Stage 10 Enterprise Scale Platform |
|---------|-------------------------------------|
| **GO** | All Stage 9 deliverables implemented; local build + 14 unit tests PASS |

---

## Design Principles

| Principle | Implementation |
|-----------|----------------|
| No cross-tenant refs | `KeyAgent.templateId = null`, `Workflow.sourceTemplateId = null` on clone |
| Clone-only install | `MarketplaceCloneService` creates new org-scoped entities |
| Install audit | `MarketplaceInstall.clonedEntities` JSON with local IDs |
| Tenant visibility | PUBLIC / PRIVATE / ORG_ONLY via `marketplaceBrowseWhere()` |
| Semver versioning | `1.0.0`, `1.1.0`, `2.0.0` — unique per package |

---

## Database Migrations

| Migration | Table / Enums |
|-----------|---------------|
| M9_0 | `marketplace_packages`, package type/status/visibility enums |
| M9_1 | `marketplace_versions` |
| M9_2 | `marketplace_installs`, install status enum |
| M9_3 | `marketplace_reviews` |
| M9_4 | `marketplace_categories` + 11 seeded categories |
| M9_5 | `marketplace_assets`, asset type enum |

**Total migrations after Stage 9:** 60 (M0_0 → M9_5)

### Seeded Categories

Ассистенты, Продажи, Юристы, Маркетинг, Поддержка, Недвижимость, Образование, CRM, Автоматизация, Базы знаний, Интеграции

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/marketplace/packages` | Browse / my packages (`?mine=true`) |
| POST | `/api/v1/marketplace/packages` | Create draft package |
| GET | `/api/v1/marketplace/packages/:id` | Detail (+ download counter) |
| PATCH | `/api/v1/marketplace/packages/:id` | Update metadata |
| POST | `/api/v1/marketplace/packages/:id/publish` | Publish semver version |
| POST | `/api/v1/marketplace/packages/:id/unpublish` | Archive package |
| GET | `/api/v1/marketplace/packages/:id/analytics` | Author analytics |
| GET | `/api/v1/marketplace/categories` | List categories |
| POST | `/api/v1/marketplace/install` | Install (validate → clone → log) |
| GET | `/api/v1/marketplace/installed` | Org install history |
| GET/POST | `/api/v1/marketplace/reviews` | Reviews |
| GET | `/api/v1/marketplace/featured` | Featured / Popular / New / Top Rated / Most Installed |

---

## Install Pipeline

```
Marketplace Package (published version)
        ↓
   Validate visibility + semver
        ↓
   Clone entities (assistant/workflow/tools/KB)
        ↓
   Organization (local copies only)
        ↓
   MarketplaceInstall log + stats update
```

---

## UI Pages

| Route | Page |
|-------|------|
| `/marketplace` | Catalog + featured sections |
| `/marketplace/package/:id` | Detail, install, reviews, versions |
| `/marketplace/publish` | Create + publish v1.0.0 |
| `/marketplace/my` | Author packages + unpublish |
| `/marketplace/installed` | Install log with cloned entity refs |

Sidebar: **Marketplace** menu item added.

---

## Module Structure

```
apps/api/src/marketplace/
├── marketplace.module.ts
├── marketplace.controller.ts
├── marketplace-package.service.ts
├── marketplace-category.service.ts
├── marketplace-install.service.ts
├── marketplace-clone.service.ts
├── marketplace-review.service.ts
├── marketplace-featured.service.ts
├── marketplace-visibility.util.ts
├── marketplace.types.ts
├── dto/marketplace.dto.ts
└── stage-9-marketplace-platform.spec.ts
```

---

## Tests

**File:** `apps/api/src/marketplace/stage-9-marketplace-platform.spec.ts`

| Area | Tests | Status |
|------|-------|--------|
| Tenant isolation (visibility) | 3 | PASS |
| Publish & versioning | 4 | PASS |
| Clone validation | 2 | PASS |
| Install pipeline | 2 | PASS |
| Review system | 2 | PASS |
| Featured / analytics | 1 | PASS |

**Total: 14/14 PASS**

---

## Build Verification

| Component | Command | Result |
|-----------|---------|--------|
| Prisma generate | `npx prisma generate` | PASS |
| API build | `npm run build` (apps/api) | PASS |
| Web build | `npm run build` (apps/web) | PASS |
| Stage 9 tests | `jest stage-9-marketplace-platform.spec.ts` | 14 PASS |

---

## Analytics (Author)

`GET /packages/:id/analytics` returns:

- Downloads, Installs, Active Installs
- Rating, Rating Count
- Version Distribution
- Recent Installs

---

## Assets (S3)

`MarketplaceAsset` model supports ICON, BANNER, SCREENSHOT, FILE.  
`StorageFolder` extended with `marketplace` for Selectel S3 keys: `{orgId}/marketplace/...`

Upload API for assets can be wired in Stage 10; schema and storage folder are ready.

---

## Production Deployment Notes

Before production parity:

1. Apply migrations M9_0 → M9_5 on production PostgreSQL
2. Deploy API + web build tarball (same process as Stage 8.7/8.8)
3. Smoke: categories list, publish assistant package, install from second org, verify clone IDs in install log

---

## GO / NO-GO — Stage 10 Enterprise Scale Platform

| Criterion | Status |
|-----------|--------|
| 6 marketplace migrations | ✅ |
| 5 package types enum | ✅ |
| Clone-only install (no shared refs) | ✅ |
| Tenant visibility isolation | ✅ |
| Semver versioning | ✅ |
| Reviews + rating aggregate | ✅ |
| Featured sections API | ✅ |
| UI routes + sidebar | ✅ |
| Unit tests | ✅ 14/14 |
| API + Web build | ✅ |

### Verdict: **GO** for Stage 10 Enterprise Scale Platform

**Caveat:** Production deploy of M9 migrations pending; local implementation complete and validated.

---

## Files Changed (Summary)

- `apps/api/prisma/schema.prisma` — 6 models + 5 enums
- `apps/api/prisma/migrations/20250609187000_m9_0_*` … `m9_5_*`
- `apps/api/src/marketplace/*` — full NestJS module
- `apps/api/src/app.module.ts` — MarketplaceModule registered
- `apps/api/src/storage/storage.service.ts` — `marketplace` folder
- `apps/web/src/lib/marketplace.ts`
- `apps/web/src/pages/marketplace/*` — 5 pages
- `apps/web/src/App.tsx`, `sidebar.tsx`
