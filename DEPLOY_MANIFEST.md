# Deploy Manifest — Stage 8.5 (v2 Platform)

**Branch:** `feature/v2-platform`  
**Backup branch:** `feature/v2-platform-backup`  
**Commit:** `b73c99d6b3d413ea265a654825df69912526bc81`  
**Message:** feat: Stages 2-8.5 platform — knowledge, tools, CRM, workflows, memory, integrations  
**Date:** 2026-06-07  
**Target:** https://crm-al.neeklo.ru (`212.67.9.173`)

---

## Migration count

**54** migrations (`apps/api/prisma/migrations`)

| Stage | IDs |
|-------|-----|
| Legacy | `20250602120000` … `20250602180000` (7) |
| M0 | `m0_0_organization_foundation`, `m0_4_token_cost_snapshots`, `m0_5_provider_accounts`, `m0_8_pgvector_embedding_foundation` |
| M1 | `m1_0_agent_templates` … `m1_3_agent_variables` |
| M2 | `m2_0_knowledge_bases` … `m2_7_chunks_embeddings` |
| M3 | `m3_0_assistant_knowledge_bindings`, `m3_1_retrieval_logs` |
| M4 | `m4_0_tool_providers` … `m4_4_tool_execution_logs` |
| M5 | `m5_0_crm_workspace` … `m5_6_crm_activities` |
| M6 | `m6_0_workflows` … `m6_4_workflow_execution_logs` |
| M7 | `m7_0_memory_profiles` … `m7_4_memory_search_logs` |
| M8 | `m8_0_integration_providers` … `m8_4_integration_events` |
| M8.5 | `m8_5_0_workflow_hardening`, `m8_5_1_workflow_templates` |

**Last migration:** `20250609186000_m8_5_1_workflow_templates`

---

## Environment variables (production)

From `apps/api/.env.example` — server `.env` must include:

| Variable | Required |
|----------|----------|
| `DATABASE_URL` | ✅ |
| `REDIS_URL` | ✅ |
| `JWT_SECRET` | ✅ |
| `SECRET_ENCRYPTION_KEY` | ✅ |
| `PORT` | ✅ (3075 on prod) |
| `CORS_ORIGIN` | ✅ |
| `OPENROUTER_DEFAULT_KEY` | recommended |
| `PARSER_BASE_URL`, `PARSER_API_KEY` | knowledge ingest |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | document storage |
| `BULL_BOARD_PATH` | optional |

---

## Seed scripts

| Script | Purpose |
|--------|---------|
| `apps/api/prisma/seed.ts` | Users, orgs, models, provider accounts |
| `apps/api/prisma/seed-agent-templates.ts` | 10 assistant templates |
| `apps/api/prisma/seed-tools.ts` | Tool catalog (telegram, max, email, CRM tools) |

Run: `npm run db:seed` from repo root.

Integration providers and workflow templates are seeded via **migrations** M8_0 and M8_5_1.

---

## Build & deploy commands

```bash
# Local
git archive -o stage-8-7-deploy.tgz HEAD
scp stage-8-7-deploy.tgz root@212.67.9.173:/tmp/
scp deploy/stage-8-7-deploy-remote.sh root@212.67.9.173:/tmp/

# Server
bash /tmp/stage-8-7-deploy-remote.sh
```

---

## PM2

| Process | Role |
|---------|------|
| `crm-al-tokens-api` | API + in-process BullMQ workers (knowledge, workflow, memory, parser) |

Workers run inside NestJS (`knowledge-processors`, `workflow.processors`, `memory.processors`) — no separate PM2 apps.

---

## Post-deploy verification

1. `npx prisma migrate status` → 54 migrations, up to date  
2. API routes → 401/200 (not 404)  
3. UI bundle → all 8 menu labels  
4. `python3 /tmp/stage-8-7-smoke-test.py`
