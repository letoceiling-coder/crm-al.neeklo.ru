# Stage 0.2 — Deploy Audit

**Date:** 2026-06-07  
**Server:** `root@212.67.9.173` (jrexzkogva)  
**Domain:** https://crm-al.neeklo.ru

---

## Summary

crm-al.neeklo.ru is deployed as an **isolated monorepo** at `/var/www/crm-al-tokens`. It does **not** use git on the server. Deployments are **tarball/rsync** from a developer machine, then `npm install`, `prisma migrate deploy`, `npm run build`, and PM2 restart.

---

## Directory Structure

```
/var/www/crm-al-tokens/
├── apps/
│   ├── api/                    # NestJS API (PM2 cwd)
│   │   ├── dist/src/main.js    # PM2 entrypoint
│   │   ├── prisma/             # schema + migrations
│   │   ├── src/                # Stage 0 modules (tenant, queue, health, …)
│   │   └── .env                # production secrets (not in tarball)
│   └── web/dist/               # React static (nginx root)
├── deploy/
│   ├── deploy.sh               # full deploy script
│   ├── ecosystem.config.cjs    # PM2 config
│   └── nginx.crm-al.neeklo.ru.conf
├── docker-compose.prod.yml     # isolated Postgres + Redis
├── node_modules/               # npm workspaces root
└── package.json                # v1.0.0 (Stage 0)
```

**Backups created during Stage 0.2:**

`/var/backups/crm-al-tokens-pre-stage0-20260607212359`

---

## PM2 Processes (crm-al related)

| Process | Path | Port | Role |
|---------|------|------|------|
| `crm-al-tokens-api` | `/var/www/crm-al-tokens/apps/api` | **3075** | AI Gateway API |
| `parser-html-site` | `/var/www/parser-html-site` | **3180** | HTML parser (shared) |

**PM2 config:** `deploy/ecosystem.config.cjs`

```javascript
{
  name: 'crm-al-tokens-api',
  cwd: '/var/www/crm-al-tokens/apps/api',
  script: 'dist/src/main.js',
  env: { NODE_ENV: 'production' }
}
```

**Note:** PM2 does not load `.env` automatically — NestJS loads `apps/api/.env` at runtime.

---

## Nginx

**Vhost:** `/etc/nginx/sites-enabled/crm-al.neeklo.ru.conf` → `sites-available` symlink  
**SSL:** Let's Encrypt — `/etc/letsencrypt/live/crm-al.neeklo.ru/` (unchanged)  
**Static:** `/var/www/crm-al-tokens/apps/web/dist`  
**API proxy:** `127.0.0.1:3075/api/`

**Parser vhost (separate project):** `pars-site.neeklo.ru` → `127.0.0.1:3180`

No other nginx vhosts or SSL certificates were modified.

---

## Database & Redis (Docker)

**File:** `docker-compose.prod.yml`

| Service | Container | Host port | Credentials |
|---------|-----------|-----------|-------------|
| PostgreSQL 16 | `crm-al-tokens-postgres` | `127.0.0.1:15433` | `crm_al_gateway` / DB `crm_al_gateway` |
| Redis 7 | `crm-al-tokens-redis` | `127.0.0.1:16380` | no auth |

System PostgreSQL on `:5432` is **not** used by crm-al.

---

## Build Pipeline

Historical method (Jun 2 deploy):

1. `deploy.tar.gz` / `deploy-sync.tgz` uploaded to server
2. Manual or `deploy/deploy.sh`

**Stage 0.2 method:**

1. Local tarball: `tar --exclude=node_modules … -czf stage0-deploy.tgz`
2. `scp` → `/tmp/stage0-deploy.tgz`
3. Backup + extract to `/var/www/crm-al-tokens`
4. Preserve `apps/api/.env`
5. `npm install` → `npm run db:generate`
6. `npx prisma migrate deploy`
7. `npm run db:seed`
8. `npm run build --workspace=apps/api`
9. `pm2 restart crm-al-tokens-api --update-env`

---

## Deployment Method

| Aspect | Value |
|--------|-------|
| Git on server | **No** |
| CI/CD | **None** |
| Branch deployed | `feature/v2-platform` (local) |
| Package version | `1.0.0` |
| API version (PM2) | `1.0.0` (was `0.0.1` pre-deploy) |
| Migrations on disk | **11** |
| Migrations in DB | **11** applied (+ 1 duplicate row from failed m0_8 retry — harmless) |

---

## Related Projects (untouched)

- `agro-neeklo` — occupies `127.0.0.1:3080` (bun)
- `gpt.neeklo.ru` — shared Selectel S3 credentials reused for crm-al
- 30+ other PM2 processes on same host

---

## Parser Architecture

| Item | Value |
|------|-------|
| Service | `parser-html-site` |
| Code | `/var/www/parser-html-site` |
| Config | `deploy/ecosystem.config.cjs` |
| Env file | `.env.production` (PORT=3180) |
| Nginx | `pars-site.neeklo.ru` → `:3180` |
| Default port in code | `3080` (fallback if PORT unset) |
