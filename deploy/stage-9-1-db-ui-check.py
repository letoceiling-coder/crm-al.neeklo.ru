#!/usr/bin/env python3
import json, urllib.request, os, subprocess

BASE = "http://127.0.0.1:3075/api"

def psql(sql):
    env = {}
    with open("/var/www/crm-al-tokens/apps/api/.env") as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                url = line.strip().split("=", 1)[1].strip().strip('"')
                # postgresql://user:pass@host:port/db
                break
    # use docker postgres
    cmd = [
        "docker", "exec", "crm-al-tokens-postgres",
        "psql", "-U", "crm_al_gateway", "-d", "crm_al_gateway",
        "-tAc", sql,
    ]
    return subprocess.check_output(cmd, text=True).strip()

tables = [
    "marketplace_packages",
    "marketplace_versions",
    "marketplace_installs",
    "marketplace_reviews",
    "marketplace_categories",
    "marketplace_assets",
]
print("=== Tables ===")
for t in tables:
    exists = psql(f"SELECT to_regclass('public.{t}')")
    print(f"{t}: {exists}")

print("categories_count:", psql("SELECT COUNT(*) FROM marketplace_categories"))
print("packages_count:", psql("SELECT COUNT(*) FROM marketplace_packages"))
print("installs_count:", psql("SELECT COUNT(*) FROM marketplace_installs"))

print("\n=== UI bundle ===")
js = "/var/www/crm-al-tokens/apps/web/dist/assets/index-C3bV7uDT.js"
with open(js, encoding="utf-8", errors="ignore") as f:
    content = f.read()
for s in ["Marketplace", "/marketplace/publish", "/marketplace/my", "/marketplace/installed", "Установленные", "Опубликовать", "Мои пакеты"]:
    print(f"{s}: {'YES' if s in content else 'NO'}")

print("\n=== Public API ===")
for path in ["/health", "/v1/marketplace/packages"]:
    url = f"https://crm-al.neeklo.ru/api{path}"
    try:
        r = urllib.request.urlopen(url, timeout=15)
        print(f"{path} => {r.status}")
    except urllib.error.HTTPError as e:
        print(f"{path} => {e.code}")
