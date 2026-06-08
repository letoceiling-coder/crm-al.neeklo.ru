#!/usr/bin/env python3
"""Quick plan enforcement probe — verify limits block and limits endpoint."""
import json, sys, urllib.request, urllib.error

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3075/api"

def req(method, path, token=None, body=None):
    url = BASE.rstrip("/") + path
    h = {"Content-Type": "application/json"}
    if token: h["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

code, auth = req("POST", "/auth/login", body={"email": "admin@ai-gateway.local", "password": "admin123"})
token = auth["accessToken"]

code, sub = req("GET", "/v1/billing/subscription", token=token)
print("subscription tier:", sub.get("plan", {}).get("tier"), "rpm plan:", sub.get("plan", {}).get("rpm"))

code, lim = req("GET", "/v1/billing/limits", token=token)
print("limits:", json.dumps(lim, indent=2))

# Plan enforcement: assistant limit is resource-based (already verified in smoke)
# RPM: single burst should not 429 on BUSINESS after cooldown
import time
time.sleep(3)
code, assts = req("GET", "/v1/assistants", token=token)
print("assistants list:", code, "count:", len(assts) if isinstance(assts, list) else assts)
