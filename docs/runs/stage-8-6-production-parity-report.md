# Stage 8.6 — Production Parity Audit Report

**Date:** 2026-06-07  
**Production:** https://crm-al.neeklo.ru  
**Server:** `root@212.67.9.173`  
**Local branch (reference):** `feature/v2-platform`  
**Scope:** Read-only parity audit — no deploy, no new product code

---

## Executive Summary

Production **does not match** local `feature/v2-platform` (Stage 8.5). Server is deployed at **Stage ~1A** (Assistant Core + partial Stage 0 infrastructure). Stages 2–8.5 (Knowledge, Tools, CRM, Workflows, Memory, Integrations, Workflow Hardening) are **missing** from production code, database, API routes, and UI menus.

| Area | Local (feature/v2-platform) | Production |
|------|----------------------------|------------|
| Git / deploy artifact | Branch + ~54 migrations (uncommitted) | Tarball, no git, **15** migrations |
| DB migrations applied | Target **54** (incl. M8_5_0, M8_5_1) | **16** (last: M1_3) |
| Platform tables (KB/CRM/Workflow/Memory/Integrations) | Expected | **Missing** (except `organizations`) |
| API modules | Full v2 stack | **Assistants only** (+ core infra) |
| UI menus (Stages 2–8) | 8 sections | **2 partial** (AI Ассистенты, CRM label) |

---

## 1. Git

### Local workstation

| Item | Value |
|------|-------|
| Branch | `feature/v2-platform` |
| HEAD commit | `a90d881e50b534b30c0cb2e281cccfb102af5970` |
| Commit message | `release: stable v1.0.0 — AI Gateway Platform initial release` |
| Remote branches | `origin/main` only — **`feature/v2-platform` not pushed** |
| Working tree | Large set of **modified + untracked** files (Stages 0–8.5 work not committed) |

### Production server (`/var/www/crm-al-tokens`)

| Item | Value |
|------|-------|
| Git repository | **No** (tarball deploy) |
| `feature/v2-platform` on server | **No** |

**Gap:** Local Stage 8.5 code is neither committed nor deployed; remote has only `main` at v1.0.0 baseline.

---

## 2. Prisma / Migrations

### Local (`apps/api/prisma/migrations`)

| Item | Value |
|------|-------|
| Migration folders | **54** |
| Last migration | `20250609186000_m8_5_1_workflow_templates` |
| M8_5_0 | ✅ present locally |
| M8_5_1 | ✅ present locally |

### Production

| Item | Value |
|------|-------|
| Migration folders on disk | **15** |
| Last on disk | `20250608103000_m1_3_agent_variables` |
| `prisma migrate status` | **Up to date** (15/15 on disk) |
| Applied in DB (`_prisma_migrations`) | **16** rows |
| Last applied (with timestamp) | `20250608103000_m1_3_agent_variables` (2026-06-07 21:43 UTC) |
| M8_5_0 `20250609185000_m8_5_0_workflow_hardening` | ❌ **applied = 0** |
| M8_5_1 `20250609186000_m8_5_1_workflow_templates` | ❌ **applied = 0** |

**Gap:** Production is **39 migrations behind** local target (54 − 15 on disk). Stages M2–M8_5 not deployed.

---

## 3. Database Tables

Checked via `to_regclass` on production DB `crm_al_gateway`:

| Table | Production |
|-------|------------|
| `organizations` | ✅ exists |
| `knowledge_bases` | ❌ null |
| `knowledge_sources` | ❌ null |
| `knowledge_documents` | ❌ null |
| `knowledge_chunks` | ❌ null |
| `memory_profiles` | ❌ null |
| `workflows` | ❌ null |
| `workflow_templates` | ❌ null |
| `integration_accounts` | ❌ null |
| `conversations` | ❌ null |
| `messages` | ❌ null |
| `crm_clients` | ❌ null |
| `crm_leads` | ❌ null |

**Gap:** Only Stage 0 organization foundation present; platform tables for Stages 2–8 absent.

---

## 4. PM2 / Processes

| Process | Status | Notes |
|---------|--------|-------|
| `crm-al-tokens-api` | ✅ online | v1.0.0, cwd `/var/www/crm-al-tokens/apps/api`, restarts: 4, uptime ~2h at audit |
| Dedicated `web` PM2 | ❌ | Static SPA served via nginx |
| `crm-al` knowledge workers | ❌ | Not in PM2 list |
| `crm-al` workflow workers | ❌ | Not in PM2 list |
| Other workers on host | Present | `academi-*`, `parser-*`, etc. (other projects) |

**Deployed API modules** (`app.module.js`): Config, Prisma, Tenant, Organizations, Secrets, ProviderAccounts, TokenCost, Queue, Parser, Storage, Embedding, Health, **Assistants**, Auth, Users, API Keys, Models, Agents, Gateway, Usage, Audit.

