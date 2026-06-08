# Stage 9.1 — Pre-Deploy Audit

**Date:** 2026-06-07  
**Production:** https://crm-al.neeklo.ru  
**Server:** `root@212.67.9.173`  
**Local branch:** `feature/v2-platform`  
**Scope:** Marketplace (Stage 9) production deploy readiness

---

## Git Status

| Item | Value |
|------|-------|
| Branch | `feature/v2-platform` |
| HEAD (last commit) | `f4e80e6` — fix(knowledge): CUID validation for retrieval, jobs, bindings — Stage 8.8 E2E |
| Stage 9 committed | **No** — marketplace changes are **uncommitted** (working tree) |
| Remote push | `feature/v2-platform` not pushed (production deploy via tarball) |

### Modified (tracked)

- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.module.ts`
- `apps/api/src/storage/storage.service.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/components/layout/sidebar.tsx`

### Untracked (Stage 9 deliverables)

| Path | Purpose |
|------|---------|
| `apps/api/prisma/migrations/20250609187000_m9_0_marketplace_packages/` | M9_0 |
| `apps/api/prisma/migrations/20250609187100_m9_1_marketplace_versions/` | M9_1 |
| `apps/api/prisma/migrations/20250609187200_m9_2_marketplace_installs/` | M9_2 |
| `apps/api/prisma/migrations/20250609187300_m9_3_marketplace_reviews/` | M9_3 |
| `apps/api/prisma/migrations/20250609187400_m9_4_marketplace_categories/` | M9_4 |
| `apps/api/prisma/migrations/20250609187500_m9_5_marketplace_assets/` | M9_5 |
| `apps/api/src/marketplace/` | NestJS module (12 files) |
| `apps/web/src/lib/marketplace.ts` | API client |
| `apps/web/src/pages/marketplace/` | UI pages (5 routes) |
| `docs/runs/stage-9-marketplace-platform-report.md` | Stage 9 local report |

---

## Recent Commits

```
f4e80e6 fix(knowledge): CUID validation for retrieval, jobs, bindings — Stage 8.8 E2E
e691154 docs: Stage 8.7 production deploy and parity re-audit report
4cf86a5 fix(deploy): resolve Nest circular DI and CUID validation for production boot
e5c9255 docs(deploy): add Stage 8.7 deploy manifest and production scripts
b73c99d feat: Stages 2-8.5 platform — knowledge, tools, CRM, workflows, memory, integrations
```

---

## Migrations M9_0–M9_5

| Migration | Status (local) |
|-----------|----------------|
| M9_0 marketplace_packages | ✅ Present |
| M9_1 marketplace_versions | ✅ Present |
| M9_2 marketplace_installs | ✅ Present |
| M9_3 marketplace_reviews | ✅ Present |
| M9_4 marketplace_categories (+ 11 seed categories) | ✅ Present |
| M9_5 marketplace_assets | ✅ Present |

**Production (pre-deploy):** 54 migrations on disk — M9_* **not applied**

---

## Marketplace Module

| Check | Status |
|-------|--------|
| `MarketplaceModule` in `app.module.ts` | ✅ |
| Controller `@Controller('v1/marketplace')` | ✅ |
| Services: package, install, clone, review, category, featured | ✅ |
| DTOs + visibility util | ✅ |
| Unit tests `stage-9-marketplace-platform.spec.ts` | ✅ 14/14 (local) |

---

## API Routes (expected after deploy)

| Route | Method |
|-------|--------|
| `/api/v1/marketplace/packages` | GET, POST |
| `/api/v1/marketplace/packages/:id` | GET, PATCH |
| `/api/v1/marketplace/packages/:id/publish` | POST |
| `/api/v1/marketplace/categories` | GET |
| `/api/v1/marketplace/install` | POST |
| `/api/v1/marketplace/installed` | GET |
| `/api/v1/marketplace/reviews` | GET, POST |
| `/api/v1/marketplace/featured` | GET |

---

## Local Build (pre-deploy)

| Component | Result |
|-----------|--------|
| `npm run build` (apps/api) | ✅ PASS |
| `npm run build` (apps/web) | ✅ PASS |
| Web bundle includes `Marketplace` | ✅ `index-C3bV7uDT.js` |

---

## Production Baseline (pre-deploy SSH)

| Item | Value |
|------|-------|
| SSH | ✅ `root@212.67.9.173` |
| PM2 `crm-al-tokens-api` | online (port 3075) |
| `/api/health` | 200 |
| Migrations on server | 54 |

---

## Deploy Strategy

1. Build API + Web **locally** (server OOM on `nest build` — Stage 8.7 lesson)
2. Tarball: source + `dist/` + M9 migrations
3. Remote: backup → extract → preserve `.env` → `npm install` → `prisma migrate deploy` → PM2 restart
4. E2E: Org A (`admin@ai-gateway.local`) publish → Org B (`dev@ai-gateway.local`) install + review

---

## Audit Verdict

**READY TO DEPLOY** — all Stage 9 artifacts present locally; production requires M9 migrations + code deploy.
