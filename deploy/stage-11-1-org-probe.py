#!/usr/bin/env python3
"""Org invitation accept, role change, member remove."""
import json, sys, urllib.request, urllib.error

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3075/api"
PASS, FAIL = [], []

def ok(m): PASS.append(m); print("PASS:", m)
def fail(m): FAIL.append(m); print("FAIL:", m)

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

admin = req("POST", "/auth/login", body={"email": "admin@ai-gateway.local", "password": "admin123"})[1]["accessToken"]
dev = req("POST", "/auth/login", body={"email": "dev@ai-gateway.local", "password": "dev123"})[1]["accessToken"]

code, inv = req("POST", "/v1/organizations/current/members/invite", token=admin, body={
    "email": "dev@ai-gateway.local", "role": "MANAGER",
})
token = inv.get("token") if code in (200, 201) else None
ok("invite created") if token else fail(f"invite {code} {inv}")

code, acc = req("POST", "/v1/organizations/invitations/accept", token=dev, body={"token": token})
ok("accept invitation") if code in (200, 201) else fail(f"accept {code} {acc}")

code, members = req("GET", "/v1/organizations/current/members", token=admin)
dev_member = next((m for m in members if (m.get("user") or {}).get("email") == "dev@ai-gateway.local"), None) if code == 200 else None
mid = dev_member.get("id") if dev_member else None
ok(f"dev member id={mid}") if mid else fail("dev member not found")

if mid:
    code, _ = req("PATCH", f"/v1/organizations/current/members/{mid}", token=admin, body={"role": "OPERATOR"})
    ok("role change to OPERATOR") if code == 200 else fail(f"role change {code}")
    code, _ = req("DELETE", f"/v1/organizations/current/members/{mid}", token=admin)
    ok("member removed") if code in (200, 204) else fail(f"remove {code}")

print(json.dumps({"pass": len(PASS), "fail": len(FAIL)}, indent=2))
sys.exit(1 if FAIL else 0)
