#!/usr/bin/env python3
"""Stage 12.6.3 — Production smoke validation."""
import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("CRM_BASE", "https://crm-al.neeklo.ru")
API = f"{BASE}/api"
TOKEN = os.environ.get("CRM_ADMIN_TOKEN", "")

PASS = 0
FAIL = 0


def ok(msg):
    global PASS
    PASS += 1
    print(f"  PASS  {msg}")


def fail(msg):
    global FAIL
    FAIL += 1
    print(f"  FAIL  {msg}")


def req(method, path, body=None, auth=True):
    headers = {"Content-Type": "application/json"}
    if auth and TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(f"{API}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode())
        except Exception:
            body = {"raw": e.read().decode()[:200]}
        return e.code, body


def main():
    print(f"==> Stage 12.6.3 validation @ {BASE}\n")

    code, health = req("GET", "/health", auth=False)
    ok(f"health {code}") if code == 200 else fail(f"health {code}")

    if not TOKEN:
        fail("CRM_ADMIN_TOKEN not set — skipping authenticated checks")
        print(f"\nResult: {PASS} pass, {FAIL} fail")
        sys.exit(1 if FAIL else 0)

    for path in [
        "/v1/system/settings/payments",
        "/v1/system/settings/email",
        "/v1/system/settings/alerts",
        "/v1/system/launch",
    ]:
        code, data = req("GET", path)
        ok(f"GET {path} → {code}") if code == 200 else fail(f"GET {path} → {code} {data}")

    code, payments = req("GET", "/v1/system/settings/payments")
    if code == 200:
        providers = payments if isinstance(payments, list) else []
        names = [p.get("provider") for p in providers]
        if names == ["YOOKASSA"] or (len(names) == 1 and names[0] == "YOOKASSA"):
            ok("payments API YooKassa-only")
        else:
            fail(f"payments providers unexpected: {names}")

    code, alerts = req("GET", "/v1/system/settings/alerts")
    if code == 200:
        for key in ("parserAlerts", "telegramEnabled", "telegramChatId"):
            ok(f"alerts.{key} present") if key in alerts else fail(f"alerts missing {key}")

    code, launch = req("GET", "/v1/system/launch")
    if code == 200:
        checks = launch.get("checks", {})
        ok(f"launch verdict={launch.get('verdict')} readiness={launch.get('readinessPercent')}%")
        for k in ("smtpConfigured", "emailTestPassed", "paymentConfigured", "paymentTestPassed"):
            v = checks.get(k)
            print(f"        launch.{k}={v}")

    code, _ = req("GET", "/v1/payments/providers")
    if code == 200:
        ok("tenant payment providers endpoint")

    # KB taxonomy (needs org context — may 401 without org header; try anyway)
    code, tax = req("GET", "/v1/knowledge/categories?knowledgeBaseId=test")
    if code in (200, 400, 404):
        ok(f"knowledge categories reachable ({code})")
    elif code == 401:
        fail("knowledge categories 401")
    else:
        fail(f"knowledge categories {code}")

    print(f"\n==> Result: {PASS} pass, {FAIL} fail")
    sys.exit(0 if FAIL == 0 else 1)


if __name__ == "__main__":
    main()
