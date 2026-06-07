#!/usr/bin/env bash
set -euo pipefail
docker exec crm-al-tokens-postgres sh -c '
  set -e
  cd /tmp
  rm -rf pgvector
  git clone --depth 1 --branch v0.8.0 https://github.com/pgvector/pgvector.git
  cd pgvector
  PG_CONFIG=/usr/local/bin/pg_config
  make OPTFLAGS="" PG_CONFIG=$PG_CONFIG vector.so
  cp sql/vector.sql sql/vector--0.8.0.sql
  LIBDIR=$($PG_CONFIG --pkglibdir)
  SHAREDIR=$($PG_CONFIG --sharedir)/extension
  install -m 644 vector.so "$LIBDIR/"
  install -m 644 sql/vector--*.sql sql/vector.sql vector.control "$SHAREDIR/"
  psql -U crm_al_gateway -d crm_al_gateway -c "CREATE EXTENSION IF NOT EXISTS vector;"
  psql -U crm_al_gateway -d crm_al_gateway -c "SELECT extname, extversion FROM pg_extension WHERE extname='"'"'vector'"'"';"
'
