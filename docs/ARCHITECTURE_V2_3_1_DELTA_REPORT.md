# ARCHITECTURE V2.3.1 — DELTA REPORT

**Дата:** 2026-06-07  
**Базовый freeze:** Architecture Plan v2.3 (GO)  
**Целевой документ:** [`ARCHITECTURE_PLAN_v2.3.1.md`](ARCHITECTURE_PLAN_v2.3.1.md)  
**Статус:** Pre-implementation enhancement — **no code**

---

## Executive Summary

Ревизия v2.3.1 добавляет **5 архитектурных слоёв**, критичных для масштабирования Knowledge Base и финансовой аналитики. Изменения **additive-only** — не ломают v2.3 GO verdict.

**Вердикт:** **GO** для старта Этапа 0 при условии включения M0.1–M0.5 в migration roadmap.

---

## 1. Что добавлено

| # | Сущность | Слой | Migration |
|---|----------|------|-----------|
| 1 | **KnowledgeSource** | Source Registry | M0.1 |
| 2 | **DomainProfile** | Domain Reputation | M0.2 |
| 3 | **KnowledgeCategory / Topic / Tag** | Knowledge Taxonomy | M0.3 |
| 4 | **TokenCostSnapshot** | Billing accuracy | M0.4 |
| 5 | **ProviderAccount** | Provider Abstraction | M0.5 |

---

## 2. Зачем добавлено

### 2.1 KnowledgeSource (Source Registry)

**Проблема v2.3:** `KnowledgeDocument` смешивал «источник» (URL, sitemap, domain crawl) и «результат парсинга» (версии, chunks). При миллионах документов невозможно:
- планировать re-crawl (`nextParseAt`)
- агрегировать success/failure по источнику
- управлять sitemap/domain-level ingestion

**Решение:** отдельный реестр источников **до** документов.

```
KnowledgeSource → KnowledgeDocument → KnowledgeChunk → KnowledgeEmbedding
```

**Примеры источников:** один URL, sitemap целиком, domain crawl, RSS feed, API endpoint, file URL.

---

### 2.2 DomainProfile (Domain Reputation)

**Проблема v2.3:** `okContent`, `warnings`, `chars` хранились per-document, но не накапливались per-domain. Каждый новый URL парсился «с нуля» без learning.

**Решение:** platform-wide `DomainProfile` с `recommendedMode`, `successRate`, anti-bot flags.

**Flow:**
```
extract domain from URL
  → DomainProfile lookup (or create)
  → recommendedMode if user didn't override parserMode
  → ParserClient.parse({ mode })
  → update DomainProfile stats after parse
```

**Примеры auto-selection:**

| Domain | recommendedMode |
|--------|-----------------|
| consultant.ru | LEGAL_DEEP |
| sudrf.ru | LEGAL_FAST |
| ozon.ru, wildberries.ru | MARKETPLACE_HARD |
| default blog | STANDARD |

> DomainProfile — **platform-global** (не per-org): репутация домена общая для всех tenant'ов. Tenant-specific overrides — через `KnowledgeSource.parserMode`.

---

### 2.3 Knowledge Taxonomy

**Проблема v2.3:** при сотнях тысяч документов и миллионах chunks RAG-only search недостаточен для навигации, фильтрации и юридической структуры.

**Решение:** трёхуровневая таксономия per KB:

```
KnowledgeCategory (tree, parentId)
  → KnowledgeTopic
    → KnowledgeDocument (categoryId, topicId)
      → KnowledgeChunk
        ↔ KnowledgeTag (M:N via KnowledgeDocumentTag)
```

**Auto-classification (Etap 5):** после chunking → LLM job → assign category/topic/tags.

**Юридический пример:**
```
Уголовное право
  ├─ Примирение сторон
  ├─ Освобождение от ответственности
Гражданское право
  ├─ Договоры
```

---

### 2.4 TokenCostSnapshot

**Проблема v2.3:** `UsageLog` без frozen pricing → историческая аналитика искажается при смене тарифов OpenRouter/провайдеров.

**Решение:** immutable snapshot таблица; каждый `UsageLog` ссылается на `tokenCostSnapshotId`.

```
UsageLog.tokenCostSnapshotId → TokenCostSnapshot (inputPrice, outputPrice, effectiveFrom)
costUsd = tokensIn × inputPrice + tokensOut × outputPrice  // at request time
```

Admin seed + cron sync при изменении прайсов провайдера.

---

### 2.5 ProviderAccount

**Проблема v2.3:** `EmbeddingProfile.provider` — строка; нет единой модели для chat, embed, rerank, OCR, vision.

