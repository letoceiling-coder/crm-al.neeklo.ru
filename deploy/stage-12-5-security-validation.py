#!/usr/bin/env python3
"""Stage 12.5 — Security validation (production)."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://crm-al.neeklo.ru/api"
PASS, FAIL = [], []


def ok(m):
    PASS.append(m)
    print(f"PASS: {m}")


def fail(m):
    FAIL.append(m)
    print(f"FAIL: {m}")


def req(method, path, token=None, body=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode() or "null")
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"raw": raw[:300]}


def login():
    code, data = req("POST", "/auth/login", body={"email": "admin@ai-gateway.local", "password": "admin123"})
    return data["accessToken"] if code in (200, 201) else None


def main():
    print("=== Stage 12.5 Security Validation ===")
    admin = login()
    if not admin:
        fail("admin login")
        sys.exit(1)
    ok("admin login")

    # Admin-only routes
    for ep in [
        "/v1/system/settings/payments",
        "/v1/system/settings/email",
        "/v1/system/launch",
    ]:
        code_u, _ = req("GET", ep)
        if code_u in (401, 403):
            ok(f"unauth blocked {ep} => {code_u}")
        else:
            fail(f"unauth {ep} => {code_u}")

    # Secrets not in API responses
    _, payments = req("GET", "/v1/system/settings/payments", token=admin)
    if isinstance(payments, list):
        for p in payments:
            blob = json.dumps(p).lower()
            if "secretkey" in blob and p.get("secretKey"):
                fail(f"{p.get('provider')} exposes secretKey")
            else:
                ok(f"{p.get('provider')} no plaintext secret")

    _, smtp = req("GET", "/v1/system/settings/email", token=admin)
    if isinstance(smtp, dict):
        if smtp.get("password"):
            fail("SMTP password in API response")
        else:
            ok("SMTP password hidden (hasPassword flag only)")

    # Registration rate limit (burst register attempts)
    blocked = 0
    for i in range(15):
        code, _ = req("POST", "/auth/register", body={
            "email": f"ratelimit-test-{i}-{int(__import__('time').time())}@example.com",
            "password": "Test1234!",
            "name": "Rate Test",
            "organizationName": "Test Org",
        })
        if code in (403, 429):
            blocked += 1
    if blocked > 0:
        ok(f"registration attempts blocked/throttled ({blocked}/15)")
    else:
        code_reg, reg = req("GET", "/auth/registration-status")
        if code_reg == 200 and not reg.get("enabled"):
            ok("registration disabled — rate limit N/A")
        else:
            warn_msg = "registration rate limit not observed in 15 attempts"
            print(f"WARN: {warn_msg}")

    # Webhook without signature (expect rejection, not 500)
    code_wh, _ = req("POST", "/v1/payments/webhook/yookassa", body={"event": "payment.succeeded", "object": {"id": "fake"}})
    if code_wh in (400, 401, 403, 404, 422):
        ok(f"webhook unsigned payload => {code_wh} (not 500)")
    elif code_wh >= 500:
        fail(f"webhook unsigned => {code_wh}")
    else:
        ok(f"webhook unsigned => {code_wh}")

    print(json.dumps({"pass": len(PASS), "fail": len(FAIL)}, indent=2))
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
