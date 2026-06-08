#!/usr/bin/env python3
import subprocess
r = subprocess.run(
    ["docker", "exec", "crm-al-tokens-postgres", "psql", "-U", "crm_al_gateway", "-d", "crm_al_gateway", "-tAc",
     "SELECT COUNT(*) FROM _prisma_migrations"],
    capture_output=True, text=True,
)
print("migrations_applied=", r.stdout.strip())
r2 = subprocess.run(
    ["docker", "exec", "crm-al-tokens-postgres", "psql", "-U", "crm_al_gateway", "-d", "crm_al_gateway", "-tAc",
     "SELECT rpm, daily_requests, monthly_tokens FROM plan_limits LIMIT 1"],
    capture_output=True, text=True,
)
print("plan_limits_sample=", r2.stdout.strip())
import glob
js = glob.glob("/var/www/crm-al-tokens/apps/web/dist/assets/index-*.js")
if js:
    c = open(js[0], encoding="utf-8", errors="ignore").read()
    for s in ["/system", "Marketplace", "Система"]:
        print(s, "YES" if s in c else "NO")
