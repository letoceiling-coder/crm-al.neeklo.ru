# ARCHITECTURE FREEZE REPORT — AI Gateway Platform v2.3

**Дата аудита:** 2026-06-07  
**Базовый документ:** `ARCHITECTURE_PLAN_v2.md` (v2.2)  
**Целевой документ:** `ARCHITECTURE_PLAN_v2.3.1.md` (supersedes v2.3)  
**Delta:** [`ARCHITECTURE_V2_3_1_DELTA_REPORT.md`](ARCHITECTURE_V2_3_1_DELTA_REPORT.md)  
**Статус:** ARCHITECTURE FREEZE — pre-implementation  
**Вердикт:** **GO** (с условиями ниже)

---

## Executive Summary

Архитектура v2.2 закрывает 90% требований платформы AI Assistants. Финальный аудит v2.3 устраняет **7 пробелов уровня P0/P1**, формализует **Parser Integration** через [pars-site.neeklo.ru](https://pars-site.neeklo.ru), добавляет **EmbeddingProfile**, **scopes на agt_**, **версионирование KB**, и **tenant isolation contract**.

Рекомендация: **начинать Этап 0** после принятия v2.3 checklist. Кодинг без изменений в v2.3 — **NO-GO**.

---

## 1. Audit by Domain

### 1.1 Organization — PASS with amendments

| Критерий | v2.2 | v2.3 | Статус |
|----------|------|------|--------|
| ApiKey ∈ Organization | ❌ только User | ✅ `ApiKey.organizationId` | **FIX** |
| User → OrganizationMember | ✅ | ✅ | OK |
| Active Organization Context | ⚠️ поле без контракта | ✅ JWT claim + middleware | **FIX** |
| Multi-tenant isolation | ⚠️ описано словами | ✅ TenantGuard contract | **FIX** |
| B2B (компания, роли) | ✅ schema | ✅ + invite flow (Etap 0.5) | OK |

**Ownership model (frozen):**

```
Organization (tenant root)
 ├── OrganizationMember (User + role)
 ├── CrmWorkspace (1:1)
 ├── KnowledgeBase[] (owner)
 ├── PlanLimits
 └── ApiKey[] (billing unit, belongs to org)

User.activeOrganizationId → JWT org context
Every query: WHERE organization_id = :ctx.organizationId
```

**Future B2B:** COMPANY org + SSO (v3); schema готов без миграций.

---

### 1.2 Assistants — PASS with amendments

| Критерий | v2.3 |
|----------|------|
| N× AgentApiKey per KeyAgent | ✅ |
| environments | ✅ AgentApiKeyEnvironment |
| scopes/permissions | ✅ **NEW** `AgentApiKeyScope[]` |
| rotation | ✅ regenerate endpoint + audit |
| revoke | ✅ status=INACTIVE/BLOCKED + deletedAt soft |
| Marketplace | ✅ AgentTemplate.isMarketplace |
| Public agents | ✅ isPublic + install from template |
| Shared agents | ✅ **NEW** org-level clone, not cross-tenant |

**Shared agents:** ассистент **не шарится между Organization**. «Shared» = шаблон marketplace → clone в org. Cross-org sharing — v4.

---

### 1.3 Knowledge Base — PASS with amendments

| Критерий | v2.3 |
|----------|------|
| KB ∈ Organization | ✅ |
| ApiKey access bindings | ✅ ApiKeyKnowledgeBase |
| Assistant access bindings | ✅ KeyAgentKnowledgeBase |
| Document versioning | ✅ **NEW** KnowledgeDocumentVersion |
| Reindex | ✅ KnowledgeJobType REINDEX |
| Embedding model migration | ✅ **NEW** EmbeddingProfile + REEMBED job |
| Chunk strategy | ✅ configurable per KB (size, overlap, splitter) |

**Indexing gate (Parser):** индексировать только если `ok === true && okContent === true`.

---

### 1.4 Embeddings — PASS with amendments

| Вопрос | Рекомендация v2.3 |
|--------|-------------------|
| vector(3072) для 10M+ chunks | ✅ max bucket; HNSW per KB partition |
| EmbeddingProfile table | ✅ **YES** — отдельная таблица |
| Multi-model support | ✅ один KB = один active EmbeddingProfile |
| Migration workflow | ✅ REEMBED job при смене profile |

**Scalability:** при >5M chunks на org — optional **read replica** + **partition by knowledge_base_id** (PostgreSQL declarative partitions, Etap 8).

---

### 1.5 Tool Registry — PASS

| Provider type | Supported |
|---------------|-----------|
| INTERNAL | ✅ CRM, KB search executors |
| WEBHOOK | ✅ |
| REST_API | ✅ |
| GRAPHQL | ✅ schema + HTTP executor |
| MCP | ✅ ToolProvider + MCP client (Etap 6) |

**Secrets:** EncryptedSecret only; rotation via `rotatedAt`; never log ciphertext.

---

### 1.6 Internal CRM — PASS

- One CrmWorkspace per Organization ✅
- TenantGuard on all CRM queries ✅
- All CRM tools resolve via `organizationId` ✅
- Optional metadata: `sourceApiKeyId`, `sourceAgentId` on Lead ✅

---

### 1.7 Memory — PASS with policy

| Topic | v2.3 policy |
|-------|-------------|
| Retention | 90 days default; configurable per org |
| Summarization | After N messages (default 20) → AgentMemory summary job |
| Token optimization | Sliding window last K messages + summary in system prompt |
| Storage | ConversationMessage in PG; archive to S3 exports/ after retention |

---

### 1.8 Workflow Engine — PASS (foundation)

| Topic | v2.3 design |
|-------|-------------|
| Execution model | Event-driven: CRM/Tool events → BullMQ `workflow-run` |
| Queue | `crm-al:workflow` with concurrency 5/org |
| Retry | 3 attempts, exponential backoff; DLQ `workflow-failed` |
| Idempotency | `workflow_run_id` + step `idempotencyKey` |

Schema in M6; runner Etap 7 — unchanged from v2.2.

---

### 1.9 Parser Integration — PASS (NEW primary provider)

**PRIMARY PARSER PROVIDER:** `https://pars-site.neeklo.ru`  
**Documentation:** `parser-html-site/API.md`  
**Rule:** NO internal parser in AI Gateway — только `ParserClientModule`.

See §9 Parser Integration Design in `ARCHITECTURE_PLAN_v2.3.md`.

---

## 2. GAP Analysis (v2.2 → v2.3)

| ID | Gap | Severity | Resolution in v2.3 |
|----|-----|----------|-------------------|
| G1 | ApiKey not on Organization | P0 | `ApiKey.organizationId` |
| G2 | No tenant middleware contract | P0 | TenantGuard + JWT org context |
| G3 | AgentApiKey no scopes | P1 | AgentApiKeyScope enum array |
| G4 | No KB document versioning | P1 | KnowledgeDocumentVersion |
| G5 | No EmbeddingProfile | P1 | New table + REEMBED workflow |
| G6 | Parser unspecified / internal risk | P0 | ParserClientModule → pars-site |
| G7 | okContent not in ingest spec | P0 | Ingestion quality gate |
| G8 | Memory retention undefined | P1 | Policy documented |
| G9 | Workflow execution undefined | P1 | BullMQ model documented |

**Remaining gaps (post-MVP, not blockers):**

- SSO / SAML (v3)
- Cross-org agent marketplace payments (v4)
- Dedicated vector DB (Qdrant) if >50M chunks (v3 scale review)

---

## 3. Risk Report

| # | Risk | Severity | Mitigation | Owner |
|---|------|----------|------------|-------|
| R1 | Tenant data leak | Critical | TenantGuard on every service; integration tests | Etap 0 |
| R2 | Parser returns ok but stub | High | okContent gate; no index; retry heavier mode | Etap 4 |
| R3 | Parser API key exposure | Critical | PARSER_API_KEY server env only; never client | Etap 0 |
| R4 | 10M chunks slow search | High | HNSW + KB partition + EmbeddingProfile isolation | Etap 5/8 |
| R5 | Embedding model change | Medium | REEMBED job; dual-read during migration | Etap 5 |
| R6 | agt_ scope too broad | Medium | AgentApiKeyScope (CHAT, TOOLS, KB_READ) | Etap 1 |
| R7 | CRM write from wrong org | Critical | organizationId from auth context only | Etap 3 |
| R8 | Workflow infinite loop | Medium | maxSteps=20; cycle detection in runner | Etap 7 |
| R9 | Memory storage growth | Medium | retention job + S3 archive | Etap 5.5 |
| R10 | MCP arbitrary code | High | org allowlist; admin-approved providers | Etap 6 |

**Overall risk level:** Medium — manageable with v2.3 controls.

---

## 4. Scalability Report

| Dimension | Target | v2.3 design | Bottleneck | Mitigation |
|-----------|--------|-------------|------------|------------|
| Assistants | 100K+ | KeyAgent indexed by org+apiKey | PG writes | Read replicas for analytics |
| Documents | 1M+ | S3 raw/processed; PG metadata | S3 cost | lifecycle rules, dedup hash |
| Chunks | 10M+ | pgvector HNSW, partition by kb_id | Index build time | async REINDEX; batch embed |
| Embeddings | 10M+ | vector(3072), EmbeddingProfile | Storage ~120GB/10M | compression; optional Qdrant v3 |
| API requests | 100M+ | usage_logs partition by month | PG size | Etap 8 partitioning |
| Parser jobs | concurrent | BullMQ ingest queue, rate limit | pars-site SLA | async 202 + job polling |
| Workflows | 1K active/org | BullMQ per-org concurrency | Redis memory | step limits |

**Verdict:** Architecture scales to stated targets with Etap 8 hardening. No redesign required before MVP.

---

## 5. Security Report

| Area | Control |
|------|---------|
| Tenant isolation | JWT `organizationId` + TenantGuard; row-level org filter |
| API keys | agw_ billing; agt_ scoped; hash storage; encrypted reveal |
| Secrets | EncryptedSecret AES-256-GCM; SECRET_ENCRYPTION_KEY in env |
| Parser | Server-to-server only; PARSER_API_KEY not in git |
| S3 | Presigned URLs TTL 15min; org-prefixed keys `{orgId}/...` |
| Tools SSRF | Webhook domain allowlist per ToolInstance |
| MCP | Provider allowlist; no arbitrary URL from user without ADMIN |
| Audit | All key rotation, KB ingest failures, CRM writes logged |
| RBAC | OrganizationRole gates panel actions |

**Compliance note:** Personal org auto-created — GDPR export/delete on User cascades org data (Etap 8).

---

## 6. Parser Integration Design (Summary)

```
KnowledgeSource (URL)
    → BullMQ: ingest-url
    → ParserClient.parse({ url, mode, timeoutMs, async? })
    → IF 202: poll GET /v1/jobs/:id (or webhook if configured)
    → Quality gate:
         IF ok !== true → job FAILED, no index
         IF okContent !== false → save raw/processed to S3, continue
         ELSE → status SKIPPED_QUALITY, log contentValidation, NO chunk/embed
    → Chunking (KB settings)
    → Embedding (EmbeddingProfile)
    → KnowledgeChunk + KnowledgeEmbedding
```

**Modes supported:** standard, aggressive, headless_only, marketplace_hard, document_first, legal_fast, legal_deep

**Endpoints mapped:**

| ParserClient method | HTTP |
|---------------------|------|
| `health()` | GET /health |
| `parse()` | POST /v1/parse |
| `document()` | POST /v1/document |
| `legalLatest()` | POST /v1/legal/latest |
| `getJob()` | GET /v1/jobs/:id |
| `solveCaptcha()` | POST /v1/captcha/solve |

**ENV:**
```env
PARSER_BASE_URL=https://pars-site.neeklo.ru
PARSER_API_KEY=           # server only, from parser-html-site deploy
PARSER_DEFAULT_TIMEOUT_MS=120000
PARSER_POLL_INTERVAL_MS=4000
PARSER_MAX_RETRIES=2
```

> **Security:** боевой ключ из API.md хранится только в server `.env`. Не коммитить.

---

## 7. Migration Plan (v2.3 delta)

| Migration | Content |
|-----------|---------|
| M0 | organizations, members, plan_limits, **api_keys.organization_id** |
| M1 | assistants, agent_api_keys **+ scopes**, variables |
| M2 | tools, encrypted_secrets, providers |
| M3 | crm (org-scoped) |
| M4 | knowledge + **embedding_profiles** + **document_versions** + parser job metadata |
| M5 | memory, usage extend |
| M6 | workflows schema |
| M7 | legacy deprecation |

**Data migration v1→v2:** existing ApiKeys → assign to user's personal Organization.

---

## 8. GO / NO-GO Verdict

### GO — начинать реализацию при выполнении условий:

- [x] Architecture Plan v2.3 принят командой
- [ ] v2.3 schema amendments включены в M0–M1 migrations (не v2.2 as-is)
- [ ] PARSER_API_KEY добавлен в server `.env` (не в git)
- [ ] S3 buckets созданы на Selectel (raw/processed/ocr/chunks/exports)
- [ ] Feature branch `feature/v2-platform` от v1.0.0 tag

### NO-GO если:

- Начать код без `ApiKey.organizationId` и TenantGuard
- Реализовать inline parser вместо ParserClientModule
- Индексировать KB без проверки `okContent`
- Хранить tool secrets в JSON config

---

## 9. Final Recommendation

# ✅ GO

Архитектура **production-ready** для старта **Этапа 0 (Foundation)**.

Следующий документ: [`ARCHITECTURE_PLAN_v2.3.md`](ARCHITECTURE_PLAN_v2.3.md) — frozen specification.

**Freeze date:** 2026-06-07  
**Frozen by:** Pre-implementation audit v2.3  
**Implementation branch:** `feature/v2-platform`

---

## Appendix: v2.3 Checklist (sign-off)

| Item | Approved |
|------|----------|
| Organization tenant model | ☐ |
| ApiKey.organizationId | ☐ |
| TenantGuard | ☐ |
| N× AgentApiKey + scopes | ☐ |
| KB org-owned + access bindings | ☐ |
| EmbeddingProfile + vector(3072) | ☐ |
| ParserClient → pars-site.neeklo.ru | ☐ |
| okContent quality gate | ☐ |
| EncryptedSecret | ☐ |
| CRM org-scoped | ☐ |
| Memory retention policy | ☐ |
| Workflow BullMQ model | ☐ |
| Roadmap Etap 0–8 | ☐ |

**Sign:** «Утверждаю Architecture Freeze v2.3» → start Etap 0.
