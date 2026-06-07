# Stage 8.5 — Workflow Hardening & Integration Consolidation Report

**Date:** 2026-06-07  
**Branch:** `feature/v2-platform`  
**Architecture:** v2.3.1 (frozen)  
**Scope:** Workflow hardening (async WAIT, graph engine, timezone, templates, observability) + Tool→Integration bridge — **без** Marketplace, Agent Runtime Extensions, Multi-Agent Orchestration

---

## Summary

| Deliverable | Status |
|-------------|--------|
| M8_5_0 workflow hardening migration | ✅ |
| M8_5_1 workflow templates migration | ✅ |
| WAIT async resume (>30s) | ✅ |
| Graph execution engine | ✅ |
| Timezone-aware cron + UI | ✅ |
| WorkflowTemplate catalog (5 templates) | ✅ |
| Tool→Integration bridge (Telegram/MAX/Email) | ✅ |
| Execution observability metrics | ✅ |
| DLQ recovery endpoint | ✅ |
| UI: templates page, timezone selector | ✅ |
| Tests (Stage 8.5 spec) | ✅ PASS (9) |
| Stage 6 regression | ✅ PASS (12) |
| API build | ✅ PASS |
| Web build | ✅ PASS |

---

## Migrations

| ID | File | Changes |
|----|------|---------|
| M8_5_0 | `20250609185000_m8_5_0_workflow_hardening` | `WAITING` status, `checkpoint`, `resumeAt`, `scheduleTimezone`, `sourceTemplateId` |
| M8_5_1 | `20250609186000_m8_5_1_workflow_templates` | `workflow_template_categories`, `workflow_templates`, seed 5 templates |

**Total migrations after deploy:** 54

---

## Task 1 — WAIT Async Resume

**Before:** WAIT capped at 30s in-process (`setTimeout` in worker).

**After:**
- ≤30s: synchronous wait (unchanged UX)
- \>30s: `asyncWait` flag → persist `checkpoint` (context, nextStepKeys, visitedStepKeys) → status `WAITING` → BullMQ delayed job → resume graph execution

Files: `workflow-step-executor.service.ts`, `workflow-runner.service.ts`, `workflow-graph.engine.ts`

---

## Task 2 — Graph Execution Engine

**Before:** Linear `for` loop by `position`; BRANCH output ignored.

**After:** `WorkflowGraphEngine` + BFS/parallel batch runner:
- Edges in `WorkflowVersion.definition` (linear default + BRANCH/CONDITION edges)
- `BRANCH` → dynamic jump via `nextStepKey`
- `parallelTargets` + `joinStepKey` in step config → `Promise.all` parallel execution
- Backward compatible with existing linear workflows

---

## Task 3 — Timezone Support

| Layer | Implementation |
|-------|----------------|
| Schema | `Workflow.scheduleTimezone` (default `UTC`) |
| Queue | BullMQ `repeat: { pattern, tz }` |
| API | `scheduleTimezone` in create/update DTO |
| UI | Timezone selector on workflow detail (SCHEDULE trigger) |

Common zones: UTC, Europe/Moscow, Europe/London, America/New_York, etc.

Schedule cleanup on deactivate/delete now calls `removeSchedule()`.

---

## Task 4 — Workflow Templates

Models: `WorkflowTemplateCategory`, `WorkflowTemplate`

| Template | Trigger | Purpose |
|----------|---------|---------|
| Новый лид → Telegram | CRM_EVENT / LEAD_CREATED | Notify via TOOL step |
| Новый лид → Задача | CRM_EVENT / LEAD_CREATED | CRM TASK create |
| Email → CRM | INTEGRATION_EVENT / email.received | Lead from email |
| Telegram → Ассистент | INTEGRATION_EVENT / telegram.received | Assistant reply |
| Документ → Индексация | KB_EVENT / DOCUMENT_INDEXED | MEMORY_WRITE |

API:
- `GET /v1/workflows/templates/categories`
- `GET /v1/workflows/templates`
- `POST /v1/workflows/templates/:id/instantiate`

UI: `/workflows/templates`

---

## Task 5 — Tool → Integration Bridge

**Before:** `tool-execution.service.ts` simulated telegram/max/email.

**After:** `IntegrationToolService` pipeline:

```
Assistant → ToolExecutionService → IntegrationToolService
  → IntegrationAccount + EncryptedSecret
  → Conversation.upsert + Message (OUTBOUND)
  → Telegram/MAX/Email adapter.sendMessage
```

Tool instances require `settings.integrationAccountId`.

---

## Task 6 — Execution Observability

`WorkflowMetricsService` → `GET /v1/workflows/metrics`

| Metric | Source |
|--------|--------|
| Executions total/completed/failed/dlq/waiting | `workflow_executions` |
| Retries | `attempt > 1` |
| Last 24h runs | `createdAt` filter |
| Template usage | `workflows.sourceTemplateId` groupBy |
| Active workflows | count |

DLQ recovery: `POST /v1/workflows/executions/:executionId/recover`

---

## Security

- All metrics/executions/recovery tenant-scoped via `TenantGuard`
- Integration tool bridge validates `integrationAccountId` ownership
- Template instantiate creates org-scoped workflow only

---

## Tests

| File | Cases | Result |
|------|-------|--------|
| `stage-8-5-workflow-hardening.spec.ts` | graph, async WAIT, DLQ recovery, templates, metrics, tool bridge | 9/9 PASS |
| `stage-6-workflow-engine.spec.ts` | regression | 12/12 PASS |

---

## Limitations (Stage 8.5)

1. Graph UI remains linear step editor — edges built server-side from BRANCH/CONDITION config
2. Parallel groups via JSON config (`parallelTargets`), no visual graph editor
3. DLQ processor still logs only — recovery is manual via API
4. Template TOOL steps require operator to bind `toolInstanceId` after instantiate
5. Marketplace listing/publishing not included (Stage 9)

---

## GO / NO-GO — Stage 9 (Marketplace Platform)

### **GO**

Workflow Hardening closes Stage 6–8 technical debt:

- Async WAIT with persisted checkpoint + resume
- Graph execution with branches and parallel batches
- Timezone-aware scheduling
- Template catalog with 5 starter workflows
- Real messaging via IntegrationToolService (no simulation)
- Metrics + DLQ recovery for operations

Platform is ready for Marketplace (Stage 9): workflow templates provide the foundation for publishable automation packages; integration bridge connects tools to real channels; graph engine supports complex published flows.

---

## Key Files

**Backend:** `workflow-graph.engine.ts`, `workflow-runner.service.ts`, `workflow-template.service.ts`, `workflow-metrics.service.ts`, `integration-tool.service.ts`  
**Frontend:** `pages/workflows/templates.tsx`, timezone in `workflows/detail.tsx`  
**Migrations:** M8_5_0, M8_5_1
