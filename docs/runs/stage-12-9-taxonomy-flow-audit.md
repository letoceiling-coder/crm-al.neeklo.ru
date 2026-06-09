# Stage 12.9 — ETAP 1: Taxonomy Flow Audit

**Date:** 2026-06-09  
**Purpose:** Map the complete chain Document → Enrichment → Classification → Tags → Entities → Summary → Storage → Retrieval and identify all gaps that prevent taxonomy tabs from being populated.

---

## 1. End-to-End Flow Map

```
[Ingest trigger]
       │
       ▼
IngestRunnerService.runIngestUrl / runDocumentProcess / ingestManual
       │  Sets document.status = PROCESSING
       ▼
ParserClientService.parseAndWait  (/v1/parse)
       │  Returns { ok, okContent, chars, text, html, contentValidation }
       ▼
passUrlQualityGate / passDocumentQualityGate
       │  ok=false  → status=FAILED
       │  okContent=false → status=SKIPPED_QUALITY  ← blocks everything below
       │  pass=true  ↓
       ▼
finalizeDocument
       │  Saves processed text to S3 (processedS3Key)
       │  Sets document.status = READY
       ▼
AgentCrmRouterService.shouldUseV2
       │  true  → enqueue KNOWLEDGE_AGENTCRM Bull job
       │  false → enqueue KNOWLEDGE_CHUNK (legacy chunker, no enrichment)
       ▼
EnrichmentPipelineService.execute  (in AgentCrmPipelineProcessor)
       │
       ├── CLEANING        → ctx.cleanText
       ├── STRUCTURE       → ctx.structureJson
       ├── CLASSIFICATION  → ctx.classificationJson  ◄── key stage
       ├── ENTITY_EXTRACTION → ctx.entitiesJson
       │     └── writes knowledge_extracted_entities (delete+create per run)
       ├── SUMMARY         → ctx.summaryJson
       ├── TAGGING         → ctx.taggingJson
       │     └── storeTagSuggestions:
       │           • ALL tags → knowledge_tag_suggestions (PENDING)
       │           • conf ≥ 0.75 → knowledge_tags (upsert) + knowledge_document_tags (upsert)
       ├── VALIDATION      → (in-memory only, NOT persisted to metadata)
       ├── SEMANTIC_CHUNKING → knowledge_chunks (delete+create per version)
       │     └── document.embeddingStatus = EMBEDDING
       ├── EMBEDDING       → enqueue KNOWLEDGE_EMBED Bull job
       │     └── document.embeddingStatus = INDEXED after completion
       └── KQS             → knowledge_pipeline_runs.quality_score
       │
       ▼
persistDocumentEnrichment
       │  document.metadata.agentcrm = {
       │    runId, qualityScore, qualityReasons, pipelineMode,
       │    structureJson, classificationJson, summaryJson,
       │    entitiesJson, taggingJson
       │  }
       │
       ▼  ← CHAIN STOPS HERE — no category/topic auto-creation

```

---

## 2. Table Usage by Stage

### `knowledge_documents`
| Field | Written by | When |
|-------|-----------|------|
| `status` | IngestRunnerService | PENDING→PROCESSING→READY / FAILED / SKIPPED_QUALITY |
| `processedS3Key` | IngestRunnerService (finalizeDocument) | On successful parse |
| `rawS3Key` | KnowledgeDocumentService | On upload |
| `parserChars` | IngestRunnerService | After parse |
| `okContent` | IngestRunnerService | After parse |
| `chunkCount` | EnrichmentPipelineService | After SEMANTIC_CHUNKING |
| `embeddingStatus` | EnrichmentPipelineService | EMBEDDING→INDEXED |
| `categoryId` | **Manual only** (KnowledgeDocumentService.update) | Never by pipeline |
| `topicId` | **Manual only** (KnowledgeDocumentService.update) | Never by pipeline |
| `metadata.agentcrm` | EnrichmentPipelineService.persistDocumentEnrichment | After all stages complete |
| `metadata.pipelineVersion` | EnrichmentPipelineService.persistDocumentEnrichment | = 3 |

### `knowledge_extracted_entities`
| Field | Written by | When |
|-------|-----------|------|
| `entityType` | EnrichmentPipelineService.storeEntities | ENTITY_EXTRACTION stage |
| `name`, `normalizedName` | same | same |
| `value`, `confidence` | same | same |
| `documentId`, `runId` | same | same |
| `metadata` | same | Raw LLM row |

