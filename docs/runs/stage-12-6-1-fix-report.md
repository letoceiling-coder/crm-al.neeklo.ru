# Stage 12.6.1 — Knowledge Base + YooKassa + SMTP Fix

**Date:** 2026-06-08

## A. Knowledge taxonomy 400 fix

**Root cause:** DTOs used `@IsUUID()` but Prisma IDs are **CUID** (`@default(cuid())`).

**Fix:** `IsCuid` validator + updated `knowledge-taxonomy.dto.ts` for all list/create/assign endpoints.

## B. URL ingestion

- URL sources always use mode **`parser-html-site`**
- Endpoint: `https://pars-site.neeklo.ru/v1/parse` (async)
- Parser API key: **System → Monitoring** (encrypted, server-side only)
- Flow: URL → parser → text → chunk → embed → `knowledge_chunks`

## C. Source health

Health API exposes: `status` (PENDING/PROCESSING/COMPLETED/FAILED), `progress` 0–100, `lastRunAt`, `lastSuccessAt`, `lastError`.

## D. Payments — YooKassa only

- API returns YooKassa provider only
- UI: single card with Save / Test Connection / Create Test Payment
- Launch Center: `paymentConfigured`, `paymentTestPassed`

## E. SMTP

- UI fields: host, port, secure, username, password, fromEmail
- Launch Center: `smtpConfigured`, `emailTestPassed`

## Deploy

Build API + Web, deploy to production, configure parser key + YooKassa + SMTP via admin UI.
