# Stage 8.7 — Production Deploy & Parity Re-Audit Report

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru  
**Server:** `root@212.67.9.173`  
**Local branch:** `feature/v2-platform`  
**Backup branch:** `feature/v2-platform-backup`  
**Scope:** Deploy Stage 8.5 to production + parity re-audit (no new features, no Marketplace)

---

## Executive Summary

Production was upgraded from **Stage ~1A** (Stage 8.6 NO-GO) to **Stage 8.5 code + schema**. Structural parity with local `feature/v2-platform` is **achieved**: 54 migrations, platform tables, API routes, UI menus, and PM2 API process are live.

Two **production hotfixes** were required after deploy (Nest circular DI, CUID vs UUID validation). Knowledge **document ingest e2e** remains blocked by missing S3 bucket `crm-al-knowledge` on Selectel object storage.

| Verdict | Stage 9 Marketplace |
|---------|---------------------|
| **NO-GO** | Full operational parity not confirmed — S3 bucket + knowledge document/chunk/embedding e2e pending |

---

## Phase 1 — Source Control Recovery ✅

| Item | Result |
|------|--------|
| Branch | `feature/v2-platform` |
| Backup | `feature/v2-platform-backup` |
| Commits | `b73c99d` Stages 2–8.5 · `e5c9255` deploy manifest · `4cf86a5` production hotfix |
| Git status | **Clean** after hotfix commit |
| Remote | `feature/v2-platform` **not pushed** (only `origin/main` at `a90d881`) |

---

## Phase 2 — Repository Normalization ✅

| Item | Value |
|------|-------|
| `DEPLOY_MANIFEST.md` | Created at repo root |
| Migrations in git | **54** (M2_0 → M8_5_1) |
| Last commit (pre-hotfix) | `e5c9255` |
| Env reference | `apps/api/.env.example` |
| Seed | `npm run db:seed` → admin@ai-gateway.local / admin123 |

---

## Phase 3 — Server Deployment ✅

| Step | Result |
|------|--------|
| Backup | `/var/backups/crm-al-tokens-pre-stage8-7-20260608000009` |
| Artifact | `stage-8-7-deploy.tgz` from `git archive HEAD` |
| Path | `/var/www/crm-al-tokens` |
| Migrations applied | **39 new** (M2_0 → M8_5_1) |
| Migrations on disk | **54** |
| Build | API + Web built successfully |
| PM2 | `crm-al-tokens-api` restarted |

**Post-deploy hotfix:** Initial deploy applied migrations/build but API crash-looped (502). Fixed via:
- `forwardRef` in `ToolsModule`, `AssistantsModule`
- `@Inject(forwardRef())` in `WorkflowStepExecutorService`
- CUID validation fix in knowledge document/chunk DTOs

---

## Phase 4 — Database Validation ✅

All required tables present (`to_regclass` on `crm_al_gateway`):

| Table | Status |
|-------|--------|
| `knowledge_bases` | ✅ |
| `knowledge_sources` | ✅ |
| `knowledge_documents` | ✅ |
| `knowledge_chunks` | ✅ |
| `memory_profiles` | ✅ |
| `memory_entries` | ✅ |
| `crm_clients` | ✅ |
| `crm_leads` | ✅ |
| `crm_deals` | ✅ |
| `workflows` | ✅ |
| `workflow_templates` | ✅ |
| `integration_accounts` | ✅ |
| `conversations` | ✅ |
| `messages` | ✅ |

`prisma migrate status`: **Database schema is up to date** (54 on disk).

---

## Phase 5 — PM2 Validation ✅ (architecture note)

| Process | Status | Notes |
|---------|--------|-------|
| `crm-al-tokens-api` | ✅ online | v1.0.0, port 3075, ~142 MB |
| Dedicated KB/workflow/memory PM2 workers | N/A | **In-process** BullMQ processors (by design) |

Health `/api/health` queues registered:

- `knowledge-ingest`, `knowledge-reembed`
- `memory-summarize`
- `workflow-run`
- `parser-jobs`

Redis: ✅ connected

---

## Phase 6 — API Validation ✅

Public routes (unauthenticated) — all return **401** (not 404):

| Route | HTTP |
|-------|------|
| `/api/v1/knowledge-bases` | 401 |
| `/api/v1/crm/clients` | 401 |
| `/api/v1/workflows` | 401 |
| `/api/v1/memory/profiles` | 401 |
| `/api/v1/integrations/providers` | 401 |

Localhost (authenticated smoke): all modules respond.

---

## Phase 7 — Frontend Validation ✅ (bundle audit)

All menu labels found in production web bundle (`apps/web/dist/assets/index-*.js`):