Prior rows for same `(documentId, runId)` are deleted before insert. **No UI surface.**

### `knowledge_tag_suggestions`
| Field | Written by | When |
|-------|-----------|------|
| `tagName`, `confidence` | EnrichmentPipelineService.storeTagSuggestions | TAGGING stage |
| `status` | same | PENDING (conf < 0.75) / APPROVED (conf ≥ 0.75) |
| `reviewedAt` | same | Set on auto-approved high-confidence tags |
| `documentId`, `runId` | same | same |
| `categoryId`, `topicId` | **Never written** | Schema fields exist, code does not populate |

### `knowledge_tags`
| Field | Written by | When |
|-------|-----------|------|
| `name`, `slug` | EnrichmentPipelineService (conf ≥ 0.75 auto-upsert) | TAGGING stage |
| `name`, `slug` | KnowledgeTaxonomyService.createTag | Manual create |
| `organizationId`, `knowledgeBaseId` | Both paths | same |

### `knowledge_document_tags`
| Field | Written by | When |
|-------|-----------|------|
| `documentId`, `tagId` | EnrichmentPipelineService (conf ≥ 0.75 auto-upsert) | TAGGING stage |
| `documentId`, `tagId` | KnowledgeTaxonomyService.assignTags | Manual assign (full replace) |

### `knowledge_categories`
| Field | Written by | When |
|-------|-----------|------|
| `name`, `slug` | KnowledgeTaxonomyService.createCategory | **Manual only** — never by enrichment |
| `organizationId`, `knowledgeBaseId` | same | same |

### `knowledge_topics`
| Field | Written by | When |
|-------|-----------|------|
| `name`, `slug` | KnowledgeTaxonomyService.createTopic | **Manual only** — never by enrichment |
| `categoryId` | same | same — topics always require an existing parent category |

### `knowledge_pipeline_runs`
| Field | Written by | When |
|-------|-----------|------|
| `status` | PipelineRunService | Run lifecycle: RUNNING → SUCCESS / PARTIAL / FAILED |
| `currentStage` | PipelineRunService | Stage transitions |
| `qualityScore`, `qualityBreakdown` | KqsService | After all LLM stages |
| `totalTokens`, `totalCost` | PipelineRunService | Accumulated per stage |

---

## 3. What the CLASSIFICATION Stage Produces

`ctx.classificationJson` (after monolithic or micro merge) contains:

```json
{
  "categories": ["string", ...],
  "topics": ["string", ...],
  "category": "string | null",
  "topic": "string | null",
  "confidence": 0.87,
  "mergedFromPreChunks": 4,
  "categoryScores": { "name": 0.92 },
  "topicScores": { "name": 0.85 }
}
```

These are **free-text names/slugs** (not IDs). The pipeline loads existing KB categories/topics as context (names/slugs) but **never resolves the LLM output back to database IDs**. The entire classification result lives only in `metadata.agentcrm.classificationJson`.

---

## 4. Gap Analysis — What Is Missing

| Gap | Impact | Tables affected |
|-----|--------|----------------|
| **No category auto-create from classification** | Categories tab always empty on new documents | `knowledge_categories` never written by pipeline |
| **No topic auto-create from classification** | Topics tab always empty | `knowledge_topics` never written by pipeline |
| **`document.categoryId`/`topicId` never set by pipeline** | Taxonomy-filtered retrieval ignores enrichment results | `knowledge_documents.category_id`, `topic_id` |
| **Low-confidence tags stuck as PENDING** | Tags with conf < 0.75 are stored but never promoted | `knowledge_tag_suggestions` |
| **`validationJson` not in metadata** | Validation stage output is lost | None — in-memory only |
| **Classification uses names, not IDs** | Even if taxonomy exists, no slug→ID resolution step | Cannot do `WHERE categoryId = ?` queries |
| **`KnowledgeTagSuggestion.categoryId/topicId` unused** | Schema supports tag categorisation, code does not | `knowledge_tag_suggestions` |
| **Partial repair skips entity/tag DB writes** | Re-repair does not update entities/tags | `knowledge_extracted_entities`, `knowledge_tag_suggestions` |
| **`KnowledgeTaxonomyService` has no enrichment hook** | Taxonomy service is pure CRUD, no pipeline integration | All taxonomy tables |

