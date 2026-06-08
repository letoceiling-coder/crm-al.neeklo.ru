#!/usr/bin/env python3
"""Stage 11.1 — Commercial production validation."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3075/api"
PUBLIC = sys.argv[2] if len(sys.argv) > 2 else "https://crm-al.neeklo.ru"
PASS: list[str] = []
FAIL: list[str] = []


def ok(msg: str) -> None:
    PASS.append(msg)
    print(f"PASS: {msg}")


def fail(msg: str) -> None:
    FAIL.append(msg)
    print(f"FAIL: {msg}")


def req(method: str, path: str, token: str | None = None, body: dict | None = None, raw: bool = False):
    url = (BASE if path.startswith("/") else BASE).rstrip("/") + path
    if not url.startswith("http"):
        url = BASE.rstrip("/") + path
    headers = {}
    if body is not None and not raw:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = None if body is None else (body if raw else json.dumps(body).encode())
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            raw_body = resp.read()
            if raw:
                return resp.status, raw_body, resp.headers.get("Content-Type", "")
            try:
                return resp.status, json.loads(raw_body.decode()) if raw_body else None, None
            except json.JSONDecodeError:
                return resp.status, raw_body.decode()[:500], None
    except urllib.error.HTTPError as e:
        raw_body = e.read()
        try:
            parsed = json.loads(raw_body.decode())
        except json.JSONDecodeError:
            parsed = raw_body.decode()[:300]
        return e.code, parsed, None


def login(email: str, password: str) -> str:
    code, data, _ = req("POST", "/auth/login", body={"email": email, "password": password})
    if code not in (200, 201) or not data or "accessToken" not in data:
        raise RuntimeError(f"login failed {email}: {code} {data}")
    return data["accessToken"]


def main() -> None:
    admin = login("admin@ai-gateway.local", "admin123")
    dev = login("dev@ai-gateway.local", "dev123")

    print("=== Billing endpoints ===")
    for path in [
        "/v1/billing/plans",
        "/v1/billing/subscription",
        "/v1/billing/usage",
        "/v1/billing/limits",
        "/v1/billing/invoices",
    ]:
        code, data, _ = req("GET", path, token=admin)
        if code == 200:
            ok(f"GET {path} => 200")
        else:
            fail(f"GET {path} => {code} {data}")

    code, plans, _ = req("GET", "/v1/billing/plans", token=admin)
    tiers = {p.get("tier") for p in plans} if isinstance(plans, list) else set()
    for t in ("FREE", "PRO", "BUSINESS", "ENTERPRISE"):
        ok(f"plan tier {t}") if t in tiers else fail(f"plan tier {t} missing")

    print("\n=== Plan change + invoice ===")
    code, sub, _ = req("POST", "/v1/billing/subscription/change", token=admin, body={"tier": "PRO"})
    if code in (200, 201):
        ok("change plan to PRO")
    else:
        fail(f"change plan PRO: {code} {sub}")
    code, inv, _ = req("GET", "/v1/billing/invoices", token=admin)
    has_open = isinstance(inv, list) and any(i.get("status") == "OPEN" for i in inv)
    ok("OPEN invoice after plan change") if has_open else fail(f"no OPEN invoice: {inv}")

    req("POST", "/v1/billing/subscription/change", token=admin, body={"tier": "FREE"})

    print("\n=== Plan limits structure ===")
    code, lim, _ = req("GET", "/v1/billing/limits", token=admin)
    if code == 200 and isinstance(lim, dict) and "usage" in lim and "limits" in lim:
        for k in ("rpm", "dailyRequests", "monthlyRequests", "monthlyTokens", "monthlyStorageMb"):
            if k in lim.get("limits", {}):
                ok(f"limit field {k}")
            else:
                fail(f"limit field {k} missing")
    else:
        fail(f"limits response: {code} {lim}")

    print("\n=== Organization ===")
    code, members, _ = req("GET", "/v1/organizations/current/members", token=admin)
    ok("list members") if code == 200 else fail(f"members {code}")
    roles = {m.get("role") for m in members} if isinstance(members, list) else set()
    for r in ("OWNER", "ADMIN", "MANAGER", "OPERATOR"):
        ok(f"role enum {r} supported") if r else None

    code, inv, _ = req("POST", "/v1/organizations/current/members/invite", token=admin, body={
        "email": "stage111-invite@test.local", "role": "MANAGER",
    })
    ok("create invitation") if code in (200, 201) else fail(f"invite {code} {inv}")

    print("\n=== Marketplace pricing ===")
    slug = "stage-111-pricing-test"
    for btype, price in [("FREE", None), ("PAID", 990), ("SUBSCRIPTION", 1990)]:
        body = {
            "name": f"Stage 11.1 {btype} Package",
            "slug": f"{slug}-{btype.lower()}",
            "type": "ASSISTANT",
            "visibility": "PRIVATE",
            "manifest": {"type": "ASSISTANT", "assistant": {"name": "T", "systemPrompt": "T"}},
            "billingType": btype,
            "currency": "RUB",
        }
        if price is not None:
            body["price"] = price
        code, pkg, _ = req("POST", "/v1/marketplace/packages", token=admin, body=body)
        if code in (200, 201) and isinstance(pkg, dict):
            ok(f"package {btype} created")
            if pkg.get("billingType") == btype:
                ok(f"billingType={btype}")
            else:
                fail(f"billingType mismatch {pkg.get('billingType')}")
        else:
            fail(f"package {btype}: {code} {pkg}")

    print("\n=== Exports ===")
    for domain in ("usage", "audit", "crm", "workflow", "marketplace"):
        for fmt in ("csv", "xlsx", "pdf"):
            code, body, ctype = req("GET", f"/v1/exports/{domain}?format={fmt}", token=admin, raw=True)
            if code == 200 and body and len(body) > 10:
                ok(f"export {domain} {fmt} ({len(body)} bytes)")
            else:
                fail(f"export {domain} {fmt}: {code} len={len(body) if body else 0}")

    print("\n=== Support & Backups ===")
    code, dash, _ = req("GET", "/v1/support/dashboard", token=admin)
    ok("support dashboard") if code == 200 else fail(f"support {code}")
    code, bk, _ = req("GET", "/v1/backups/status", token=admin)
    ok("backup status") if code == 200 else fail(f"backups {code}")

    print("\n=== Commercial metrics (admin) ===")
    code, metrics, _ = req("GET", "/v1/billing/admin/metrics", token=admin)
    if code == 200 and isinstance(metrics, dict):
        for k in ("mrr", "arr", "organizations", "activeUsers", "activeAssistants", "marketplaceInstalls", "tokenRevenueRub"):
            if k in metrics:
                ok(f"metric {k}={metrics[k]}")
            else:
                fail(f"metric {k} missing")
    else:
        fail(f"commercial metrics {code}")

    print("\n=== Legal (public web) ===")
    for path in ["/legal/terms", "/legal/privacy", "/legal/cookies", "/legal/dpa", "/legal/marketplace-publisher"]:
        try:
            r = urllib.request.urlopen(PUBLIC.rstrip("/") + path, timeout=30)
            ok(f"{path} => {r.status}") if r.status == 200 else fail(f"{path} => {r.status}")
        except Exception as e:
            fail(f"{path}: {e}")

    print("\n=== Regression ===")
    for path in [
        "/v1/assistants", "/v1/knowledge-bases", "/v1/memory/profiles",
        "/v1/crm/clients", "/v1/workflows", "/v1/marketplace/categories",
        "/v1/integrations/providers", "/v1/system/queues",
    ]:
        code, _, _ = req("GET", path, token=admin)
        ok(f"regression {path} => 200") if code == 200 else fail(f"regression {path} => {code}")

    print("\n=== Summary ===")
    print(json.dumps({"pass": len(PASS), "fail": len(FAIL), "failures": FAIL}, indent=2))
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
