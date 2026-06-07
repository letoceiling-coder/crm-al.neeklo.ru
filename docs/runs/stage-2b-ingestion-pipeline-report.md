# Stage 2B — Knowledge Ingestion Pipeline Report

**Date:** 2026-06-07  
**Branch:** `feature/v2-platform`  
**Architecture:** v2.3.1 (frozen)  
**Scope:** Async ingestion pipeline, Job Center, Sitemap/Domain/ZIP expansion — **без** Chunking, Embeddings, Vector Search, RAG

---

## Summary

| Deliverable | Status |
|-------------|--------|
| M2_5 KnowledgeJob + PlanLimits extensions | ✅ |
| M2_6 DomainProfile | ✅ |
| BullMQ queues (5) + processors (5) | ✅ |
| Async HTTP `{ jobId, status: "QUEUED" }` | ✅ |
| Job Center API + UI | ✅ |
| Sitemap expansion (sitemap.xml / sitemap-index) | ✅ |
| Domain crawler (robots.txt + BFS) | ✅ |
| DomainProfile + auto parser mode | ✅ |
| ZIP extract pipeline | ✅ |
| Plan limits enforcement | ✅ |
| Source health tab | ✅ |
| Reprocess endpoints + UI | ✅ |
| Tests (28 knowledge) | ✅ PASS |
| API build | ✅ PASS |
| Web build | ✅ PASS |

---

## Migrations

| ID | File | Changes |
|----|------|---------|
| M2_5 | `20250609110000_m2_5_knowledge_jobs` | `knowledge_jobs`, enums `KnowledgeJobType`, `KnowledgeJobStatus`; `plan_limits`: +`max_sources`, +`max_jobs`, +`max_urls_per_sitemap` |
| M2_6 | `20250609111000_m2_6_domain_profiles` | `domain_profiles` + seed (consultant.ru, sudrf.ru, ozon.ru, …) |

**Total migrations after deploy:** 22 (20 from Stage 2A + 2 new)

---

## BullMQ Queues & Jobs

| Queue | Job name | Processor |
|-------|----------|-----------|
| `knowledge-ingest` | `IngestUrlJob` | `KnowledgeIngestProcessor` |
| `knowledge-source-expand` | `ExpandSitemapJob`, `ExpandDomainJob` | `KnowledgeSourceExpandProcessor` |
| `knowledge-document-process` | `DocumentProcessJob` | `KnowledgeDocumentProcessProcessor` |
| `knowledge-zip-extract` | `ZipExtractJob` | `KnowledgeZipExtractProcessor` |
| `knowledge-reprocess` | `ReprocessDocumentJob` | `KnowledgeReprocessProcessor` |

**Bull Board:** all 5 queues registered at `/admin/queues`

**Pipeline:**

```text
URL / Sitemap / Domain / PDF / DOCX / TXT / ZIP
  → Parser (via IngestRunnerService)
  → Quality Gate
  → S3 (raw/ + processed/)
  → Document Version
  → KnowledgeJob status
  → Document READY | FAILED | SKIPPED_QUALITY
```

Manual text ingest remains **synchronous** (fast, no parser queue).

---

## Backend API (new / changed)

| Method | Path | Response / behavior |
|--------|------|---------------------|
| GET | `/api/v1/knowledge-jobs` | List jobs (filter: `knowledgeBaseId`, `status`) |
| GET | `/api/v1/knowledge-jobs/:id` | Job detail |
| POST | `/api/v1/knowledge-jobs/:id/cancel` | Cancel QUEUED/RUNNING |
| POST | `/api/v1/knowledge-documents/url` | **`{ jobId, status: "QUEUED" }`** |
| POST | `/api/v1/knowledge-documents/upload` | **`{ jobId, status: "QUEUED" }`** |
| POST | `/api/v1/knowledge-documents/:id/reprocess` | New reprocess job |
| POST | `/api/v1/knowledge-sources` | Creates source + queues expand/ingest |
| POST | `/api/v1/knowledge-sources/:id/crawl` | Re-queue source |
| GET | `/api/v1/knowledge-sources/:id/health` | Source health metrics |

**Key services:**

