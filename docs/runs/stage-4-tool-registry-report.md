# Stage 4 — Tool Registry Platform Report

**Date:** 2026-06-07  
**Branch:** `feature/v2-platform`  
**Architecture:** v2.3.1 (frozen)  
**Scope:** Tool Registry — providers, catalog, instances, assistant bindings, execution — **без** CRM бизнес-логики, Workflow, Memory, Marketplace, Agent Runtime Extensions

---

## Summary

| Deliverable | Status |
|-------------|--------|
| M4_0 ToolProvider | ✅ |
| M4_1 ToolDefinition | ✅ |
| M4_2 ToolInstance + EncryptedSecret | ✅ |
| M4_3 AssistantToolBinding | ✅ |
| M4_4 ToolExecutionLog | ✅ |
| ToolExecutionService pipeline | ✅ |
| Test connection (`POST .../test`) | ✅ |
| Starter catalog (12 tools) | ✅ |
| UI: `/tools`, `/tools/catalog`, `/tools/instances`, `/tools/:id` | ✅ |
| Assistant tab «Инструменты» | ✅ |
| Tests (8 Stage 4) | ✅ PASS |
| API build | ✅ PASS |
| Web build | ✅ PASS |

---

## Migrations

| ID | File | Changes |
|----|------|---------|
| M4_0 | `20250609140000_m4_0_tool_providers` | `tool_providers`, enum `ToolProviderType` |
| M4_1 | `20250609141000_m4_1_tool_definitions` | `tool_definitions` |
| M4_2 | `20250609142000_m4_2_tool_instances` | `tool_instances`, enums `ToolInstanceStatus`, `ToolExecutionStatus` |
| M4_3 | `20250609143000_m4_3_assistant_tool_bindings` | `assistant_tool_bindings` |
| M4_4 | `20250609144000_m4_4_tool_execution_logs` | `tool_execution_logs` |

**Total migrations after deploy:** 30

---

## Provider Types

| Type | Execution |
|------|-----------|
| INTERNAL | Built-in executor (KB search, CRM stubs, messaging sim) |
| WEBHOOK | HTTP POST/HEAD to configured URL |
| REST_API | Generic HTTP with Bearer secret |
| GRAPHQL | Test stub (full execution Stage 5+) |
| MCP | Test stub (full execution Stage 6) |

---

## Starter Catalog (12)

Telegram · MAX · Email · Webhook · HTTP Request · Create Lead · Create Client · Create Note · Create Task · Generate PDF · Generate DOCX · Knowledge Search

Seeded via `prisma/seed-tools.ts` on `npm run db:seed`.

---

## Pipeline

```text
Assistant
  ↓
AssistantToolBinding (enabled, priority, allowedActions)
  ↓
ToolInstance (settings + EncryptedSecret)
  ↓
ToolExecutionService.dispatch()
  ↓
Result
  ↓
ToolExecutionLog
```

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/tools/catalog` | List tool definitions |
| GET | `/api/v1/tools/catalog/providers` | List providers |
| GET | `/api/v1/tools/catalog/:slug` | Definition detail |
| GET/POST | `/api/v1/tools/instances` | List / create instances |
| GET/PATCH/DELETE | `/api/v1/tools/instances/:id` | Instance CRUD |
| POST | `/api/v1/tools/instances/:id/secrets` | Set encrypted secret |
| POST | `/api/v1/tools/instances/:id/test` | **Проверить подключение** |
| POST | `/api/v1/tools/instances/:id/execute` | Manual execution |
| GET/POST/PATCH/DELETE | `/api/v1/assistants/:id/tool-bindings` | Assistant bindings |
| POST | `/api/v1/assistants/:id/tools/:toolInstanceId/execute` | Execute via assistant |

---

## Secrets

- `ToolInstance.secretId` → `EncryptedSecret` (AES-256-GCM via `SecretEncryptionService`)
- Plain secrets never stored in `settings` JSON
- Tenant-scoped read/write/delete

---

## UI

| Route | Content |
|-------|---------|
| `/tools` | Hub: catalog + instances summary |
| `/tools/catalog` | System catalog cards |
| `/tools/instances` | Organization instances + create form |
| `/tools/:id` | Instance detail, test button, execution log |
| Assistant → **Инструменты** | Bindings table (status, last run) |

Sidebar: **Инструменты** menu entry added.

---

## Tests

| Suite | Tests | Coverage |
|-------|-------|----------|
| `stage-4-tool-registry.spec.ts` | **8/8 PASS** | Tenant isolation, plan limits, execution logs, secret handling, test connection |

---

## Known Limitations

1. **CRM tools are stubs** — Create Lead/Client/Note/Task return placeholder; real CRM in Stage 5
2. **Telegram/MAX/Email** — connection test only; dispatch simulated
3. **GRAPHQL / MCP** — test stub only; full client in later stages
4. **No LLM tool-calling loop** — manual/binding execute API; auto-invoke in runtime Stage 5+
5. **Migrations not applied on production** — deploy M4_0–M4_4 + run seed

---

## Verdict

### **GO** for Stage 5 — Internal CRM Platform

Ready:
- Tool catalog with 12 system definitions
- Organization-scoped instances with encrypted secrets
- Assistant ↔ tool bindings with priority
- Execution service + audit logs
- Test connection UI per tool
- Tenant isolation on all operations
- Builds and tests green

**Recommended Stage 5 entry:**
1. Apply migrations M4_0–M4_4 on production
2. Run `npm run db:seed` for tool catalog
3. Create test webhook instance and verify «Проверить подключение»
4. Wire CRM stubs → real `CrmWorkspace` entities

**Out of scope (as specified):** Workflow Engine, Memory, Marketplace, Agent Runtime Extensions.

---

*Report generated as part of AI Gateway Platform v2 — Stage 4.*