**Missing modules:** Knowledge, Tools, CRM, Workflows, Memory, Integrations.

---

## 5. Redis / BullMQ

| Check | Result |
|-------|--------|
| Redis reachable | ✅ `redis: true` |
| `knowledge-ingest` | registered, 0 waiting/active/failed |
| `knowledge-reembed` | registered, 0 waiting/active/failed |
| `memory-summarize` | registered, 0 waiting/active/failed |
| `workflow-run` | registered, 0 waiting/active/failed |
| `parser-jobs` | registered, 0 waiting/active/failed |
| `workflow-retry` / `workflow-dlq` / `workflow-schedule` | ❌ not exposed in health (modules not loaded) |

**Note:** Queue **names** exist in `QueueMonitoringService` (Stage 0 infra), but **no API processors/workers** for Knowledge/Workflow/Memory pipelines on this deploy.

---

## 6. API Endpoints

Public / localhost checks on production:

| Endpoint | HTTP | Expected (Stage 8.5) |
|----------|------|----------------------|
| `/api/health` | **200** | ✅ |
| `/api/docs` | **200** | ✅ |
| `/api/v1/assistants` | **401** | ✅ (route exists, auth required) |
| `/api/v1/workflows` | **404** | ❌ should be 401 |
| `/api/v1/memory/profiles` | **404** | ❌ |
| `/api/v1/crm/clients` | **404** | ❌ |
| `/api/v1/knowledge-bases` | **404** | ❌ |
| `/api/v1/integrations/providers` | **404** | ❌ |
| `/api/v1/workflows/templates` | **404** | ❌ |
| `/api/v1/workflows/metrics` | **404** | ❌ |

---

## 7. Frontend Menus

Production bundle: `apps/web/dist/assets/index-iPdaDKWt.js`

| Menu (required) | Production |
|-----------------|------------|
| AI Ассистенты | ✅ FOUND |
| Базы знаний | ❌ MISSING |
| Инструменты | ❌ MISSING |
| CRM | ✅ FOUND (label only; API 404) |
| Память | ❌ MISSING |
| Автоматизация | ❌ MISSING |
| Интеграции | ❌ MISSING |
| Сообщения | ❌ MISSING |

**Gap:** Web build on server matches **partial Stage 1** UI, not Stage 8.5 sidebar.

---

## 8. Local vs Production Matrix

| Stage | Local | Production |
|-------|-------|------------|
| 0 — Organization foundation | ✅ | ✅ |
| 1 — Assistant Core | ✅ | ✅ |
| 2 — Knowledge Platform | ✅ code | ❌ |
| 3 — Assistant ↔ KB binding | ✅ code | ❌ |
| 4 — Tool Registry | ✅ code | ❌ |
| 5 — CRM Platform | ✅ code | ❌ |
| 6 — Workflow Engine | ✅ code | ❌ |
| 7 — Memory Platform | ✅ code | ❌ |
| 8 — External Integrations | ✅ code | ❌ |
| 8.5 — Workflow Hardening | ✅ code (local) | ❌ |

---

## 9. Blockers Before Stage 9

1. **Commit & push** `feature/v2-platform` (or merge to deploy branch)
2. **Deploy** API + web artifacts to `/var/www/crm-al-tokens`
3. **`npx prisma migrate deploy`** — apply M2_0 through M8_5_1 (39 pending migrations)
4. **Run seeds** (tools, integration providers, workflow templates)
5. **Restart** `crm-al-tokens-api` PM2; verify workers/queues
6. **Smoke test** all `/api/v1/*` routes and UI menus on https://crm-al.neeklo.ru

---

## 10. Audit Method

- Local: `git status`, migration folder count
- Remote: SSH audit script `deploy/stage-8-6-production-audit.sh` executed on `212.67.9.173`
- Public HTTP probes via PowerShell `Invoke-WebRequest`

---

## Verdict

# NO-GO — Stage 9 Marketplace Platform

Production at https://crm-al.neeklo.ru is **not parity** with local `feature/v2-platform` / Stage 8.5:

- `feature/v2-platform` is **not on the remote** and Stage 2–8.5 work is **uncommitted**
- Production DB stops at **M1_3** (16 migrations); **M8_5_0 / M8_5_1 absent**
- Platform tables, API routes, and UI for Knowledge, Tools, CRM, Workflows, Memory, Integrations are **missing**

**Stage 9 Marketplace must not start** until a full production deploy and parity re-audit pass.

---

## Recommended Next Step

**Stage 8.7 — Production Deploy & Parity Re-Audit** (not in scope here):

1. Commit local work → push branch  
2. Deploy + migrate through M8_5_1  
3. Re-run this audit checklist  
4. Issue GO for Stage 9 only after parity confirmed