- `KnowledgeQueueService` — enqueue + sitemap/domain expand workers
- `IngestRunnerService` — parser, quality gate, S3, versioning
- `SitemapExpansionService` — `<loc>` parsing, sitemap-index recursion
- `DomainDiscoveryService` — robots.txt, BFS crawl (`maxDepth`, `maxPages`, `allowedPaths`, `blockedPaths`)
- `DomainProfileService` — mode resolution + stats
- `ZipExtractionService` — adm-zip → child documents
- `KnowledgePlanLimitsService` — KB, docs, sources, jobs, storage, sitemap URLs

---

## Domain Reputation (DomainProfile)

Platform-global table. Auto mode selection with manual override via `KnowledgeSource.parserMode`.

| Domain | Recommended mode |
|--------|------------------|
| consultant.ru | LEGAL_DEEP |
| sudrf.ru | LEGAL_FAST |
| ozon.ru | MARKETPLACE_HARD |
| wildberries.ru | MARKETPLACE_HARD |

Stats updated after each parse: `totalRequests`, `successRate`, `averageChars`, `antiBotDetected`, `captchaDetected`.

---

## Plan Limits

Enforced before job/document/source creation:

| Limit | Default |
|-------|---------|
| maxKnowledgeBases | 5 |
| maxDocuments | 1000 |
| maxSources | 50 |
| maxJobs (active QUEUED+RUNNING) | 500 |
| maxStorageMb | 5120 |
| maxUrlsPerSitemap | 500 |

`maxChunks` reserved for Stage 2C (not enforced in ingestion).

---

## UI

| Route / tab | Description |
|-------------|-------------|
| `/knowledge/jobs` | Global Job Center (sidebar: «Задачи обработки») |
| KB detail → «Задачи» | Jobs filtered by KB (auto-refresh 5s) |
| KB detail → «Источники» → «Здоровье источника» | Health panels per source |
| Documents | Status labels: В очереди / Обрабатывается / Готово / Ошибка |
| Documents | «Перепарсить» → reprocess job |
| Sources | «Обновить источник» for URL/Sitemap/Domain |

---

## Tests

| Suite | Count | Coverage |
|-------|-------|----------|
| `knowledge-quality.gate.spec.ts` | 4 | Quality gate |
| `knowledge-base.service.spec.ts` | 3 | Tenant isolation |
| `knowledge-taxonomy.service.spec.ts` | 4 | Taxonomy |
| `knowledge-ingest.service.spec.ts` | 3 | Async queue API |
| `stage-2b-ingestion-pipeline.spec.ts` | 14 | Sitemap, domain crawl, domain profile, plan limits, job tenant isolation, ZIP extract |

**Total knowledge tests:** 28/28 PASS

---

## Performance & Operations

- HTTP returns immediately after DB record + BullMQ enqueue (~50–200 ms).
- URL parsing runs in worker; typical parser latency 5–60 s per URL (external pars-site).
- Sitemap/domain expand creates N child `IngestUrlJob`s — bounded by `maxUrlsPerSitemap` / `maxPages`.
- Job list capped at 200 rows per request.
- Redis required for workers; without Redis, API enqueues fail at runtime.

---

## Known Limitations

1. **No chunking/embeddings** — by design (Stage 2C scope).
2. **Domain crawl** — lightweight BFS HTML link extraction, not full headless browser crawl.
3. **Sitemap parser** — regex-based `<loc>` extraction (no XML namespace edge cases).
4. **Job cancel** — marks DB status CANCELLED; BullMQ job may still complete if already picked up.
5. **Large ZIP** — extracted in worker memory; very large archives may need streaming in future.
6. **Production deploy** — migrations M2_5/M2_6 must be applied; Redis workers must be running.

---

## Verdict

### **GO** for Stage 2C — Chunking & Embeddings

Foundation complete:

- Async ingestion pipeline with observable jobs
- Document versions + S3 processed storage ready for chunk input
- Quality gate and tenant isolation verified
- Plan limits in place before scale-up

**Recommended Stage 2C entry:**

1. Apply migrations on production
2. Confirm Redis + BullMQ workers running for 5 knowledge queues
3. Implement `KnowledgeChunk` + embedding queue on top of `READY` documents

---

*Report generated as part of AI Gateway Platform v2 — Stage 2B.*
