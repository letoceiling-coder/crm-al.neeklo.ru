#!/usr/bin/env python3
"""Stage 12.4.2 — Post-deploy validation."""
import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:3075/api"
PASS, FAIL = [], []


def ok(m):
    PASS.append(m)
    print("PASS:", m)


def fail(m):
    FAIL.append(m)
    print("FAIL:", m)


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
        body_raw = e.read().decode()
        try:
            return e.code, json.loads(body_raw)
        except Exception:
            return e.code, body_raw


# Unauthenticated routes — expect 401 not 404
for ep in [
    "/v1/system/settings/general",
    "/v1/system/settings/payments",
    "/v1/system/settings/email",
    "/v1/system/settings/alerts",
    "/v1/system/settings/registration",
    "/v1/system/settings/billing",
    "/v1/system/launch",
]:
    code, _ = req("GET", ep)
    ok(f"unauth {ep} -> {code}") if code in (401, 403) else fail(f"unauth {ep} -> {code} (expected 401/403)")

code, auth = req("POST", "/auth/login", body={"email": "admin@ai-gateway.local", "password": "admin123"})
token = auth.get("accessToken") if isinstance(auth, dict) else None
ok("admin login") if token else fail(f"admin login {code}")

if token:
    for ep in [
        "/v1/system/settings/general",
        "/v1/system/settings/payments",
        "/v1/system/settings/email",
        "/v1/system/settings/alerts",
        "/v1/system/settings/registration",
        "/v1/system/settings/billing",
        "/v1/system/launch",
    ]:
        code, data = req("GET", ep, token=token)
        ok(f"admin {ep} -> {code}") if code == 200 else fail(f"admin {ep} -> {code}")

    code, launch = req("GET", "/v1/system/launch", token=token)
    if code == 200 and isinstance(launch, dict):
        ok(f"launch verdict={launch.get('verdict')} readiness={launch.get('readinessPercent')}%")
        if launch.get("verdict") != "NO-GO":
            fail(f"launch expected NO-GO got {launch.get('verdict')}")
    else:
        fail(f"launch {code}")

print(json.dumps({"pass": len(PASS), "fail": len(FAIL), "failures": FAIL}, indent=2))
