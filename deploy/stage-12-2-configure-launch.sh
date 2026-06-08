#!/usr/bin/env bash
# Stage 12.2 — Apply launch ops config from secrets file (no secrets in git).
# Usage: place credentials in /root/crm-al-launch-secrets.env then run this script.
set -euo pipefail

ENV_FILE="/var/www/crm-al-tokens/apps/api/.env"
SECRETS="/root/crm-al-launch-secrets.env"

if [[ ! -f "$SECRETS" ]]; then
  echo "ERROR: $SECRETS not found"
  echo "Create file with:"
  echo "  YOOKASSA_SHOP_ID=..."
  echo "  YOOKASSA_SECRET_KEY=..."
  echo "  PAYMENT_MOCK_MODE=false"
  echo "  SMTP_HOST=..."
  echo "  SMTP_PORT=587"
  echo "  SMTP_TLS=true"
  echo "  SMTP_USER=..."
  echo "  SMTP_PASSWORD=..."
  echo "  SMTP_FROM=noreply@crm-al.neeklo.ru"
  echo "  ALERT_EMAIL=ops@example.com"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$SECRETS"
set +a

upsert() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

upsert "YOOKASSA_SHOP_ID" "${YOOKASSA_SHOP_ID:-}"
upsert "YOOKASSA_SECRET_KEY" "${YOOKASSA_SECRET_KEY:-}"
upsert "PAYMENT_MOCK_MODE" "${PAYMENT_MOCK_MODE:-false}"
upsert "SMTP_HOST" "${SMTP_HOST:-}"
upsert "SMTP_PORT" "${SMTP_PORT:-587}"
upsert "SMTP_TLS" "${SMTP_TLS:-true}"
upsert "SMTP_USER" "${SMTP_USER:-}"
upsert "SMTP_PASSWORD" "${SMTP_PASSWORD:-}"
upsert "SMTP_FROM" "${SMTP_FROM:-noreply@crm-al.neeklo.ru}"
upsert "ALERT_EMAIL" "${ALERT_EMAIL:-}"
upsert "APP_PUBLIC_URL" "${APP_PUBLIC_URL:-https://crm-al.neeklo.ru}"

docker exec crm-al-tokens-postgres psql -U crm_al_gateway -d crm_al_gateway -c \
  "UPDATE payment_providers SET is_enabled=true, is_default=true WHERE provider='YOOKASSA';" >/dev/null

pm2 restart crm-al-tokens-api --update-env
sleep 8
echo "==> Launch config applied (secrets not printed)"
python3 /tmp/stage-12-1-env-audit.py 2>/dev/null || true
