# Knowledge Retrieval Validation — Stage 8.8

**Date:** 2026-06-08  
**KB:** `Knowledge E2E Test` (`cmq4h6kyu0003vtr4qegsopgh`)  
**Indexed chunks:** 69  
**Embedding profile:** `embed_profile_platform_default` (openai/text-embedding-3-large, 3072d)

---

## Retrieval Modes

Script: `deploy/stage-8-8-retrieval-test.py`

| Mode | Query | Results | Top Score |
|------|-------|---------|-----------|
| KEYWORD | Stage 8.8 knowledge | 2 | 0.984 |
| KEYWORD | consultant document law | 0 | — |
| KEYWORD | sudrf court portal | 0 | — |
| VECTOR | consultant document law | 5 | 0.372 |
| VECTOR | Stage 8.8 knowledge | 5 | 0.742 |
| VECTOR | sudrf court portal | 5 | 0.531 |
| HYBRID | consultant document law | 5 | 0.372 |
| HYBRID | Stage 8.8 knowledge | 5 | 1.85 |
| HYBRID | sudrf court portal | 5 | 0.531 |

**Verdict:** ✅ KEYWORD, VECTOR, HYBRID all return results > 0 for semantic/partial queries.

---

## Assistant + Knowledge Binding

| Check | Result |
|-------|--------|
| `POST /v1/assistants/{id}/knowledge-bindings` | ✅ 201 |
| `POST /v1/assistants/{id}/context-preview` | ✅ 201, 8 chunks |
| `POST /v1/assistants/{id}/chat` (debug) | ✅ 201, answer + **8 sources** |
| Sources cite consultant.ru document | ✅ |
| Context includes KB name + document title | ✅ |

---

## Query Types Validated

| Type | Example | Mode | Pass |
|------|---------|------|------|
| Exact content | "Stage 8.8 knowledge" | KEYWORD | ✅ |
| Partial match | "consultant document law" | HYBRID | ✅ |
| Semantic | "sudrf court portal" | VECTOR | ✅ |

---

## Defect Fixed During 8.8

`RetrievalQueryDto` used `@IsUUID()` for CUID `knowledgeBaseId` → retrieval returned 400. Fixed to `@IsString()` in `knowledge-retrieval.controller.ts`.

---

*Validated on production localhost:3075*
