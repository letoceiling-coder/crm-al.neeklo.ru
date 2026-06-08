#!/usr/bin/env python3
"""Stage 12 — Payment + subscription E2E (mock mode)."""
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
        with urllib.request.urlopen(r, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

code, auth = req("POST", "/auth/login", body={"email": "admin@ai-gateway.local", "password": "admin123"})
token = auth["accessToken"]
ok("login")

code, change = req("POST", "/v1/billing/subscription/change", token=token, body={"tier": "FREE"})
ok("reset FREE") if code in (200, 201) else fail(f"reset FREE {code}")

code, change = req("POST", "/v1/billing/subscription/change", token=token, body={"tier": "PRO"})
if code in (200, 201) and change.get("pending"):
    ok("plan change creates pending invoice")
    inv_id = change["invoice"]["id"]
else:
    fail(f"pending invoice {code} {change}")
    inv_id = None

if inv_id:
    code, pay = req("POST", f"/v1/payments/invoices/{inv_id}/pay", token=token, body={})
    ok(f"initiate payment {code}") if code in (200, 201) else fail(f"pay {code} {pay}")
    pay_id = pay.get("id") if isinstance(pay, dict) else None
    if pay_id:
        code, done = req("POST", f"/v1/payments/{pay_id}/mock-complete", token=token)
        ok("mock payment complete") if code in (200, 201) else fail(f"mock complete {code} {done}")

code, sub = req("GET", "/v1/billing/subscription", token=token)
tier = sub.get("plan", {}).get("tier") if isinstance(sub, dict) else None
ok(f"subscription PRO after payment ({tier})") if tier == "PRO" else fail(f"subscription tier {tier}")

code, inv = req("GET", "/v1/billing/invoices", token=token)
paid = isinstance(inv, list) and any(i.get("status") == "PAID" for i in inv)
ok("invoice PAID") if paid else fail(f"invoices {inv}")

code, reg = req("GET", "/auth/registration-status")
ok("registration status endpoint") if code == 200 else fail(f"reg status {code}")

print(json.dumps({"pass": len(PASS), "fail": len(FAIL), "failures": FAIL}, indent=2))
sys.exit(1 if FAIL else 0)
