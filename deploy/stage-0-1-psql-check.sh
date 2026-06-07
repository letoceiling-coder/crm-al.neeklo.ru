#!/usr/bin/env bash
# Read DATABASE_URL from .env and strip ?schema= for psql
ENV_FILE="/var/www/crm-al-tokens/apps/api/.env"
DBURL=$(grep '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | sed 's/?schema=public//')
echo "DBURL_PREFIX:${DBURL%%@*}@***"

psql "$DBURL" -t -A -c "SELECT version();" | head -1
psql "$DBURL" -t -A -c "SELECT extname FROM pg_extension WHERE extname='vector';"
psql "$DBURL" -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10;"
psql "$DBURL" -t -A -c "SELECT to_regclass('public.organizations');"
psql "$DBURL" -t -A -c "SELECT column_name FROM information_schema.columns WHERE table_name='api_keys' AND column_name='organization_id';"
