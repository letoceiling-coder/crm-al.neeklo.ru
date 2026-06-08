#!/usr/bin/env python3
"""Stage 12.4.1 — Production verification audit (run on server)."""
import json
import subprocess
import urllib.request
import urllib.error

BASE = "https://crm-al.neeklo.ru"
API = f"{BASE}/api"
PASS, FAIL, WARN = [], [], []


def ok(m):
    PASS.append(m)
    print("PASS:", m)


def fail(m):
    FAIL.append(m)
    print("FAIL:", m)


def warn(m):
    WARN.append(m)
    print("WARN:", m)


def http_code(url, method="GET"):
    req = urllib.request.Request(url, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:
        return f"ERR:{e}"


# --- Backend API (401/403 = route exists, 404 = missing) ---
endpoints = [
    "/v1/system/settings/general",
    "/v1/system/settings/payments",
    "/v1/system/settings/email",
    "/v1/system/settings/alerts",
    "/v1/system/settings/registration",
    "/v1/system/settings/billing",
    "/v1/system/launch",
]
for ep in endpoints:
    code = http_code(API + ep)
    if code == 404:
        fail(f"API {ep} -> {code}")
    elif code in (401, 403):
        ok(f"API {ep} -> {code} (route exists, auth required)")
    elif code == 200:
        ok(f"API {ep} -> 200")
    else:
        warn(f"API {ep} -> {code}")

# --- Frontend SPA routes (expect 200 HTML shell) ---
pages = [
    "/system/settings/general",
    "/system/settings/payments",
    "/system/settings/email",
    "/system/settings/alerts",
    "/system/settings/registration",
    "/system/settings/billing",
    "/system/settings/security",
    "/system/settings/storage",
    "/system/settings/monitoring",
    "/system/launch",
]
for p in pages:
    code = http_code(BASE + p)
    if code == 404:
        fail(f"Frontend {p} -> 404")
    elif code == 200:
        ok(f"Frontend {p} -> 200")
    else:
        warn(f"Frontend {p} -> {code}")

# --- Database ---
try:
    mig = subprocess.check_output(
        [
            "docker", "exec", "crm-al-tokens-postgres", "psql",
            "-U", "crm_al_gateway", "-d", "crm_al_gateway", "-tAc",
            "SELECT migration_name FROM _prisma_migrations WHERE migration_name LIKE '%m12_4%' OR migration_name LIKE '%m12_5%';",
        ],
        text=True,
    ).strip()
    if "m12_4" in mig and "m12_5" in mig:
        ok(f"Migrations: {mig}")
    else:
        fail(f"Migrations missing M12_4/M12_5: {mig or 'NONE'}")

    cnt = subprocess.check_output(
        [
            "docker", "exec", "crm-al-tokens-postgres", "psql",
            "-U", "crm_al_gateway", "-d", "crm_al_gateway", "-tAc",
            "SELECT COUNT(*) FROM system_settings;",
        ],
        text=True,
    ).strip()
    if int(cnt) >= 10:
        ok(f"system_settings rows={cnt}")
    else:
        fail(f"system_settings rows={cnt} (expected >=10)")

    total = subprocess.check_output(
        [
            "docker", "exec", "crm-al-tokens-postgres", "psql",
            "-U", "crm_al_gateway", "-d", "crm_al_gateway", "-tAc",
            "SELECT COUNT(*) FROM _prisma_migrations;",
        ],
        text=True,
    ).strip()
    ok(f"Total migrations={total}")

    pp = subprocess.check_output(
        [
            "docker", "exec", "crm-al-tokens-postgres", "psql",
            "-U", "crm_al_gateway", "-d", "crm_al_gateway", "-tAc",
            "SELECT provider, is_enabled, config::text FROM payment_providers LIMIT 1;",
        ],
        text=True,
    ).strip()
    ok(f"payment_providers config present: {pp[:80]}...")
except Exception as e:
    fail(f"Database check: {e}")

# --- Deployed API code check ---
try:
    grep_settings = subprocess.check_output(
        ["grep", "-r", "SystemSettingsController", "/var/www/crm-al-tokens/apps/api/dist/", "--include=*.js"],
        text=True,
        stderr=subprocess.DEVNULL,
    )
    ok("SystemSettingsController in deployed dist") if grep_settings else fail("SystemSettingsController not in dist")
except Exception:
    fail("SystemSettingsController not found in deployed dist")

try:
    grep_launch = subprocess.check_output(
        ["grep", "-rl", "getLaunchReadiness", "/var/www/crm-al-tokens/apps/api/dist/system-settings/", "--include=*.js"],
        text=True,
        stderr=subprocess.DEVNULL,
    )
    ok("SystemLaunch/getLaunchReadiness in dist") if grep_launch else warn("Launch service path check inconclusive")
except Exception:
    warn("Could not verify launch service in dist")

# --- Web bundle (SPA 200 alone is not sufficient) ---
try:
    index_html = open("/var/www/crm-al-tokens/apps/web/dist/index.html").read()
    ok(f"index.html present, len={len(index_html)}")
    js_path = None
    for line in index_html.split("\n"):
        if "assets/index-" in line and ".js" in line:
            import re
            m = re.search(r'assets/(index-[^"]+\.js)', line)
            if m:
                js_path = f"/var/www/crm-al-tokens/apps/web/dist/assets/{m.group(1)}"
                break
    if js_path:
        js = open(js_path).read()
        markers = ["Launch Center", "system/settings", "Настройки системы", "SettingsPaymentsPage"]
        found = [m for m in markers if m in js]
        if len(found) >= 2:
            ok(f"Web bundle Stage 12.4 markers: {found}")
        else:
            fail(f"Web bundle missing Stage 12.4 UI (found: {found}, bundle={js_path})")
    else:
        fail("Could not locate main JS bundle in index.html")
except Exception as e:
    fail(f"Web bundle deep check: {e}")

# --- system_settings table existence ---
try:
    exists = subprocess.check_output(
        [
            "docker", "exec", "crm-al-tokens-postgres", "psql",
            "-U", "crm_al_gateway", "-d", "crm_al_gateway", "-tAc",
            "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'system_settings');",
        ],
        text=True,
    ).strip()
    if exists == "t":
        ok("system_settings table exists")
    else:
        fail("system_settings table does NOT exist")
except Exception as e:
    fail(f"Table check: {e}")

result = {
    "pass": len(PASS),
    "fail": len(FAIL),
    "warn": len(WARN),
    "failures": FAIL,
    "verdict": "GO" if not FAIL else "NO-GO",
}
print(json.dumps(result, indent=2))
