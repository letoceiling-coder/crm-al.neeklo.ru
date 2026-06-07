# Stage 5 — Internal CRM Platform Report

**Date:** 2026-06-07  
**Branch:** `feature/v2-platform`  
**Architecture:** v2.3.1 (frozen)  
**Scope:** Internal CRM — workspace, entities, pipeline, tool integration, UI — **без** Workflow Engine, Memory, Marketplace, Agent Runtime Extensions

---

## Summary

| Deliverable | Status |
|-------------|--------|
| M5_0 CrmWorkspace | ✅ |
| M5_1 CrmClient | ✅ |
| M5_2 CrmLead | ✅ |
| M5_3 CrmDeal | ✅ |
| M5_4 CrmTask | ✅ |
| M5_5 CrmNote | ✅ |
| M5_6 CrmActivity | ✅ |
| CRM API (`/api/v1/crm/*`) | ✅ |
| Pipeline (6 stages) | ✅ |
| Tool integration (4 CRM tools) | ✅ |
| Stub removal | ✅ |
| UI: CRM menu + pages + client timeline | ✅ |
| Tests (5 Stage 5 + updated Stage 4) | ✅ PASS |
| API build | ✅ PASS |
| Web build | ✅ PASS |

---

## Migrations

| ID | File | Changes |
|----|------|---------|
| M5_0 | `20250609150000_m5_0_crm_workspace` | `crm_workspaces`, CRM enums |
| M5_1 | `20250609151000_m5_1_crm_clients` | `crm_clients` |
| M5_2 | `20250609152000_m5_2_crm_leads` | `crm_leads` |
| M5_3 | `20250609153000_m5_3_crm_deals` | `crm_deals` |
| M5_4 | `20250609154000_m5_4_crm_tasks` | `crm_tasks` |
| M5_5 | `20250609155000_m5_5_crm_notes` | `crm_notes` |
| M5_6 | `20250609156000_m5_6_crm_activities` | `crm_activities` |

**Total migrations after deploy:** 37

---

## Pipeline Stages

| Enum | UI Label |
|------|----------|
| NEW | Новый |
| CONTACTED | Связались |
| QUALIFIED | Квалификация |
| PROPOSAL | Предложение |
| WON | Успешно |
| LOST | Проиграно |

Used for **Leads** and **Deals** (`CrmPipelineStage`).

---

## CRM Workspace

- One `CrmWorkspace` per `Organization` (auto-provisioned on first CRM action)
- All entities denormalized with `organizationId` + `workspaceId`
- Tenant isolation via `assertOwned()` on every service

---

## API Endpoints

| Resource | Routes |
|----------|--------|
| Overview | `GET /api/v1/crm` |
| Timeline | `GET /api/v1/crm/activities/timeline?entityType&entityId` |
| Clients | CRUD `/api/v1/crm/clients` |
| Leads | CRUD `/api/v1/crm/leads` |
| Deals | CRUD `/api/v1/crm/deals` |
| Tasks | CRUD `/api/v1/crm/tasks` |
| Notes | `GET/POST /api/v1/crm/notes` |

---

## Tool Integration

| Tool Slug | Implementation |
|-----------|----------------|
| `create-lead` | `CrmLeadService.create()` + activity log |
| `create-client` | `CrmClientService.create()` + activity log |
| `create-note` | `CrmNoteService.create()` + NOTE_ADDED activity |
| `create-task` | `CrmTaskService.create()` + activity log |

- **Stub removed** from `ToolExecutionService` and `seed-tools.ts`
- Assistants execute via existing `/v1/assistants/:id/tools/:toolInstanceId/execute`
- `sourceAgentId` recorded on leads/tasks when invoked by assistant

---

## Timeline (Client Card)

Combined feed from:
- **Activities** — CREATED, UPDATED, STATUS_CHANGED, TOOL_EXECUTED, NOTE_ADDED
- **Notes** — user comments

Displayed on `/crm/clients/:id`.

---

## UI

| Route | Content |
|-------|---------|
| `/crm` | Overview + pipeline counts |
| `/crm/leads` | Leads list + create |
| `/crm/clients` | Clients list + create |
| `/crm/clients/:id` | Client card + timeline |
| `/crm/deals` | Deals list |
| `/crm/tasks` | Tasks list |

Sidebar: **CRM** menu entry.

---

## Tests

| Suite | Tests |
|-------|-------|
| `stage-5-crm-platform.spec.ts` | 5 — tenant isolation, pipeline, tool integration |
| `stage-4-tool-registry.spec.ts` | 8 — updated CRM tool execution |

**Total Stage 5 run:** 13/13 PASS

---

## Known Limitations

1. **No Workflow Engine** — manual status changes only (Stage 6)
2. **Deals UI** — list only; no create form in UI yet (API ready)
3. **Migrations not applied on production** — deploy M5_0–M5_6 required
4. **No LLM auto tool-calling** — assistants use explicit execute API
5. **Re-seed tools** recommended to remove `stub: true` from existing DB rows

---

## Verdict

### **GO** for Stage 6 — Workflow Engine Platform

Ready:
- Full internal CRM with workspace per organization
- CRUD for clients, leads, deals, tasks, notes
- Activity audit trail + client timeline
- CRM tools create real entities via Tool Registry
- Tenant isolation on all operations
- Builds and tests green

**Recommended Stage 6 entry:**
1. Apply migrations M5_0–M5_6 on production
2. Re-run `npm run db:seed` or update tool definitions (remove stub metadata)
3. Create test lead via assistant tool execute
4. Verify client timeline on `/crm/clients/:id`

**Out of scope (as specified):** Workflow Engine, Memory, Marketplace, Agent Runtime Extensions.

---

*Report generated as part of AI Gateway Platform v2 — Stage 5.*
