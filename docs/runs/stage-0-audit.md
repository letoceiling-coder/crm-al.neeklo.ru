# Stage 0 — Pre-Implementation Audit

**Date:** 2026-06-07  
**Branch target:** `feature/v2-platform`  
**Architecture:** v2.3.1 (APPROVED)  
**Scope:** Etap 0 Foundation only

---

## 1. Project Structure

| Area | Path | Status |
|------|------|--------|
| API | `apps/api` | NestJS 10, Prisma 6 |
| Web | `apps/web` | React/Vite — **out of Stage 0 scope** |
| Docs | `docs/` | Architecture frozen v2.3.1 |
| Migrations | `apps/api/prisma/migrations/` | 7 incremental SQL files (no init migration in repo) |

**Git:** Currently on `main`; `docs/` untracked. Branch `feature/v2-platform` to be created.

---

## 2. Prisma Schema (as-is)

**File:** `apps/api/prisma/schema.prisma`

| Model | Stage 0 action |
|-------|----------------|
| User | Add `activeOrganizationId` |
| ApiKey | Add `organizationId` (required after backfill) |
| UsageLog | Add `tokenCostSnapshotId`, `costUsd` |
| Organization | **NEW** |
| OrganizationMember | **NEW** |
| PlanLimits | **NEW** |
| EncryptedSecret | **NEW** |
| ProviderAccount | **NEW** |
| TokenCostSnapshot | **NEW** |
| EmbeddingProfile | **NEW** |
| knowledge_embeddings | **NEW** (raw SQL + pgvector) |

**Not in schema (correct — later stages):** KnowledgeSource, KnowledgeBase, CRM, Assistants, Tools, Workflow, Memory.

**Existing enums:** UserRole, ApiKeyStatus, AuditAction, etc. — unchanged.

---

## 3. Existing Migrations

| Migration | Purpose |
|-----------|---------|
| `20250602120000_api_key_balance` | balance_rub, spent_rub |
| `20250602130000_api_key_price_per_million` | price_per_million_rub |
| `20250602140000_key_model_profiles` | KeyModelProfile tables |
| `20250602150000_api_key_encrypted` | key_encrypted |
| `20250602160000_api_key_top_ups` | ApiKeyTopUp |
| `20250602170000_audit_api_key_top_up` | Audit enum |
| `20250602180000_usage_log_profile_slug` | profile_slug |

**Gap:** Base schema applied via `prisma db push` or missing init migration. Stage 0 adds named migrations per architecture.

---

## 4. NestJS Modules (as-is)

| Module | Controllers | Stage 0 touch |
|--------|-------------|---------------|
| AuthModule | login, profile, 2FA | JWT + org context |
| UsersModule | CRUD users | Personal org on create |
| ApiKeysModule | keys, balance, top-ups | organizationId on create |
| GatewayModule | chat/completions, agents/chat | UsageLog + snapshot |
| UsageModule | analytics | TokenCostSnapshot |
| OpenRouterModule | OR keys | — |
| AgentsModule | agents CRUD | **no changes** |
| ModelsModule | models sync | — |
| KeyModelProfilesModule | profiles | — |
| AuditModule | audit logs | — |
| PrismaModule | global | — |

**Missing (Stage 0 to add):**

- OrganizationsModule
- TenantModule (Guard, Context, Interceptor)
- SecretsModule
- ProviderAccountsModule
- TokenCostModule
- QueueModule (+ BullBoard)
- ParserClientModule
- StorageModule
- HealthModule (extended)
- EmbeddingModule (profile foundation)

---

## 5. API Routes (as-is)

**Prefix:** `/api`

| Route group | Auth |
|-------------|------|
| `/auth/*` | Public login; JWT elsewhere |
| `/users/*` | JWT + ADMIN |
| `/api-keys/*` | JWT |
| `/v1/chat/completions` | ApiKeyOrJwtGuard (agw_) |
| `/v1/agents/:id/chat` | ApiKeyOrJwtGuard |
| `/usage/*` | JWT |
| `/admin/*` | JWT + ADMIN |

**Stage 0 new routes:**

- `GET/PATCH /v1/organizations/current`
- `POST /v1/organizations/switch/:orgId`
- `GET /v1/organizations/current/members`
- `GET/POST /v1/provider-accounts`
- `GET/POST /admin/token-cost-snapshots`
- `GET /health` (extended)
- `GET /admin/queues` (BullBoard)

