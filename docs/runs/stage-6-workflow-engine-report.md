# Stage 6 — Workflow Engine Platform Report

**Date:** 2026-06-07  
**Branch:** `feature/v2-platform`  
**Architecture:** v2.3.1 (frozen)  
**Scope:** Workflow Engine — triggers, runner, queues, linear builder UI — **без** Memory Platform, Marketplace, Agent Runtime Extensions, MCP Ecosystem UI

---

## Summary

| Deliverable | Status |
|-------------|--------|
| M6_0–M6_4 migrations | ✅ |
| Workflow CRUD + versioning | ✅ |
| WorkflowRunnerService pipeline | ✅ |
| Step types (9) | ✅ |
| BullMQ queues (4) | ✅ |
| Retry + DLQ (3 attempts) | ✅ |
| Triggers: MANUAL, SCHEDULE, CRM, KB, TOOL, WEBHOOK | ✅ |
| Webhook `POST /api/v1/workflows/webhook/:token` | ✅ |
| CRM event hooks (7 events) | ✅ |
| KB event hooks (5 events) | ✅ |
| Tool event hooks (2 events) | ✅ |
| UI: Автоматизация + 4 pages | ✅ |
| Linear step editor | ✅ |
| Tests (Stage 6 spec) | ✅ PASS (12) |
| API build | ✅ PASS |
| Web build | ✅ PASS |

---

## Migrations

| ID | File | Changes |
|----|------|---------|
| M6_0 | `20250609160000_m6_0_workflows` | `workflows`, enums |
| M6_1 | `20250609161000_m6_1_workflow_versions` | `workflow_versions` |
| M6_2 | `20250609162000_m6_2_workflow_steps` | `workflow_steps` |
| M6_3 | `20250609163000_m6_3_workflow_executions` | `workflow_executions` |
| M6_4 | `20250609164000_m6_4_workflow_execution_logs` | `workflow_execution_logs` |

**Total migrations after deploy:** 42

---

## Runner

`WorkflowRunnerService` pipeline:

```
Trigger → Workflow (active + version) → Steps (sequential) → Execution record → Per-step logs
```

- Creates `WorkflowExecution` with `triggerData`
- Enqueues BullMQ job (`workflow-run` / `workflow-retry`)
- Executes steps via `WorkflowStepExecutorService`
- Writes `WorkflowExecutionLog` per step (input, output, latency, error)
- On failure: retry up to 3 attempts with exponential backoff → DLQ

---

## Queues (BullMQ)

| Queue | Purpose |
|-------|---------|
| `workflow-run` | Primary execution |
| `workflow-schedule` | Cron repeatable jobs |
| `workflow-retry` | Failed run retries |
| `workflow-dlq` | Dead letter after 3 failures |

Backoff: 5s → 30s → 120s

---

## Triggers

| Type | Mechanism |
|------|-----------|
| MANUAL | `POST /v1/workflows/:id/run` |
| SCHEDULE | BullMQ repeatable cron (`scheduleCron`) |
| CRM_EVENT | Hooks in lead/client/deal/task/note services |
| KB_EVENT | Hooks in ingest + embedding pipeline |
| TOOL_EVENT | Hooks in `ToolExecutionService` |
| WEBHOOK | Public `POST /v1/workflows/webhook/:token` |

### CRM events

`LEAD_CREATED`, `LEAD_UPDATED`, `LEAD_STATUS_CHANGED`, `CLIENT_CREATED`, `DEAL_CREATED`, `TASK_CREATED`, `NOTE_CREATED`

### KB events

`DOCUMENT_CREATED`, `DOCUMENT_INDEXED`, `DOCUMENT_REINDEXED`, `SOURCE_PARSED`, `INGESTION_FINISHED`

### Tool events

`TOOL_EXECUTED`, `TOOL_FAILED`

---

## Step Types

| Step | Integration |
|------|-------------|
| START / END | Pipeline boundaries |
| ASSISTANT | `AssistantChatService` |
| TOOL | `ToolExecutionService` |
| CRM | Lead/Client/Task/Note create + `CrmToolService` |
| WEBHOOK | Outbound HTTP (GET/POST/PUT/PATCH/DELETE) |
| WAIT | Delay (seconds/minutes/hours, cap 30s sync) |
| CONDITION | equals, contains, greaterThan, lessThan, exists |
| BRANCH | Conditional next step key |

---

## API Endpoints

| Route | Description |
|-------|-------------|
| `GET /v1/workflows` | List workflows |
| `POST /v1/workflows` | Create workflow |
| `GET /v1/workflows/:id` | Get workflow + versions |
| `PATCH /v1/workflows/:id` | Update (new version if steps change) |
| `DELETE /v1/workflows/:id` | Delete |
| `POST /v1/workflows/:id/run` | Manual run |
| `GET /v1/workflows/executions/list` | Execution history |
| `GET /v1/workflows/executions/:executionId` | Execution + logs |
| `POST /v1/workflows/webhook/:token` | Webhook trigger (public) |

All JWT routes: `AuthGuard` + `TenantGuard`, organization-scoped.

---

## UI

Sidebar: **Автоматизация** → `/workflows`

| Page | Path |
|------|------|
| Список | `/workflows` |
| Создание | `/workflows/create` |
| Детали + редактор | `/workflows/:id` |
| История | `/workflows/executions` |

**Workflow Builder v1:** linear step editor (add / remove / reorder / JSON config). No drag-and-drop.

---

## Tests

File: `apps/api/src/workflows/stage-6-workflow-engine.spec.ts`

| Area | Cases |
|------|-------|
| Workflow CRUD | list tenant scope, create, versioning |
| Tenant isolation | assertOwned, execution lookup |
| Triggers | CRM event, webhook |
| Runner | enqueue, step logs, retry, DLQ |
| Steps | condition operators |

**Result:** 12/12 PASS

---

## Security

- All workflows filtered by `organizationId`
- `TenantGuard` on management API
- Webhook resolves workflow by unique token (includes org context in execution)
- Cross-tenant execution blocked in `assertOwned` / `getExecution`

---

## Limitations (Stage 6)

1. **Linear editor only** — no visual graph / drag-and-drop
2. **WAIT cap** — synchronous wait limited to 30s (long delays need async resume in future stage)
3. **BRANCH** — outputs next step key; runner still linear (no dynamic jump yet)
4. **Schedule** — no timezone UI; raw cron only
5. **Assistant CRM actions** — via workflow CRM/TOOL steps, not native assistant tool auto-bind
6. **No workflow templates marketplace**

---

## Assistant Integration

Assistants can drive CRM and communications through workflow steps:

- CRM step / Tool step → create lead, client, task, note
- Tool Registry → Telegram, Email instances
- Chain: `CRM_EVENT → ASSISTANT → TOOL → CRM`

---

## GO / NO-GO — Stage 7 (Memory Platform)

### **GO**

Stage 6 delivers a functional Workflow Engine with:

- Complete data model and migrations
- Production-ready runner with logging and retry/DLQ
- All required trigger types wired
- Organization-scoped security
- Operator UI for create/edit/run/history
- Passing tests and builds

Memory Platform (Stage 7) can proceed on top of this automation layer without blocking dependencies.

---

## Files Added / Modified (key)

**Backend:** `apps/api/src/workflows/*`, CRM/KB/Tool event hooks, `queue.constants.ts`, `app.module.ts`  
**Frontend:** `apps/web/src/pages/workflows/*`, `components/workflows/step-editor.tsx`, `lib/workflows.ts`, sidebar, routes  
**Docs:** this report
