#!/usr/bin/env python3
"""Stage 12.1 — SMTP / env config audit (no secrets printed)."""
import subprocess
import json

ENV = "/var/www/crm-al-tokens/apps/api/.env"
KEYS = [
    "YOOKASSA_SHOP_ID", "YOOKASSA_SECRET_KEY", "PAYMENT_MOCK_MODE",
    "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM",
    "REGISTRATION_ENABLED", "ALERT_EMAIL", "APP_PUBLIC_URL",
]

result = {}
with open(ENV) as f:
    lines = {l.split("=", 1)[0]: l.split("=", 1)[1].strip() for l in f if "=" in l and not l.startswith("#")}

for k in KEYS:
    v = lines.get(k, "")
    result[k] = {"set": bool(v), "value_hint": ("true" if v.lower() == "true" else "false" if v.lower() == "false" else "***" if v else "MISSING")}

mig = subprocess.check_output([
    "docker", "exec", "crm-al-tokens-postgres", "psql", "-U", "crm_al_gateway", "-d", "crm_al_gateway",
    "-tAc", "SELECT COUNT(1) FROM _prisma_migrations",
], text=True).strip()

pay = subprocess.check_output([
    "docker", "exec", "crm-al-tokens-postgres", "psql", "-U", "crm_al_gateway", "-d", "crm_al_gateway",
    "-tAc", "SELECT status||':'||COUNT(*) FROM payments GROUP BY status",
], text=True).strip()

print(json.dumps({"env": result, "migrations": int(mig), "payments": pay}, indent=2))