---

## 6. Auth Guards (as-is)

| Guard | File | Behavior |
|-------|------|----------|
| GlobalAuthGuard | `global-auth.guard.ts` | JWT unless @Public |
| RolesGuard | `roles.guard.ts` | UserRole check |
| ApiKeyOrJwtGuard | `api-key-or-jwt.guard.ts` | agw_ or JWT on /v1/ |

**JwtStrategy** returns `{ id, email, role, theme }` — **no organizationId**.

**Gap:** TenantGuard, TenantContext, TenantInterceptor — to implement.

---

## 7. RBAC (as-is)

- **Platform RBAC:** `UserRole` (USER, DEVELOPER, ADMIN) via RolesGuard
- **Organization RBAC:** **not implemented** — need `OrganizationRole` (OWNER, ADMIN, MANAGER, OPERATOR)

Stage 0: JWT carries `organizationId` + `organizationRole` from OrganizationMember.

---

## 8. Dependencies (as-is)

| Package | Version | Wired |
|---------|---------|-------|
| @nestjs/bullmq | ^10.2.3 | **Not in AppModule** |
| bullmq | ^5.34.8 | — |
| ioredis | ^5.4.2 | — |
| axios | ^1.7.9 | Used by OpenRouter |

**Stage 0 installs:**

- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
- `@bull-board/api`, `@bull-board/nestjs`, `@bull-board/express`

---

## 9. ENV (as-is vs Stage 0)

**Existing (.env.example):** DATABASE_URL, REDIS_URL, JWT_*, OPENROUTER_*, CORS, PORT

**Stage 0 additions:**

```env
SECRET_ENCRYPTION_KEY=
PARSER_BASE_URL=https://pars-site.neeklo.ru
PARSER_API_KEY=
PARSER_DEFAULT_TIMEOUT_MS=120000
PARSER_POLL_INTERVAL_MS=4000
PARSER_MAX_RETRIES=2
S3_ENDPOINT=https://s3.ru-3.storage.selcloud.ru
S3_REGION=ru-3
S3_BUCKET=crm-al-knowledge
S3_ACCESS_KEY=
S3_SECRET_KEY=
BULL_BOARD_PATH=/admin/queues
```

---

## 10. Tests (as-is)

**Unit tests:** none in repo  
**E2E config:** `test/jest-e2e.json` exists, no specs

**Stage 0:** `test/tenant-guard.e2e-spec.ts` — TenantGuard integration tests

---

## 11. Implementation Plan (ordered)

| Step | Task | Migration |
|------|------|-----------|
| 1 | Branch `feature/v2-platform` | — |
| 2 | Prisma schema + M0_0 organization | `m0_0_organization_foundation` |
| 3 | M0_4 token_cost_snapshots | `m0_4_token_cost_snapshots` |
| 4 | M0_5 provider_accounts + encrypted_secrets | `m0_5_provider_accounts` |
| 5 | pgvector + EmbeddingProfile | `m0_8_pgvector_embedding_foundation` |
| 6 | TenantModule + OrganizationsModule | — |
| 7 | SecretsModule | — |
| 8 | ProviderAccountsModule + TokenCostModule | — |
| 9 | QueueModule + BullBoard | — |
| 10 | ParserClientModule | — |
| 11 | StorageModule | — |
| 12 | Wire AppModule, update Auth/ApiKeys/Usage/Gateway | — |
| 13 | Seed + .env.example | — |
| 14 | Integration tests + implementation report | — |

---

## 12. Risks Identified Pre-Implementation

| Risk | Mitigation |
|------|------------|
| No PostgreSQL locally for migrate | SQL migrations written; `prisma migrate deploy` on server |
| pgvector not on local PG | Extension in migration; document requirement |
| PARSER_API_KEY / S3 keys missing locally | Health returns degraded; services fail gracefully with clear errors |
| Backfill existing ApiKeys without org | SQL backfill in M0_0 migration |

---

## 13. Audit Conclusion

**Ready for Stage 0 implementation:** YES

No architecture deviations required. All deliverables map to v2.3.1 §12–§16 and Stage 0 task list.

**Next step:** Create branch → implement migrations → modules → tests → report.
