#!/usr/bin/env python3
"""Stage 12.1 — Registration validation (temporarily enables registration)."""
import json, subprocess, time, urllib.request, urllib.error

ENV = "/var/www/crm-al-tokens/apps/api/.env"
BASE = "http://127.0.0.1:3075/api"

def req(method, path, body=None, token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

def set_reg(val: str):
    subprocess.run(["sed", "-i", f"s/^REGISTRATION_ENABLED=.*/REGISTRATION_ENABLED={val}/", ENV], check=True)
    subprocess.run(["pm2", "restart", "crm-al-tokens-api", "--update-env"], capture_output=True)
    time.sleep(8)

PASS, FAIL = [], []

def ok(m): PASS.append(m); print("PASS:", m)
def fail(m): FAIL.append(m); print("FAIL:", m)

try:
    set_reg("true")
    code, st = req("GET", "/auth/registration-status")
    ok(f"registration enabled={st.get('enabled')}") if st.get("enabled") else fail(f"not enabled {st}")

    email = f"stage121-{int(time.time())}@test.local"
    code, reg = req("POST", "/auth/register", {
        "email": email, "password": "test123456",
        "organizationName": "Stage 12.1 Test Org", "name": "Test User",
    })
    token = reg.get("accessToken") if isinstance(reg, dict) else None
    ok("register + token") if code in (200, 201) and token else fail(f"register {code} {reg}")

    if token:
        code, sub = req("GET", "/v1/billing/subscription", token=token)
        tier = sub.get("plan", {}).get("tier") if isinstance(sub, dict) else None
        ok(f"FREE plan tier={tier}") if tier == "FREE" else fail(f"tier {tier}")

        code, members = req("GET", "/v1/organizations/current/members", token=token)
        owner = any(
            (m.get("user") or {}).get("email") == email and m.get("role") == "OWNER"
            for m in (members if isinstance(members, list) else [])
        )
        ok("OWNER role") if owner else fail(f"members {members}")

        code, ob = req("GET", "/v1/onboarding/status", token=token)
        ok("onboarding status") if code == 200 else fail(f"onboarding {code}")

        code, _ = req("POST", "/v1/onboarding/advance", token=token)
        ok("onboarding advance") if code in (200, 201) else fail(f"advance {code}")
finally:
    set_reg("false")
    ok("registration restored to false")

print(json.dumps({"pass": len(PASS), "fail": len(FAIL), "failures": FAIL}, indent=2))
