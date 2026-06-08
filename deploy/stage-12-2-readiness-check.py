#!/usr/bin/env python3
"""Stage 12.2 — 48h readiness + infrastructure check."""
import json, urllib.request, urllib.error, subprocess, sys

BASE = "http://127.0.0.1:3075/api"
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


def req(method, path, token=None, body=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


try:
    h = json.loads(urllib.request.urlopen("http://127.0.0.1:3075/api/health", timeout=15).read().decode())
    ok("API health") if h.get("ok") else fail(f"health {h}")
    for k, v in (h.get("checks") or {}).items():
        if isinstance(v, dict):
            if k == "queues":
                ok("health queues") if v.get("redis") else fail("health queues redis down")
            elif v.get("ok") is False:
                fail(f"health check {k} failed")
            elif v.get("ok") is True:
                ok(f"health {k}")
except Exception as e:
    fail(f"health {e}")

code, auth = req("POST", "/auth/login", body={"email": "admin@ai-gateway.local", "password": "admin123"})
token = auth.get("accessToken") if isinstance(auth, dict) else None
ok("admin login") if token else fail(f"login {code}")

if token:
    for path in ["/v1/system/queues", "/v1/system/health", "/v1/system/dependencies"]:
        code, _ = req("GET", path, token=token)
        ok(path) if code == 200 else fail(f"{path} {code}")

out = subprocess.check_output(["pm2", "jlist"], text=True)
procs = json.loads(out)
crm = [p for p in procs if p.get("name", "").startswith("crm-al")]
online = sum(1 for p in crm if p.get("pm2_env", {}).get("status") == "online")
ok(f"PM2 crm online={online}/{len(crm)}") if online == len(crm) and len(crm) >= 6 else fail(f"pm2 {online}/{len(crm)}")

try:
    subprocess.check_output(
        ["docker", "exec", "crm-al-tokens-postgres", "psql", "-U", "crm_al_gateway", "-d", "crm_al_gateway", "-tAc", "SELECT 1"],
        text=True,
    )
    ok("PostgreSQL")
except Exception as e:
    fail(f"PostgreSQL {e}")

try:
    audit = json.loads(subprocess.check_output(["python3", "/tmp/stage-12-1-env-audit.py"], text=True))
    env = audit.get("env", {})
    ok("YOOKASSA configured") if env.get("YOOKASSA_SHOP_ID", {}).get("set") else fail("YOOKASSA not configured")
    ok("SMTP configured") if env.get("SMTP_HOST", {}).get("set") else fail("SMTP not configured")
    mock = env.get("PAYMENT_MOCK_MODE", {}).get("value_hint")
    ok("PAYMENT_MOCK_MODE=false") if mock == "false" else warn(f"PAYMENT_MOCK_MODE={mock}")
except Exception as e:
    warn(f"env audit {e}")

print(json.dumps({"pass": len(PASS), "warn": len(WARN), "fail": len(FAIL)}, indent=2))
sys.exit(1 if FAIL else 0)
