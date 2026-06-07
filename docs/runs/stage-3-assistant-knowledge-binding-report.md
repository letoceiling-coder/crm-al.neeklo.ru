# Stage 3 — Assistant Knowledge Binding + Retrieval Report

**Date:** 2026-06-07  
**Branch:** `feature/v2-platform`  
**Architecture:** v2.3.1 (frozen)  
**Scope:** Assistant ↔ Knowledge Base binding, retrieval pipeline, context builder, debug mode — **без** Tools, CRM, Workflow, Memory, Marketplace, Agent Runtime Extensions

---

## Summary

| Deliverable | Status |
|-------------|--------|
| M3_0 AssistantKnowledgeBinding | ✅ |
| M3_1 RetrievalLog | ✅ |
| AssistantKnowledgeBindingService (CRUD + tenant isolation) | ✅ |
| RetrievalService searchWithMode (KEYWORD / VECTOR / HYBRID) | ✅ |
| AssistantContextService pipeline | ✅ |
| AssistantChatService + debug sources | ✅ |
| API endpoints (bindings, preview, chat) | ✅ |
| UI: вкладка «Базы знаний» + context preview + debug toggle | ✅ |
| Tests (12 Stage 3) | ✅ PASS |
| API build | ✅ PASS |
| Web build | ✅ PASS |

---

## Migrations

| ID | File | Changes |
|----|------|---------|
| M3_0 | `20250609130000_m3_0_assistant_knowledge_bindings` | `assistant_knowledge_bindings`, enum `AssistantSearchMode` |
| M3_1 | `20250609131000_m3_1_retrieval_logs` | `retrieval_logs` audit table |

**Total migrations after deploy:** 25

---

## Models

### AssistantKnowledgeBinding

| Field | Type | Notes |
|-------|------|-------|
| assistantId | FK → `key_agents` | Assistant = KeyAgent |
| knowledgeBaseId | FK → `knowledge_bases` | Unique per assistant |
| enabled | boolean | Default true |
| priority | int | Lower = higher priority |
| maxChunks | int | Per-binding retrieval limit |
| maxTokens | int | Context token budget |
| searchMode | KEYWORD / VECTOR / HYBRID | Default HYBRID |
| keywordWeight / vectorWeight | float | Hybrid weights (0.3 / 0.7) |

### RetrievalLog

Stores per-binding retrieval audit: `query`, `searchMode`, `chunksFound`, `chunksUsed`, `tokensUsed`, `latencyMs`, `metadata`.

---

## Pipeline

```text
Question
  ↓
AssistantKnowledgeBinding (enabled, by priority)
  ↓
RetrievalService.searchWithMode (per KB)
  ↓
Deduplicate chunks (best score)
  ↓
Trim to token budget
  ↓
Format context text
  ↓
RetrievalLog (per binding)
  ↓
LLM (OpenRouter) — AssistantChatService
```

---

## Search Modes

| Mode | RetrievalService method |
|------|-------------------------|
| KEYWORD | `searchByKeyword` |
| VECTOR | `searchByVector` |
| HYBRID | `hybridSearch` (weighted merge) |

Extended `RetrievalService` with `searchWithMode()` and weighted `hybridSearch()` options.

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/assistants/:id/knowledge-bindings` | List bindings |
| POST | `/api/v1/assistants/:id/knowledge-bindings` | Create/upsert binding |
| PATCH | `/api/v1/assistants/:id/knowledge-bindings/:bindingId` | Update binding |
| DELETE | `/api/v1/assistants/:id/knowledge-bindings/:bindingId` | Remove binding |
| POST | `/api/v1/assistants/:id/context-preview` | Preview retrieval context |
| POST | `/api/v1/assistants/:id/chat` | Chat with KB context + optional debug sources |

**Note:** Gateway `/v1/agents/:agentId/chat` (global `Agent` model) is unchanged. Stage 3 chat is on JWT-protected `/v1/assistants/:id/chat` (KeyAgent).

---

## Debug Mode

Sources returned when:
- Request body `debug: true`, **or**
- `KeyAgent.settings.showSources === true`

Response includes `sources[]`: knowledge base, document, chunk, score.

---

## UI

| Location | Feature |
|----------|---------|
| Assistant detail → **Базы знаний** | Connected KBs table (priority, status, search mode, max chunks) |
| Same tab | Add/remove bindings, enable/disable |
| Same tab | **Просмотр контекста** — document, chunk, score, KB name |
| Same tab | **Режим отладки** — toggle `showSources` (persisted in assistant settings) |
| Same tab | Test chat with sources when debug enabled |

Files:
- `apps/web/src/components/assistants/knowledge-tab.tsx`
- `apps/web/src/pages/assistants/detail.tsx`
- `apps/web/src/lib/assistants.ts` (types + labels)

---

## Tests

| Suite | Tests | Coverage |
|-------|-------|----------|
| `stage-3-assistant-knowledge-binding.spec.ts` | **12/12 PASS** | Tenant isolation, binding CRUD guards, searchWithMode routing, context builder, dedup, debug mode |

---

## Known Limitations

1. **Chat endpoint separate from Gateway Agent chat** — KeyAgent assistants only; global Agent runtime not wired in Stage 3
2. **Token estimation** — heuristic `chars/4`, not tokenizer-accurate
3. **No binding edit UI for search mode/weights** — defaults on create; PATCH API available
4. **3072-dim vectors** — same pgvector constraint as Stage 2C; latency grows with chunk count
5. **OpenRouter required** — chat fails without active ProviderAccount key
6. **Migrations not applied on production** — deploy step required (M3_0, M3_1)

---

## Verdict

### **GO** for Stage 4 — Tool Registry Platform

Ready:
- Assistants bound to knowledge bases with configurable search modes
- End-to-end retrieval → context → LLM pipeline
- Retrieval audit logs per query/binding
- Context preview and debug sources in UI
- Tenant isolation on all binding operations
- Builds and tests green

**Recommended Stage 4 entry:**
1. Apply migrations M3_0 + M3_1 on production
2. Connect at least one KB to a test assistant and verify context preview
3. Confirm OpenRouter key for assistant chat smoke test

**Out of scope (as specified):** Tools, CRM, Workflow, Memory, Marketplace, Agent Runtime Extensions — deferred to Stage 4+.

---

*Report generated as part of AI Gateway Platform v2 — Stage 3.*
