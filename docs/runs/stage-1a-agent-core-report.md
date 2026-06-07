# Stage 1A — Agent Core Implementation Report

**Date:** 2026-06-07  
**Branch:** `feature/v2-platform`  
**Architecture:** v2.3.1 (FROZEN)  
**Scope:** Assistant Core backend only (no KB, CRM, Tools, UI, Chat runtime)

---

## Executive Summary

Stage 1A implements the **Assistant Core domain**: templates, organization-scoped assistants (`KeyAgent`), multi-key `agt_` credentials with scopes/environments, variables, and runtime prompt rendering.

| Area | Status |
|------|--------|
| Prisma models + migrations M1_0–M1_3 | ✅ |
| Services (5) | ✅ |
| REST API `/api/v1/assistants/*` | ✅ |
| Swagger `/api/docs` | ✅ |
| Tenant isolation | ✅ |
| Unit tests | ✅ 10/10 |
| Build | ✅ PASS |

---

## Migrations

| Migration | Tables / enums |
|-----------|----------------|
| `20250608100000_m1_0_agent_templates` | `AgentType`, `AgentStatus`, `AgentApiKeyEnvironment`, `AgentApiKeyScope`, `agent_templates` |
| `20250608101000_m1_1_key_agents` | `key_agents` |
| `20250608102000_m1_2_agent_api_keys` | `agent_api_keys` |
| `20250608103000_m1_3_agent_variables` | `agent_variables` |

**Deploy:** `npx prisma migrate deploy` on server after code push.

---

## Models

### AgentTemplate (system templates)

- Fields: `name`, `slug`, `description`, `agentType`, `isPublic`, `isMarketplace`, `authorOrganizationId`, `defaultPrompt`, `defaultSettings`
- Seeded: LAWYER, MARKETING, DEVELOPER, SALES, SUPPORT, HR, REAL_ESTATE, EDUCATION, ASSISTANT, CUSTOM (`prisma/seed-agent-templates.ts`)

### KeyAgent

- Organization-scoped (`organizationId`)
- `@@unique([organizationId, slug])`
- Status: `DRAFT | ACTIVE | INACTIVE | ARCHIVED`
- Audit: `createdBy`, `updatedBy`
- Plan limit: `maxAssistants`

### AgentApiKey

- Prefix: **`agt_`**
- Multiple keys per assistant (no unique on `keyAgentId`)
- Billing parent: `apiKeyId` (org-scoped `agw_` key)
- Environments: PRODUCTION, TEST, CRM, TELEGRAM, WEBHOOK, INTERNAL
- Scopes: CHAT, TOOLS_INVOKE, KB_READ, MEMORY_READ, MEMORY_WRITE, CRM_READ, CRM_WRITE, ADMIN
- Rotation, revoke, expiration, encrypted reveal
- Plan limit: `maxAgentApiKeys`

### AgentVariable

- Per-assistant key/value store
- Standard vars supported in prompts: `{{company_name}}`, `{{phone}}`, `{{email}}`, `{{website}}`, `{{crm_url}}`

---

## Services

| Service | Responsibility |
|---------|----------------|
| `AgentTemplateService` | List/get public templates |
| `KeyAgentService` | CRUD assistants, tenant assert, slug uniqueness |
| `AgentApiKeyService` | Create/list/rotate/revoke/reveal `agt_` keys |
| `AgentVariableService` | Upsert/list/delete variables, render prompt |
| `PromptRenderService` | `{{var}}` substitution, missing placeholder detection |

---

## API Routes

Base: `/api/v1/assistants` — JWT + **TenantGuard** required.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/templates` | List public templates |
| GET | `/templates/:slug` | Template by slug |
| GET | `/` | List org assistants |
| POST | `/` | Create assistant |
| GET | `/:id` | Get assistant |
| PATCH | `/:id` | Update assistant |
| DELETE | `/:id` | Delete assistant |
| GET | `/:id/keys` | List agent API keys |
| POST | `/:id/keys` | Create `agt_` key |
| POST | `/:id/keys/:keyId/rotate` | Rotate key |
| POST | `/:id/keys/:keyId/revoke` | Revoke key |
| GET | `/:id/keys/:keyId/reveal` | Reveal plaintext (encrypted storage) |
| GET | `/:id/variables` | List variables |
| POST | `/:id/variables` | Upsert variables |
| DELETE | `/:id/variables/:key` | Delete variable |
| POST | `/:id/render-prompt` | Render system prompt with variables |

**Swagger:** `GET /api/docs`

---

## Security Review

| Control | Implementation |
|---------|----------------|
| TenantGuard | Global; all assistant routes use `AuthGuard('jwt')` + `TenantGuard` |
| Org scoping | Every `KeyAgent` query filters `organizationId`; `assertOwned()` blocks cross-tenant |
| Billing key | `AgentApiKey.apiKeyId` validated against same organization |
| Body override | TenantGuard rejects `organizationId` in body (existing Stage 0) |
| Secrets | `agt_` keys hashed (SHA-256); plaintext encrypted at rest; stripped in list responses |
| Revocation | `status=INACTIVE`, `revokedAt` set; rotation invalidates old hash |

**Not in Stage 1A (later stages):** `agt_` bearer auth on gateway chat, scope enforcement at runtime.

---

## Tests

| File | Cases |
|------|-------|
| `key-agent.service.spec.ts` | Cross-tenant forbidden, org list scope (4) |
| `agent-api-key.service.spec.ts` | Rotate hash, revoke status (2) |
| `prompt-render.service.spec.ts` | Variable render, missing detection (4) |

```bash
npm test -- --testPathPattern=assistants  # 10/10 PASS
npm run build                             # PASS
```

---

## Out of Scope (confirmed not implemented)

- KnowledgeBase, KnowledgeSource, KnowledgeDocument
- Tool Registry, CRM, Memory, Workflow
- Chat runtime, RAG, `POST /assistants/:slug/chat`
- Agent UI Builder / frontend

Legacy global `Agent` model (v1 seed agents) **unchanged** for backward compatibility.

---

## Production Readiness

| Step | Status |
|------|--------|
| Local build + tests | ✅ |
| Migrations on production | ⏳ Pending deploy |
| Seed templates on production | ⏳ Run `npm run db:seed` after migrate |
| Server PM2 restart | ⏳ After deploy |

**Deploy checklist:**

1. Push/sync `feature/v2-platform` to server
2. `npm install` (adds `@nestjs/swagger@7`)
3. `npx prisma migrate deploy` (4 new migrations)
4. `npm run db:seed` (templates)
5. `npm run build --workspace=apps/api`
6. `pm2 restart crm-al-tokens-api --update-env`
7. Verify `https://crm-al.neeklo.ru/api/docs`

---

## Stage 1B Verdict

# GO

Assistant Core backend is complete per v2.3.1 Stage 1 scope. **Stage 1B (Agent UI)** may begin after server migration deploy (recommended before UI integration testing against production).

**Conditions for production GO:**

- M1 migrations applied on server
- Template seed executed
- Swagger reachable at `/api/docs`

---

## Files Added / Modified

**New module:** `apps/api/src/assistants/`  
**Migrations:** `apps/api/prisma/migrations/2025060810*`  
**Seed:** `apps/api/prisma/seed-agent-templates.ts`  
**Crypto:** `generateAgentApiKey()` in `crypto.util.ts`  
**Swagger:** `main.ts`, `@nestjs/swagger@7`
