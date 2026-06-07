# Stage 1B — Assistant Management UI Report

**Date:** 2026-06-07  
**Branch:** `feature/v2-platform`  
**Production:** https://crm-al.neeklo.ru/assistants

---

## Summary

Assistant Management UI implemented per Stage 1B spec. React + TypeScript + React Query + shadcn-style components. No modals — inline forms and full pages only.

| Deliverable | Status |
|-------------|--------|
| Menu «AI Ассистенты» | ✅ |
| `/assistants` list | ✅ |
| `/assistants/create` | ✅ |
| `/assistants/:id` detail | ✅ |
| Variables tab | ✅ |
| API Keys tab | ✅ |
| Analytics / History placeholders | ✅ |
| Dark/Light (theme system) | ✅ existing |
| Web build | ✅ PASS |

---

## Routes

| Route | Page |
|-------|------|
| `/assistants` | List with table |
| `/assistants/create` | Template picker + form |
| `/assistants/:id` | Detail with tabs |

Legacy global agents remain at `/agents` («Глобальные агенты» in sidebar).

---

## List Page (`/assistants`)

Columns:

- name (+ slug)
- agentType (localized badge)
- status (color badge)
- apiKeysCount (`_count.agentApiKeys`)
- createdAt / updatedAt
- link to detail

Empty state with CTA → create.

---

## Create Page (`/assistants/create`)

- Grid of templates from `GET /v1/assistants/templates`
- Click template → prefills name, type, description, systemPrompt
- Inline validation (name, slug format, prompt required if no template)
- `POST /v1/assistants` via React Query mutation
- Redirect to detail on success

---

## Detail Page (`/assistants/:id`)

### Tabs

| Tab | Implementation |
|-----|----------------|
| **General** | Edit name, type, status, description, systemPrompt — `PATCH /v1/assistants/:id` |
| **Variables** | CRUD rows, save batch, render preview with missing warnings |
| **API Keys** | Inline create form, table with rotate/revoke/reveal |
| **Analytics** | Placeholder — Stage 2+ |
| **History** | Placeholder — Stage 2+ |

### Variables Tab

- Standard vars pre-filled: `company_name`, `phone`, `email`, `website`, `crm_url`
- `POST /v1/assistants/:id/variables` upsert
- `POST /v1/assistants/:id/render-prompt` preview
- Missing variable warnings (amber alert)

### API Keys Tab

- Requires billing `agw_` key selection
- Environment selector (PRODUCTION, TEST, CRM, TELEGRAM, WEBHOOK, INTERNAL)
- Scope toggles (all 8 scopes)
- Optional expiration datetime
- Create → show plaintext once
- Rotate / Revoke / Reveal actions

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 19 + Vite |
| Routing | react-router-dom v7 |
| Data | @tanstack/react-query v5 |
| UI | shadcn-style (Button, Card, Tabs, Input, Badge) |
| Icons | lucide-react |
| API client | axios `/api` |

---

## Files Added

```
apps/web/src/pages/assistants/index.tsx
apps/web/src/pages/assistants/create.tsx
apps/web/src/pages/assistants/detail.tsx
apps/web/src/components/assistants/variables-tab.tsx
apps/web/src/components/assistants/api-keys-tab.tsx
apps/web/src/components/ui/tabs.tsx
apps/web/src/lib/assistants.ts
```

Modified: `App.tsx`, `sidebar.tsx`

---

## RBAC

- All assistant routes behind existing `AppLayout` auth (JWT required)
- Admin-only sections unchanged (`/admin/*`)
- Assistant CRUD available to any authenticated org member (matches API TenantGuard)
- Global admin role does not bypass org scope on API

---

## Not Implemented (per spec)

- Knowledge Base UI
- Tools UI
- CRM UI
- Memory / Workflow / RAG / Chat runtime
- Analytics & History (placeholders only)

---

## Production Deployment

Web static files rebuilt on server:

```bash
npm run build --workspace=apps/web
# dist → nginx root /var/www/crm-al-tokens/apps/web/dist
```

Verify: https://crm-al.neeklo.ru/assistants (login required)

---

## Stage 2 Verdict

# GO

Stage 1B UI is complete for Assistant Management scope. **Stage 2 (Knowledge Base)** may begin.

**Recommended Stage 2 prerequisites:**

1. User acceptance test: create assistant from template on production
2. Create `agt_` key and verify reveal/rotate/revoke
3. Optional: add Analytics/History when backend audit endpoints exist

**Not blocking Stage 2:**

- Analytics/History tabs are intentional placeholders
- Chat runtime / agt_ gateway auth deferred to later stage per architecture
