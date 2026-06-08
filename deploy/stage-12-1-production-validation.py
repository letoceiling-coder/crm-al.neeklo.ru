#!/usr/bin/env python3
"""Stage 12.1 — Production validation (billing, registration, onboarding, ops)."""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3075/api"
PUBLIC = sys.argv[2] if len(sys.argv) > 2 else "https://crm-al.neeklo.ru"
PASS: list[str] = []
FAIL: list[str] = []
WARN: list[str] = []


def ok(m: str) -> None:
    PASS.append(m)
    print(f"PASS: {m}")


def fail(m: str) -> None:
    FAIL.append(m)
    print(f"FAIL: {m}")


def warn(m: str) -> None:
    WARN.append(m)
    print(f"WARN: {m}")


def req(method: str, path: str, token: str | None = None, body: dict | None = None):
    url = BASE.rstrip("/") + path
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"raw": raw[:300]}


def login(email: str, password: str) -> str:
    code, data = req("POST", "/auth/login", body={"email": email, "password": password})
    if code not in (200, 201) or not data or "accessToken" not in data:
        raise RuntimeError(f"login failed: {code} {data}")
    return data["accessToken"]


def main() -> None:
    admin = login("admin@ai-gateway.local", "admin123")
    ok("admin login")

    print("\n=== Stage 12 modules ===")
    for path in [
        "/v1/payments/providers",
        "/v1/onboarding/status",
        "/auth/registration-status",
        "/v1/billing/plans",
    ]:
        code, _ = req("GET", path, token=admin if "onboarding" in path else None)
        ok(f"GET {path} => {code}") if code == 200 else fail(f"GET {path} => {code}")

    code, reg = req("GET", "/auth/registration-status")
    if code == 200:
        ok(f"registration enabled={reg.get('enabled')}")

    print("\n=== Billing tiers ===")
    code, plans = req("GET", "/v1/billing/plans", token=admin)
    tiers = {p.get("tier") for p in plans} if isinstance(plans, list) else set()
    for t in ("FREE", "PRO", "BUSINESS", "ENTERPRISE"):
        ok(f"tier {t}") if t in tiers else fail(f"tier {t} missing")

    print("\n=== Payment flow (mock if enabled) ===")
    req("POST", "/v1/billing/subscription/change", token=admin, body={"tier": "FREE"})
    time.sleep(1)
    code, change = req("POST", "/v1/billing/subscription/change", token=admin, body={"tier": "PRO"})
    inv_id = None
    if code in (200, 201) and isinstance(change, dict) and change.get("pending"):
        ok("PRO upgrade creates pending invoice")
        inv_id = change.get("invoice", {}).get("id")
    else:
        fail(f"pending invoice flow {code} {change}")

    if inv_id:
        code, pay = req("POST", f"/v1/payments/invoices/{inv_id}/pay", token=admin, body={})
        if code in (200, 201) and isinstance(pay, dict):
            ok(f"payment initiated status={pay.get('status')}")
            pay_id = pay.get("id")
            if pay.get("confirmationUrl") and "mockPayment" in str(pay.get("confirmationUrl")):
                warn("PAYMENT_MOCK_MODE active — not real YooKassa")
            if pay_id:
                code, done = req("POST", f"/v1/payments/{pay_id}/mock-complete", token=admin)
                ok("mock-complete") if code in (200, 201) else warn(f"mock-complete {code} (may be disabled)")
        else:
            fail(f"pay invoice {code} {pay}")

    code, sub = req("GET", "/v1/billing/subscription", token=admin)
    tier = sub.get("plan", {}).get("tier") if isinstance(sub, dict) else None
    ok(f"subscription tier={tier}") if tier == "PRO" else fail(f"subscription {tier}")

    print("\n=== Webhook endpoint ===")
    code, wh = req("POST", "/v1/payments/webhook/yookassa", body={"event": "ping", "object": {"id": "test", "status": "waiting_for_capture"}})
    ok(f"webhook reachable => {code}") if code in (200, 201) else fail(f"webhook {code}")

    print("\n=== Onboarding ===")
    code, ob = req("GET", "/v1/onboarding/status", token=admin)
    ok("onboarding status") if code == 200 and isinstance(ob, dict) else fail(f"onboarding {code}")

    print("\n=== Marketplace PAID package ===")
    tag = f"stage121-{int(time.time())}"
    code, pkg = req("POST", "/v1/marketplace/packages", token=admin, body={
        "name": f"Stage 12.1 PAID {tag}",
        "slug": f"stage-121-paid-{tag}",
        "type": "ASSISTANT",
        "visibility": "PRIVATE",
        "manifest": {"type": "ASSISTANT", "assistant": {"name": "T", "systemPrompt": "T"}},
        "billingType": "PAID",
        "price": 990,
        "currency": "RUB",
    })
    if code in (200, 201):
        ok("PAID marketplace package created")
        warn("Marketplace purchase checkout not implemented — backlog")
    else:
        fail(f"marketplace package {code}")

    print("\n=== Operations ===")
    for path in ["/v1/system/queues", "/v1/system/health", "/v1/system/dependencies"]:
        code, _ = req("GET", path, token=admin)
        ok(f"ops {path}") if code == 200 else fail(f"ops {path} => {code}")

    print("\n=== Regression ===")
    for path in ["/v1/assistants", "/v1/knowledge-bases", "/v1/workflows", "/v1/crm/clients", "/v1/marketplace/categories"]:
        code, _ = req("GET", path, token=admin)
        ok(f"regression {path}") if code == 200 else fail(f"regression {path} => {code}")

    print("\n=== Public routes ===")
    for path in ["/register", "/legal/terms"]:
        try:
            r = urllib.request.urlopen(PUBLIC.rstrip("/") + path, timeout=30)
            ok(f"{path} => {r.status}")
        except Exception as e:
            fail(f"{path}: {e}")

    print("\n=== Summary ===")
    print(json.dumps({"pass": len(PASS), "warn": len(WARN), "fail": len(FAIL), "failures": FAIL, "warnings": WARN}, indent=2))
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
