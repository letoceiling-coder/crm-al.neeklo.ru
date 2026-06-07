# Stage 1A — Production Deploy Report

**Date:** 2026-06-07  
**Server:** `root@212.67.9.173`  
**Domain:** https://crm-al.neeklo.ru  
**Backup:** `/var/backups/crm-al-tokens-pre-stage1a-20260607214312`

---

## Summary

Stage 1A (Assistant Core API) deployed to production successfully.

| Step | Result |
|------|--------|
| Tarball extract | ✅ |
| `npm install` | ✅ (+ `@nestjs/swagger@7`) |
| `npx prisma migrate deploy` | ✅ 4 migrations applied |
| `npm run db:seed` | ✅ 10 templates seeded |
| `npm run build --workspace=apps/api` | ✅ |
| `pm2 restart crm-al-tokens-api --update-env` | ✅ v1.0.0 |

**Stage 1B UI** deployed in follow-up pass (web build + static dist updated).

---

## Migrations Applied

| Migration | Status |
|-----------|--------|
| `20250608100000_m1_0_agent_templates` | ✅ |
| `20250608101000_m1_1_key_agents` | ✅ |
| `20250608102000_m1_2_agent_api_keys` | ✅ |
| `20250608103000_m1_3_agent_variables` | ✅ |

Total migrations on server: **15**

---

## Commands Executed

```bash
bash /tmp/stage-1a-deploy-remote.sh
# internally:
npm install
npm run db:generate
npx prisma migrate deploy
npm run db:seed
npm run build --workspace=apps/api
npm run build --workspace=apps/web
pm2 restart crm-al-tokens-api --update-env
```

Stage 1B web update:

```bash
tar -xzf /tmp/stage1b-deploy.tgz
npm run build --workspace=apps/web
pm2 restart crm-al-tokens-api --update-env
```

---

## Verification

| Endpoint | Result |
|----------|--------|
| `GET /api/docs` | **200** |
| `GET /api/docs-json` | **200** |
| `GET /api/v1/assistants/templates` (no auth) | **401** (expected) |
| `GET /api/v1/assistants/templates` (JWT) | **200**, 10 templates |
| `GET /api/v1/assistants` (JWT) | **200**, `[]` |
| `https://crm-al.neeklo.ru/api/docs` | **200** |
| `https://crm-al.neeklo.ru/assistants` | **200** (SPA) |

Authenticated check:

```bash
python3 /tmp/verify-stage1a-api.py
# templates_count=10
# assistants_count=0
# OK
```

Seed credentials used for smoke test: `admin@ai-gateway.local` / `admin123`

---

## Production State

| Item | Value |
|------|-------|
| API version | 1.0.0 |
| PM2 process | `crm-al-tokens-api` online |
| Agent templates in DB | 10 |
| Key agents | 0 (fresh) |
| Swagger | `/api/docs` |

---

## Verdict

# GO — Stage 1A production deploy complete

Stage 1B UI deployed to same server. Ready for user acceptance testing at https://crm-al.neeklo.ru/assistants