**Решение:** `ProviderAccount` per Organization (+ platform defaults):

```
ProviderAccount
  → EncryptedSecret (apiKeySecretId)
  → used by: EmbeddingProfile, KeyAgent modelChain, future Reranker/OCR
```

**Providers:** OPENAI, OPENROUTER, ANTHROPIC, GEMINI, DEEPSEEK, MISTRAL, OLLAMA, CUSTOM.

---

## 3. Влияние на MVP

| Сущность | Schema (Etap) | Logic (Etap) | MVP blocker? |
|----------|---------------|--------------|--------------|
| KnowledgeSource | M0.1 → deploy M4 | M4 ingest | **No** — schema early, logic with KB |
| DomainProfile | M0.2 → deploy M4 | M4 parser | **No** — fallback to parser auto-mode |
| Taxonomy | M0.3 → deploy M4 | M5 LLM classify | **No** — manual assign OK for MVP |
| TokenCostSnapshot | M0.4 → deploy M0 | M0 usage extend | **No** — nullable FK until wired |
| ProviderAccount | M0.5 → deploy M0 | M1 chat / M4 embed | **No** — platform default account |

**MVP path unchanged:** Etap 0 → 1 → 2 → 3 → 4 → 5.

**v2.3.1 rule:** создавать **таблицы и FK в schema migrations**, business logic — по этапам. Etap 0 не блокируется новыми таблицами.

### Etap 0 additions (schema-only)

- M0.4 `token_cost_snapshots` + nullable `usage_logs.token_cost_snapshot_id`
- M0.5 `provider_accounts` + seed platform default OpenRouter account
- M0.1, M0.2, M0.3 — **optional in Etap 0** or bundled into M4 pre-create

**Recommended:** run M0.4 + M0.5 in Etap 0; M0.1–M0.3 in Etap 4 pre-step (same sprint as KB tables).

---

## 4. Влияние на масштабирование

| Enhancement | Scale benefit |
|-------------|---------------|
| **KnowledgeSource** | Re-crawl scheduling; source-level metrics; sitemap batch without document sprawl |
| **DomainProfile** | Reduces parser retries; faster ingest on known domains; shared anti-bot intelligence |
| **Taxonomy** | Filter RAG by category/topic before vector search → smaller candidate set |
| **TokenCostSnapshot** | Accurate cost analytics at billions of UsageLog rows |
| **ProviderAccount** | Multi-provider routing; org-level API keys; failover without schema change |

### Updated scalability notes

| Dimension | v2.3 | v2.3.1 |
|-----------|------|--------|
| Documents | 1M+ metadata in PG | + KnowledgeSource index reduces orphan docs |
| Chunks | 10M+ HNSW | + taxonomy pre-filter → 10× smaller search space |
| Parser calls | retry per URL | DomainProfile → −30% retries (est.) |
| UsageLog | monthly partition | + snapshot FK, no price recalc jobs |
| Providers | string in profile | ProviderAccount → horizontal provider add |

**New indexes (critical at scale):**

```sql
CREATE INDEX knowledge_sources_kb_status_idx ON knowledge_sources(knowledge_base_id, crawl_status);
CREATE INDEX knowledge_sources_next_parse_idx ON knowledge_sources(next_parse_at) WHERE crawl_status = 'ACTIVE';
CREATE UNIQUE INDEX domain_profiles_domain_idx ON domain_profiles(domain);
CREATE INDEX knowledge_documents_taxonomy_idx ON knowledge_documents(knowledge_base_id, category_id, topic_id);
```

---

## 5. Влияние на безопасность

| Area | Risk | Mitigation v2.3.1 |
|------|------|-------------------|
| DomainProfile global | Cross-tenant domain intel leak | Store **only** aggregated stats, no URLs/content |
| KnowledgeSource | SSRF via user URL | Same allowlist as v2.3; validate domain |
| ProviderAccount secrets | API key exposure | `apiKeySecretId → EncryptedSecret` only |
| TokenCostSnapshot | Price manipulation | Admin-only write; immutable after effectiveFrom |
| Taxonomy LLM | Prompt injection from doc content | Classify in sandbox; no tool access |

**Tenant isolation unchanged:** KnowledgeSource, Category, Topic, Tag — all have `organizationId`.

**DomainProfile exception:** global read-only aggregate; no tenant data stored.

---

## 6. Влияние на стоимость поддержки

