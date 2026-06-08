# Recovery Runbooks — AI Gateway Platform

**Production:** https://crm-al.neeklo.ru  
**Server:** `/var/www/crm-al-tokens`

---

## Billing Failure

1. Check `/api/v1/billing/subscription` and `/api/v1/billing/invoices`
2. Verify `subscriptions` + `plan_limits` in PostgreSQL
3. Re-sync limits: `POST /api/v1/billing/subscription/change` with FREE then target tier
4. Rollback DB from `/var/backups/crm-al-gateway-db-pre-*` if migration corrupt

## Payment Failure

1. Check PM2 logs: `pm2 logs crm-al-tokens-api`
2. Verify env: `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `PAYMENT_MOCK_MODE=false`
3. Inspect `payments` + `payment_events` tables
4. Replay webhook: `POST /api/v1/payments/webhook/mock` (test only)
5. Manual complete (mock): `POST /api/v1/payments/:id/mock-complete`

## SMTP Failure

1. Verify `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_TLS`
2. Emails log as `[EMAIL STUB]` when SMTP unset — invitations still create tokens in UI
3. Check `AlertingService.smtpFailure` in API logs
4. Fallback: copy invitation token from `/organization/invitations`

## S3 Outage

1. Document upload fails — check `/api/health` dependencies
2. Workers queue backlog — `/api/v1/system/queues`
3. Pause knowledge ingest until S3 restored
4. Retry failed jobs from knowledge jobs UI

## Redis Outage

1. Plan enforcement may fail open or error — restart Redis container
2. Queue workers stall — `pm2 restart crm-al-worker-*`
3. Cache miss only — platform degrades to DB, not data loss

## PostgreSQL Outage

1. `/api/health` → database check fails
2. Restart: `docker restart crm-al-tokens-postgres`
3. Restore from latest `/var/backups/crm-al-gateway-db-pre-*.sql`
4. Run `npx prisma migrate deploy` after restore

---

**Escalation:** restore from Stage 11.1 backup set documented in `docs/runs/stage-11-1-production-deploy-report.md`