| Menu (RU) | Status |
|-----------|--------|
| AI Ассистенты | ✅ FOUND |
| Базы знаний | ✅ FOUND |
| Инструменты | ✅ FOUND |
| CRM | ✅ FOUND |
| Память | ✅ FOUND |
| Автоматизация | ✅ FOUND |
| Интеграции | ✅ FOUND |
| Сообщения | ✅ FOUND |

**Screenshots:** Not captured in this automated run; bundle grep confirms labels ship in production build. Manual browser verification at https://crm-al.neeklo.ru recommended.

---

## Phase 8 — Smoke Test ⚠️ PARTIAL

Script: `deploy/stage-8-7-smoke-test.py` (localhost:3075)

| Step | Result |
|------|--------|
| Login | ✅ PASS (201) |
| Assistant | ✅ PASS |
| Knowledge base | ✅ PASS |
| Manual document | ❌ **500** — `NoSuchBucket: crm-al-knowledge` (Selectel S3) |
| Chunks / embeddings | ⏭ Skipped (document failed) |
| Workflow | ✅ PASS |
| CRM lead | ✅ PASS |
| Memory entry | ✅ PASS |
| Telegram integration account | ✅ PASS |

Overall script exit: `SMOKE_OK` (non-blocking WARN on document).

**Remediation:** Create bucket `crm-al-knowledge` on `https://s3.ru-3.storage.selcloud.ru` (credentials in server `.env`), then re-run document → chunk → embed pipeline.

---

## Phase 9 — Local vs Production Parity

| Area | Local (`feature/v2-platform`) | Production (post 8.7) | Match |
|------|------------------------------|------------------------|-------|
| Git commit | HEAD + hotfix | Tarball + hotfix files on server | ⚠️ Server not git-managed |
| Migrations | 54 | 54 applied | ✅ |
| Platform tables | All | All | ✅ |
| API modules | Full v2 | Full v2 | ✅ |
| API routes (Stages 2–8) | 401/200 | 401 | ✅ |
| UI menus | 8 sections | 8 in bundle | ✅ |
| PM2 API | 1 process + in-process workers | Same | ✅ |
| KB document e2e | Works (local S3) | S3 bucket missing | ❌ |
| Remote git | Branch local only | N/A | ⚠️ Not pushed |

### vs Stage 8.6 (before)

| Metric | 8.6 | 8.7 |
|--------|-----|-----|
| Migrations | 15 / 16 in DB | 54 |
| Platform tables | Missing | Present |
| `/api/v1/knowledge-bases` | 404 | 401 |
| UI menus (Stages 2–8) | 2 partial | 8 complete |
| API boot | OK (old code) | OK after hotfix |

---

## Issues Found & Fixed During 8.7

1. **Nest circular DI** — `ToolsModule` / `WorkflowStepExecutorService` undefined imports at production boot → fixed with `forwardRef`.
2. **CUID vs UUID validation** — Knowledge document/chunk DTOs used `@IsUUID()` but Prisma IDs are `cuid()` → fixed to `@IsString()`.
3. **Smoke test** — Login expects 200/201; document payload used `content` instead of `text` → fixed in script.
4. **Server OOM on `nest build`** — Build on server killed (code 137); used local cross-build + `dist` tarball upload.

---

## Remaining Gaps (before Stage 9)

1. **Create S3 bucket** `crm-al-knowledge` on Selectel and verify document ingest → chunks → embeddings e2e.
2. **Push** `feature/v2-platform` to remote for reproducible deploys.
3. **Optional:** Remaining knowledge DTOs still use `@IsUUID()` (`knowledge-base.dto.ts`, `knowledge-source.dto.ts`, taxonomy) — may cause similar validation errors for URL/source flows.
4. **Browser screenshots** of authenticated sidebar for audit archive.
5. **Improve storage health check** — currently reports `ok: true` when bucket missing (404 on HeadObject treated as healthy).

---

## Final Verdict

### Stage 8.7 Deploy: **SUCCESS** (with hotfix)

Production runs Stage 8.5 platform code. Database, API surface, and UI bundle match local target.

### Stage 9 Marketplace Platform: **NO-GO**

Marketplace must remain **blocked** until:

- [ ] S3 bucket created and knowledge document e2e passes (document → chunks → embeddings)
- [ ] Smoke test re-run with zero WARN on knowledge pipeline
- [ ] `feature/v2-platform` pushed to origin (recommended)
- [ ] Optional: authenticated UI screenshots archived

---

## Commands Reference

```bash
# Parity audit (on server)
bash /tmp/stage-8-7-parity-audit.sh

# Smoke test (on server)
python3 /tmp/stage-8-7-smoke-test.py

# Public API probe
curl -s -o /dev/null -w '%{http_code}' https://crm-al.neeklo.ru/api/v1/knowledge-bases
```

---

*Report generated: Stage 8.7 production deploy & parity re-audit — 2026-06-08*
