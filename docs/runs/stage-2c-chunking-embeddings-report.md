# Stage 2C — Chunking & Embeddings Report

**Date:** 2026-06-07  
**Branch:** `feature/v2-platform`  
**Architecture:** v2.3.1 (frozen)  
**Scope:** Document → Chunk → Embedding → Search Foundation — **без** RAG, Assistant Runtime, Knowledge Binding

---

## Summary

| Deliverable | Status |
|-------------|--------|
| M2_7 KnowledgeChunk + embedding pipeline | ✅ |
| Chunk strategies (5) | ✅ |
| EmbeddingProfile integration | ✅ |
| BullMQ: knowledge-chunk, knowledge-embed, knowledge-reembed | ✅ |
| KnowledgeEmbedding multi-model | ✅ |
| SearchService + RetrievalService | ✅ |
| Plan limits maxChunks | ✅ |
| UI: Чанки + Эмбеддинги tabs | ✅ |
| Tests (35 knowledge) | ✅ PASS |
| API build | ✅ PASS |
| Web build | ✅ PASS |

---

## Migrations

| ID | File | Changes |
|----|------|---------|
| M2_7 | `20250609120000_m2_7_chunks_embeddings` | `knowledge_chunks`, enums `ChunkStrategy`, `KnowledgeEmbeddingStatus`; `knowledge_documents`: +`chunk_count`, +`embedding_status`; `embedding_profiles`: +`metric`; `knowledge_embeddings`: FK → chunks, unique `(chunk_id, profile_id)`; FTS index on chunks |

**Total migrations after deploy:** 23

---

## Pipeline

```text
Document READY
  → ChunkDocumentJob (knowledge-chunk)
  → KnowledgeChunk[]
  → EmbedDocumentJob (knowledge-embed)
  → KnowledgeEmbedding (vector(3072))
  → embeddingStatus = INDEXED
```

Re-embed:
- `POST /v1/knowledge-bases/:id/reembed` — full KB
- `POST /v1/knowledge-documents/:id/reembed` — single document via `knowledge-reembed`

---

## Chunk Strategies

| Strategy | Algorithm |
|----------|-----------|
| FIXED | Size + overlap sliding window |
| PARAGRAPH | Split on `\n\n` |
| SECTION | Split on headers (`#`, `<h1>`) |
| LEGAL_ARTICLE | Split on `Статья N` / `Article N` |
| MARKDOWN | Split on `#` headers |

Settings in `KnowledgeBase.settings`:

```json
{
  "chunkStrategy": "FIXED",
  "chunkSize": 1000,
  "chunkOverlap": 200,
  "minChunkSize": 100,
  "maxChunkSize": 4000
}
```

---

## BullMQ Queues

| Queue | Job | Processor |
|-------|-----|-----------|
| `knowledge-chunk` | `ChunkDocumentJob` | `KnowledgeChunkProcessor` |
| `knowledge-embed` | `EmbedDocumentJob` | `KnowledgeEmbedProcessor` |
| `knowledge-reembed` | `ReembedJob` | `KnowledgeReembedProcessor` |

---

## Embedding Profiles

Uses existing `EmbeddingProfile` with providers:

- OpenAI (`openai`)
- OpenRouter (`openrouter`) — also BGE, Nomic via model slug
- Voyage (`voyage`)
- BGE / Nomic (via OpenRouter model names)

Fields: `provider`, `model`, `dimensions`, `metric`, `isDefault`, `isActive` (status).

Multi-model: `KnowledgeEmbedding` unique on `(chunkId, profileId)`.

---

## Search Foundation

| Service | Methods |
|---------|---------|
| `SearchService` | `keywordSearch` (PostgreSQL FTS), `metadataSearch`, `mergeRrf` |
| `RetrievalService` | `searchByKeyword`, `searchByVector`, `hybridSearch` |

API (no UI search, no answer generation):

| Method | Path |
|--------|------|
| POST | `/api/v1/knowledge-retrieval/keyword` |
| POST | `/api/v1/knowledge-retrieval/vector` |
| POST | `/api/v1/knowledge-retrieval/hybrid` |

---

## pgvector Index Strategy

| Dimensions | Index |
|------------|-------|
| ≤ 2000 | IVFFlat recommended per-profile (admin job Stage 3+) |
| 3072 (default) | **No HNSW** — pgvector limit; sequential scan OK to ~100K chunks/KB |
| 50M+ vectors | Migrate to **Qdrant** (architecture v2.3.1) |

---

## Plan Limits

`maxChunks` enforced in `assertCanCreateChunks()` before chunk insert.

---

## UI

| Tab | Content |
|-----|---------|
| **Чанки** | List chunks: document, index, chars, tokens, preview |
| **Эмбеддинги** | Summary stats, profile info, per-document status/model |

Document embedding statuses: Ожидает / Чанкинг / Эмбеддинг / Проиндексирован / Ошибка

---

## Tests

| Suite | Tests |
|-------|-------|
| `stage-2c-chunking-embeddings.spec.ts` | 7 (strategies, RRF, maxChunks) |
| All knowledge suites | **35/35 PASS** |

---

## Known Limitations

1. **No RAG answer generation** — retrieval only; binding in Stage 3
2. **3072-dim vectors** — no pgvector HNSW index; latency grows with chunk count
3. **Embedding API** — requires configured ProviderAccount (OpenRouter/OpenAI/Voyage)
4. **Reembed full KB** — re-embeds existing chunks without re-chunking (document reembed re-chunks)
5. **Manual text ingest** — triggers chunk queue after finalize

---

## Verdict

### **GO** for Stage 3 — Assistant Knowledge Binding + Retrieval

Ready:
- Indexed chunks with vectors in PostgreSQL
- RetrievalService for keyword/vector/hybrid search
- Multi-model embedding support
- Tenant isolation and plan limits

**Recommended Stage 3 entry:**
1. Apply migration M2_7 on production
2. Configure default EmbeddingProfile + ProviderAccount
3. Wire Assistant → KnowledgeBase binding → RetrievalService

---

*Report generated as part of AI Gateway Platform v2 — Stage 2C.*
