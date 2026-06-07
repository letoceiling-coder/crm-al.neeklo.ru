# Stage 2A — Knowledge Base Foundation Report

**Date:** 2026-06-07  
**Branch:** `feature/v2-platform`  
**Architecture:** v2.3.1 (frozen)  
**Scope:** Storage, ingestion foundation, management — **без** RAG, Embeddings, Chunking, Chat Runtime

---

## Summary

| Deliverable | Status |
|-------------|--------|
| M2_0 KnowledgeBase | ✅ |
| M2_1 KnowledgeSource | ✅ |
| M2_2 KnowledgeDocument | ✅ |
| M2_3 KnowledgeDocumentVersion | ✅ |
| M2_4 Taxonomy (Category, Topic, Tag) | ✅ |
| Backend API `/api/v1/knowledge-*` | ✅ |
| ParserClient integration (pars-site.neeklo.ru) | ✅ |
| Quality gate (ok + okContent) | ✅ |
| Selectel S3 (raw/, processed/) | ✅ |
| UI: `/knowledge`, create, detail + 8 tabs | ✅ |
| Tests (14) | ✅ PASS |
| API build | ✅ PASS |
| Web build | ✅ PASS |

---

## Migrations

| ID | File | Tables / enums |
|----|------|----------------|
| M2_0 | `20250609100000_m2_0_knowledge_bases` | `knowledge_bases`, `KnowledgeBaseStatus` |
| M2_1 | `20250609101000_m2_1_knowledge_sources` | `knowledge_sources`, `KnowledgeSourceType`, `CrawlStatus`, `ParserMode` |
| M2_2 | `20250609102000_m2_2_knowledge_documents` | `knowledge_documents`, `KnowledgeDocumentFormat`, `KnowledgeDocumentStatus` |
| M2_3 | `20250609103000_m2_3_document_versions` | `knowledge_document_versions` |
| M2_4 | `20250609104000_m2_4_taxonomy` | `knowledge_categories`, `knowledge_topics`, `knowledge_tags`, `knowledge_document_tags` |

**Total migrations after deploy:** 20 (15 existing + 5 new)

---

## Backend API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/knowledge-bases` | List org KBs |
| POST | `/api/v1/knowledge-bases` | Create KB |
| GET | `/api/v1/knowledge-bases/:id` | Detail + live stats |
| PATCH | `/api/v1/knowledge-bases/:id` | Update |
| DELETE | `/api/v1/knowledge-bases/:id` | Delete |
| GET | `/api/v1/knowledge-sources?knowledgeBaseId=` | List sources |
| POST | `/api/v1/knowledge-sources` | Create source (URL/Sitemap/Domain) |
| GET/PATCH/DELETE | `/api/v1/knowledge-sources/:id` | CRUD |
| POST | `/api/v1/knowledge-sources/:id/crawl` | Re-parse URL source |
| GET | `/api/v1/knowledge-documents?knowledgeBaseId=` | List documents |
| GET | `/api/v1/knowledge-documents/:id` | Detail + versions |
| POST | `/api/v1/knowledge-documents/url` | Ingest URL via parser |
| POST | `/api/v1/knowledge-documents/manual` | Manual text |
| POST | `/api/v1/knowledge-documents/upload` | File upload (multipart) |
| PATCH/DELETE | `/api/v1/knowledge-documents/:id` | Metadata / delete |
| GET/POST/PATCH/DELETE | `/api/v1/knowledge-categories` | Taxonomy CRUD |
| GET/POST/PATCH/DELETE | `/api/v1/knowledge-topics` | Topics CRUD |
| GET/POST/DELETE | `/api/v1/knowledge-tags` | Tags CRUD |
| POST | `/api/v1/knowledge-tags/assign/:documentId` | Assign tags |

**Module:** `apps/api/src/knowledge/`  
**Registered in:** `AppModule` → `KnowledgeModule`

---

## Quality Gate

| Source | Rule |
|--------|------|
| URL / HTML (ParserClient.parse) | `ok === true` **AND** `okContent === true` → READY; `okContent === false` → `SKIPPED_QUALITY` (не индексируется) |
| Files (ParserClient.document) | `ok === true` AND `chars >= 500` |
| Manual text | `length >= 50` |

Implementation: `knowledge-quality.gate.ts`

---

## S3 Storage

Structure via `StorageService.buildKey(orgId, folder, ...)`:

```
{organizationId}/raw/{kbId}/{docId}/...
{organizationId}/processed/{kbId}/{docId}/v-{timestamp}.txt
```

Folders supported: `raw`, `processed`, `ocr`, `chunks`, `exports` (ocr/chunks/exports reserved for Stage 2B+)

---

## UI

| Route | Page |
|-------|------|
| `/knowledge` | Список баз знаний |
| `/knowledge/create` | Создание |
| `/knowledge/:id` | Деталь с вкладками |

**Меню:** «Базы знаний» (sidebar)

**Вкладки детальной страницы:**

- Основное
- Источники (URL / Sitemap / Domain)
- Документы (URL, файл, текст)
- Категории / Темы / Теги
- Статистика (из `stats` JSON)
- История (placeholder)

**Язык UI:** русский

---

## Tests

| File | Coverage |
|------|----------|
| `knowledge-quality.gate.spec.ts` | okContent gate, document min chars |
| `knowledge-base.service.spec.ts` | Tenant isolation |
| `knowledge-taxonomy.service.spec.ts` | Taxonomy CRUD + org scope |
| `knowledge-ingest.service.spec.ts` | Parser skip on okContent=false, versioning, S3 path |

**Result:** 14/14 PASS (`npm test -- --testPathPattern=knowledge`)

---

## Не реализовано (по спецификации Stage 2A)

- Embeddings / Vector Search / RAG
- Chunking (`KnowledgeChunk`)
- BullMQ ingestion pipeline (async jobs)
- DomainProfile / auto parser mode
- Sitemap/Domain **multi-URL crawl** (источники создаются; полный crawl — Stage 2B)
- ZIP extraction (файл сохраняется в S3, статус PENDING)
- Assistant / CRM / Tool Registry bindings
- History / audit tab (placeholder)

---

## Риски и замечания

1. **Production deploy:** миграции M2_0–M2_4 нужно применить на сервере (`prisma migrate deploy`).
2. **S3 / Parser:** ingest URL/PDF требует настроенных `S3_*` и `PARSER_*` env на production.
3. **Sync ingest:** URL-парсинг выполняется синхронно в HTTP-запросе; длинные страницы могут timeout — Stage 2B переведёт на BullMQ.
4. **Sitemap/Domain:** создание источника без автоматического expand URL — явная задача для Stage 2B Pipeline.
5. **Plan limits:** `maxKnowledgeBases` / `maxDocuments` проверяется только для KB count; document limit — Stage 2B.

---

## Финальный вердикт

### **GO** — для начала **Stage 2B — Ingestion Pipeline**

**Обоснование:**

- Схема БД и API foundation соответствуют Architecture v2.3.1
- Tenant isolation на всех сервисах
- Quality gate okContent реализован
- Версионирование документов + S3 raw/processed работают
- Taxonomy CRUD готов
- UI management layer на русском языке
- Тесты и сборки проходят

**Рекомендации для Stage 2B:**

1. BullMQ jobs: `ingest-url`, `ingest-source`, `expand-sitemap`
2. ZIP extraction → batch documents
3. DomainProfile + parser mode resolution
4. Async job status API для UI
5. Production deploy M2 migrations + smoke test