| Factor | Impact | Notes |
|--------|--------|-------|
| **Schema complexity** | +5 tables, +4 junction | One-time migration cost; Prisma models documented |
| **DomainProfile maintenance** | Low | Background job updates stats; no manual ops |
| **Taxonomy LLM** | Medium OPEX | Optional Etap 5; ~$0.001/doc classify; disable per KB |
| **TokenCostSnapshot** | Low | Admin updates on price change; cron weekly sync |
| **ProviderAccount** | Medium | Support multi-key rotation; UI in Etap 1 settings |
| **KnowledgeSource scheduler** | Medium | BullMQ cron for `nextParseAt`; ops monitoring |

**Net assessment:** +15% Etap 4–5 implementation effort; −40% long-term ingest/debug cost at scale.

---

## 7. Breaking changes

**None.** All v2.3 contracts preserved:

- `POST /knowledge-bases/:id/documents/url` — creates KnowledgeSource + Document (transparent to client)
- Legacy documents without `knowledgeSourceId` — backfill migration sets source from `sourceUrl`
- `EmbeddingProfile.provider` string — deprecated, use `providerAccountId` (nullable during transition)

---

## 8. Migration delta (M0.1 – M0.5)

| Migration | Tables | When apply |
|-----------|--------|------------|
| **M0.1** source_registry | `knowledge_sources`, FK on `knowledge_documents.knowledge_source_id` | Etap 4 (or pre-create Etap 0) |
| **M0.2** domain_reputation | `domain_profiles`, `domain_profile_events` (optional audit) | Etap 4 |
| **M0.3** taxonomy | `knowledge_categories`, `knowledge_topics`, `knowledge_tags`, `knowledge_document_tags`, FKs on documents | Etap 4 |
| **M0.4** token_cost_snapshots | `token_cost_snapshots`, FK on `usage_logs` | Etap 0 |
| **M0.5** provider_accounts | `provider_accounts`, FK on `embedding_profiles`, `key_agents` | Etap 0 |

Full order in [`ARCHITECTURE_PLAN_v2.3.1.md`](ARCHITECTURE_PLAN_v2.3.1.md) §16.

---

## 9. API Contract delta

| New endpoints | Purpose |
|---------------|---------|
| `GET/POST /knowledge-bases/:id/sources` | Source registry CRUD |
| `POST /knowledge-bases/:id/sources/:id/crawl` | Trigger crawl |
| `GET /knowledge-bases/:id/categories` | Taxonomy tree |
| `GET /admin/domain-profiles/:domain` | Admin domain stats |
| `GET/POST /provider-accounts` | Org provider config |
| `GET /admin/token-cost-snapshots` | Price history admin |

Existing document URL endpoint unchanged — internally creates KnowledgeSource.

---

## 10. GO / NO-GO Verdict

### ✅ GO — начинать Этап 0

**Conditions (unchanged from v2.3 + v2.3.1):**

- [x] Architecture Plan v2.3.1 accepted
- [ ] M0.4 + M0.5 included in Etap 0 migrations
- [ ] M0.1–M0.3 included in Etap 4 KB sprint (schema before ingest logic)
- [ ] PARSER_API_KEY, S3 credentials in server env
- [ ] Branch `feature/v2-platform` from v1.0.0

### NO-GO if:

- Skip KnowledgeSource and keep document-only model (blocks scale)
- Store provider API keys outside EncryptedSecret
- Implement DomainProfile per-tenant (duplicates learning, higher cost)

---

## 11. Sign-off checklist (v2.3.1)

| Item | Approved |
|------|----------|
| KnowledgeSource registry | ☐ |
| DomainProfile global reputation | ☐ |
| ParserMode auto-selection | ☐ |
| Knowledge Taxonomy (Category/Topic/Tag) | ☐ |
| LLM auto-classification (Etap 5) | ☐ |
| TokenCostSnapshot on UsageLog | ☐ |
| ProviderAccount abstraction | ☐ |
| M0.1–M0.5 migration plan | ☐ |
| v2.3 base unchanged (GO preserved) | ☐ |

**Sign:** «Утверждаю Architecture Freeze v2.3.1» → start Etap 0.

---

## Appendix: v2.3 → v2.3.1 diff summary

```
+ KnowledgeSource (registry, crawl scheduling)
+ DomainProfile (platform-wide parser intelligence)
+ KnowledgeCategory / KnowledgeTopic / KnowledgeTag
+ TokenCostSnapshot (immutable pricing)
+ ProviderAccount (unified provider credentials)
~ KnowledgeDocument + knowledgeSourceId, categoryId, topicId
~ EmbeddingProfile + providerAccountId
~ UsageLog + tokenCostSnapshotId
~ Ingestion pipeline + DomainProfile lookup + taxonomy classify step
~ ER Diagram extended
~ API Contract +6 endpoint groups
~ Migration Plan + M0.1–M0.5
```
