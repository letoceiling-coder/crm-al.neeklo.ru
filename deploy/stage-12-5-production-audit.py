#!/usr/bin/env python3
"""Stage 12.5 — Commercial launch production audit (run locally or on server)."""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://crm-al.neeklo.ru/api"
PUBLIC = BASE.replace("/api", "")
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
            return e.code, {"raw": raw[:500]}


def login(email: str, password: str) -> tuple[str, dict]:
    code, data = req("POST", "/auth/login", body={"email": email, "password": password})
    if code not in (200, 201) or not data or "accessToken" not in data:
        raise RuntimeError(f"login failed: {code} {data}")
    return data["accessToken"], data.get("user", {})


def main() -> None:
    print("=== Stage 12.5 Production Audit ===")
    print(f"BASE: {BASE}\n")

    admin, _ = login("admin@ai-gateway.local", "admin123")
    ok("admin login")

    # Phase 1 — Payment configuration audit
    print("\n=== Phase 1: Payment Configuration ===")
    code, providers = req("GET", "/v1/system/settings/payments", token=admin)
    if code != 200 or not isinstance(providers, list):
        fail(f"GET payments settings => {code}")
        providers = []

    for p in providers:
        prov = p.get("provider", "?")
        enabled = p.get("isEnabled")
        default = p.get("isDefault")
        test_mode = p.get("testMode")
        shop = p.get("shopId") or ""
        has_secret = p.get("hasSecretKey")
        webhook = p.get("webhookUrl", "")
        ret = p.get("returnUrl", "")
        line = (
            f"{prov}: enabled={enabled} default={default} testMode={test_mode} "
            f"shopId={'set' if shop else 'empty'} secret={'yes' if has_secret else 'no'}"
        )
        if prov == "YOOKASSA":
            if enabled and default and shop and has_secret and not test_mode:
                ok(line)
            else:
                fail(line)
            if "yookassa" in webhook.lower():
                ok(f"YOOKASSA webhook URL present")
            else:
                fail(f"YOOKASSA webhook URL missing")
            if ret:
                ok(f"YOOKASSA return URL present")
        else:
            warn(line)

    # Phase 3 — SMTP audit
    print("\n=== Phase 3: SMTP Configuration ===")
    code, smtp = req("GET", "/v1/system/settings/email", token=admin)
    if code == 200 and isinstance(smtp, dict):
        for k in ("host", "port", "tls", "user", "from"):
            v = smtp.get(k)
            if k == "host" and v:
                ok(f"SMTP {k}={v}")
            elif k == "port" and v:
                ok(f"SMTP port={v}")
            elif k == "tls":
                ok(f"SMTP tls={v}")
            elif k == "user" and v:
                ok(f"SMTP user set")
            elif k == "from" and v:
                ok(f"SMTP from={v}")
            elif k in ("host", "user", "from"):
                fail(f"SMTP {k} not configured")
        if smtp.get("configured"):
            ok("SMTP configured=true")
        else:
            fail("SMTP configured=false")
        if smtp.get("hasPassword"):
            ok("SMTP password stored")
        else:
            fail("SMTP password missing")
    else:
        fail(f"GET email settings => {code}")

    # Phase 4 — Alerts
    print("\n=== Phase 4: Alerting ===")
    code, alerts = req("GET", "/v1/system/settings/alerts", token=admin)
    if code == 200 and isinstance(alerts, dict):
        email = alerts.get("alertEmail") or ""
        if email:
            ok(f"alertEmail set")
        else:
            fail("alertEmail empty")
    else:
        fail(f"GET alerts => {code}")

    # Phase 5 — Registration
    print("\n=== Phase 5: Registration ===")
    code, reg = req("GET", "/v1/system/settings/registration", token=admin)
    code2, pub_reg = req("GET", "/auth/registration-status")
    if code == 200 and isinstance(reg, dict):
        if reg.get("enabled"):
            ok("registration.enabled=true (admin settings)")
        else:
            fail("registration.enabled=false")
    if code2 == 200 and isinstance(pub_reg, dict):
        if pub_reg.get("enabled"):
            ok("public registration-status enabled=true")
        else:
            fail(f"public registration-status enabled={pub_reg.get('enabled')}")

    # Phase 7 — Launch Center
    print("\n=== Phase 7: Launch Center ===")
    code, launch = req("GET", "/v1/system/launch", token=admin)
    readiness = 0
    verdict = "NO-GO"
    if code == 200 and isinstance(launch, dict):
        readiness = launch.get("readinessPercent", 0)
        verdict = launch.get("verdict", "NO-GO")
        checks = launch.get("checks", {})
        for k, v in checks.items():
            (ok if v else fail)(f"launch.{k}={v}")
        if readiness == 100 and verdict == "GO":
            ok(f"Launch readiness {readiness}% verdict=GO")
        else:
            fail(f"Launch readiness {readiness}% verdict={verdict}")
    else:
        fail(f"GET launch => {code}")

    # Phase 9 — Security (secrets not exposed)
    print("\n=== Phase 9: Security ===")
    if isinstance(providers, list):
        for p in providers:
            if "secretKey" in json.dumps(p).lower() and p.get("secretKey"):
                fail(f"{p.get('provider')} secretKey exposed in API")
            else:
                ok(f"{p.get('provider')} secret not exposed (hasSecretKey only)")
    if isinstance(smtp, dict):
        if smtp.get("password"):
            fail("SMTP password exposed in API")
        else:
            ok("SMTP password not exposed")
    for ep in ["/v1/system/settings/general", "/v1/system/launch"]:
        code_u, _ = req("GET", ep)
        if code_u in (401, 403):
            ok(f"unauth {ep} => {code_u}")
        elif code_u == 404:
            fail(f"unauth {ep} => 404")
        else:
            warn(f"unauth {ep} => {code_u}")

    # Summary
    print("\n=== SUMMARY ===")
    print(f"PASS: {len(PASS)}")
    print(f"FAIL: {len(FAIL)}")
    print(f"WARN: {len(WARN)}")
    print(f"Launch Readiness: {readiness}%")
    print(f"Verdict: {verdict}")
    result = {
        "pass": len(PASS),
        "fail": len(FAIL),
        "warn": len(WARN),
        "readinessPercent": readiness,
        "verdict": verdict,
        "commercialLaunch": "GO" if readiness == 100 and verdict == "GO" and len(FAIL) == 0 else "NO-GO",
    }
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["commercialLaunch"] == "GO" else 1)


if __name__ == "__main__":
    main()