---

## 5. Auto-Taxonomy Gap: Root Cause

The pipeline was built in two independent phases:

1. **AgentCRM enrichment** (Stage 12.8): LLM stages store results in `metadata.agentcrm` and secondary tables. Its job was extraction and quality scoring, not taxonomy wiring.
2. **KB Taxonomy** (earlier): A manual CRUD system with categories, topics, tags.

**There is no bridge between them.** The enrichment pipeline:
- Reads the KB's existing taxonomy as LLM context (so the LLM can assign to *existing* categories)
- Outputs category/topic names as strings
- Never calls `KnowledgeTaxonomyService` or writes to taxonomy tables

The only automatic taxonomy action is: high-confidence tags (conf ≥ 0.75) are upserted into `knowledge_tags` and linked via `knowledge_document_tags`. This is the **only working auto-taxonomy path** today.

---

## 6. What the Customer Sees Today (After Enrichment)

| UI Tab | Populated automatically? | Source | Status |
|--------|--------------------------|--------|--------|
| Категории | **No** | `knowledge_categories` | Always empty unless manually created |
| Темы | **No** | `knowledge_topics` | Always empty unless manually created |
| Теги | **Partially** | `knowledge_tags` (conf ≥ 0.75) | Only high-confidence tags appear |
| AI Analysis (missing tab) | **No tab exists** | `metadata.agentcrm` | No customer-facing UI at all |
| Entities | **No** | `knowledge_extracted_entities` | No KB-level UI |
| Summary | **No** | `metadata.agentcrm.summaryJson` | No KB document UI |
| Pipeline status | **No** | `knowledge_pipeline_runs` | Only visible at `/system/agentcrm` (admin) |

---

## 7. Retrieval: How Taxonomy Is (or Isn't) Used

`RetrievalSourcesService.taxonomySearch` filters by:
```sql
WHERE categoryId = ? OR topicId = ?
```
Because `document.categoryId` and `document.topicId` are never set by the pipeline, **taxonomy-filtered retrieval returns zero results** even after full enrichment.

Tags are searchable in retrieval via the `knowledge_document_tags` join — but only for the subset of high-confidence tags.

---

## 8. Fix Plan (ETAP 2)

To close the gap, the following must be added **after** `persistDocumentEnrichment` in `EnrichmentPipelineService.execute`:

```
autoCreateTaxonomyFromEnrichment(ctx)
  ├── Read ctx.classificationJson.category (top category name)
  ├── Read ctx.classificationJson.topic (top topic name)
  ├── knowledge_categories: upsert by (knowledgeBaseId, slug)
  ├── knowledge_topics: upsert by (knowledgeBaseId, slug), linked to category
  ├── knowledge_documents: update categoryId + topicId
  └── Promote PENDING tags with conf ≥ 0.4 (configurable lower threshold)
```

This requires:
1. New method `autoTaxonomy` in `EnrichmentPipelineService` (or a new `AutoTaxonomyService`)
2. Call it after line 380 (`finishRun`) in `enrichment-pipeline.service.ts`
3. No new LLM calls — uses `ctx.classificationJson` already computed
4. Idempotent upserts — safe to retry

---

## 9. Files to Modify for ETAP 2

| File | Change |
|------|--------|
| `apps/api/src/agentcrm/pipeline/enrichment-pipeline.service.ts` | Add `autoTaxonomyFromEnrichment(ctx)` call at end of `execute()` |
| `apps/api/src/knowledge/knowledge-taxonomy.service.ts` | Add `upsertCategoryByName`, `upsertTopicByName` methods |
| (optional) `apps/api/src/agentcrm/pipeline/auto-taxonomy.service.ts` | New service encapsulating auto-taxonomy logic |

---

## Summary

**The enrichment pipeline produces rich taxonomy data** (category name, topic name, tags, entities, summary) but **none of it is wired to the KB taxonomy tables** except high-confidence tags. The customer sees empty Categories and Topics tabs because no code connects `classificationJson.category` → `knowledge_categories` → `document.categoryId`.

The fix is surgical: one post-enrichment method call. No new LLM calls, no new tables, no breaking changes to existing CRUD.
