# Stage 7 — Enterprise Memory Platform Report

**Date:** 2026-06-07  
**Branch:** `feature/v2-platform`  
**Architecture:** v2.3.1 (frozen)  
**Scope:** Enterprise Memory — profiles, entries, embeddings, search, summarization, assistant/workflow integration — **без** Marketplace, External Integrations, Agent Runtime Extensions, Workflow V2 Hardening

---

## Summary

| Deliverable | Status |
|-------------|--------|
| M7_0–M7_4 migrations | ✅ |
| MemoryProfile (5 entity types) | ✅ |
| MemoryEntry (6 entry types) | ✅ |
| MemoryEmbedding (pgvector + EmbeddingProfile) | ✅ |
| MemorySummary + memory-summarize queue | ✅ |
| MemorySearchLog | ✅ |
| MemorySearchService (keyword / vector / hybrid) | ✅ |
| Plan limits (profiles, entries, storage) | ✅ |
| Assistant memory tab + chat context injection | ✅ |
| Workflow MEMORY_READ / MEMORY_WRITE steps | ✅ |
| UI: /memory, profiles, search | ✅ |
| Tests (Stage 7 spec) | ✅ PASS (7) |
| API build | ✅ PASS |
| Web build | ✅ PASS |

---

## Migrations

| ID | File | Changes |
|----|------|---------|
| M7_0 | `20250609170000_m7_0_memory_profiles` | `memory_profiles`, enums, plan limits, `MEMORY_READ`/`MEMORY_WRITE` workflow steps |
| M7_1 | `20250609171000_m7_1_memory_entries` | `memory_entries`, FTS index |
| M7_2 | `20250609172000_m7_2_memory_embeddings` | `memory_embeddings` vector(3072) |
| M7_3 | `20250609173000_m7_3_memory_summaries` | `memory_summaries` |
| M7_4 | `20250609174000_m7_4_memory_search_logs` | `memory_search_logs` |

**Total migrations after deploy:** 47

---

## Memory Profile

| Entity Type | Use Case |
|-------------|----------|
| USER | Personal long-term facts |
| ASSISTANT | Auto-created on assistant create |
| ORGANIZATION | Shared org knowledge |
| CLIENT | CRM client memory |
| WORKFLOW | Workflow-scoped memory |

Fields: `organizationId`, `entityType`, `entityId`, `name`, `settings`, `status`

---

## Memory Entry

Types: `FACT`, `SUMMARY`, `NOTE`, `PREFERENCE`, `RULE`, `OBSERVATION`

Each entry is indexed via `MemoryEmbeddingService` → org `EmbeddingProfile` → pgvector.

---

## Memory Search

`MemorySearchService`:

| Mode | Implementation |
|------|----------------|
| KEYWORD | PostgreSQL FTS on `memory_entries.content` |
| VECTOR | pgvector cosine on `memory_embeddings` |
| HYBRID | Weighted merge (0.3 keyword + 0.7 vector) |

All searches logged to `MemorySearchLog` with query, results, latency, debug metadata (match reasons).

---

## Summarization Pipeline

Queue: `memory-summarize` (BullMQ)

```
Memory Entries → MemorySummarizeService → MemorySummary record → SUMMARY entry → Embedding index
```

Trigger: `POST /v1/memory/profiles/:id/summarize`

---

## Workflow Integration

New step types:

| Step | Action |
|------|--------|
| MEMORY_READ | Hybrid search, returns hits in step output |
| MEMORY_WRITE | Creates MemoryEntry (profileId or entityType+entityId) |

---

## Assistant Integration

- Auto `MemoryProfile` on assistant create (`KeyAgentService`)
- Tab **Память** on assistant detail page
- `AssistantChatService` injects top memory hits into system prompt (separate from KB context)

---

## API Endpoints

| Route | Description |
|-------|-------------|
| `GET /v1/memory/profiles` | List profiles |
| `POST /v1/memory/profiles` | Create profile |
| `POST /v1/memory/profiles/get-or-create` | Idempotent profile |
| `GET/PATCH/DELETE /v1/memory/profiles/:id` | CRUD |
| `GET/POST /v1/memory/profiles/:id/entries` | Entry list / create |
| `POST /v1/memory/search` | Search (keyword/vector/hybrid) |
| `POST /v1/memory/profiles/:id/summarize` | Enqueue summarization |
| `GET /v1/memory/search-logs` | Search audit trail |

All routes: `TenantGuard`, organization-scoped.

---

## Plan Limits

| Field | Default |
|-------|---------|
| maxMemoryProfiles | 50 |
| maxMemoryEntries | 10,000 |
| maxMemoryStorageMb | 100 |

Enforced in `MemoryPlanLimitsService`.

---

## UI

Sidebar: **Память**

| Page | Path |
|------|------|
| Overview | `/memory` |
| Profiles | `/memory/profiles` |
| Profile detail | `/memory/profiles/:id` |
| Search + debug | `/memory/search` |
| Assistant tab | `/assistants/:id` → Память |

---

## Tests

File: `apps/api/src/memory/stage-7-memory-platform.spec.ts`

| Area | Cases |
|------|-------|
| Profile CRUD | list scope, tenant isolation, getOrCreate |
| Entry | create + workflow write |
| Search | keyword + search log |
| Embeddings | profile resolution |

**Result:** 7/7 PASS

---

## Security

- All memory entities denormalized with `organizationId`
- `assertOwned()` on profile access
- Search logs tenant-scoped

---

## Limitations (Stage 7)

1. Summarization uses deterministic merge (not LLM) — suitable for v1 pipeline proof
2. Vector search requires org `EmbeddingProfile` configured
3. CRM client memory profile not auto-created (manual get-or-create via UI/API)
4. No cross-profile memory federation (assistant + org merge in one query)

---

## Technical Debt — Stage 8.5 Workflow Hardening (NOT in Stage 7)

Recorded for future sprint:

1. **WAIT > 30 seconds** — async resume with persisted execution state
2. **BRANCH dynamic jump** — graph execution engine instead of linear runner
3. **Timezone UI** — cron schedule with timezone selector
4. **Workflow Templates** — catalog: New Lead → Telegram, New Lead → Task, Document → Index, Client → Follow-up

---

## GO / NO-GO — Stage 8 (External Integrations Platform)

### **GO**

Memory Platform is a standalone layer with:

- Complete schema and migrations
- Search (3 modes) + embeddings + summarization queue
- Assistant and Workflow integration
- Operator UI and debug search logs
- Tenant isolation and plan limits
- Passing tests and builds

External Integrations (Stage 8) can proceed; memory layer does not block connector work.

---

## Key Files

**Backend:** `apps/api/src/memory/*`, schema M7_*, workflow step executor, `assistant-chat.service.ts`  
**Frontend:** `apps/web/src/pages/memory/*`, `components/assistants/memory-tab.tsx`, sidebar routes
