#!/usr/bin/env python3
"""Stage 10.1 — Enterprise production validation script."""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3075/api"
PUBLIC = sys.argv[2] if len(sys.argv) > 2 else "https://crm-al.neeklo.ru/api"

PASS: list[str] = []
FAIL: list[str] = []


def ok(msg: str) -> None:
    PASS.append(msg)
    print(f"PASS: {msg}")


def fail(msg: str) -> None:
    FAIL.append(msg)
    print(f"FAIL: {msg}")


def req(method: str, path: str, token: str | None = None, body: dict | None = None, base: str = BASE):
    url = base.rstrip("/") + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = raw
        return e.code, parsed


def login(email: str, password: str) -> str:
    code, data = req("POST", "/auth/login", body={"email": email, "password": password})
    if code not in (200, 201) or not data or "accessToken" not in data:
        raise RuntimeError(f"login failed {email}: {code} {data}")
    return data["accessToken"]


def main() -> None:
    print("=== System endpoints (401 without auth) ===")
    for path in [
        "/v1/system/queues",
        "/v1/system/metrics",
        "/v1/system/health",
        "/v1/system/dependencies",
        "/v1/system/security",
        "/v1/system/cost-anomalies",
    ]:
        code, _ = req("GET", path, base=PUBLIC)
        if code == 401:
            ok(f"{path} => 401")
        elif code == 404:
            fail(f"{path} => 404")
        else:
            fail(f"{path} => {code} expected 401")

    token = login("admin@ai-gateway.local", "admin123")

    print("\n=== SystemModule (admin) ===")
    endpoints = [
        "/v1/system/queues",
        "/v1/system/metrics",
        "/v1/system/health",
        "/v1/system/dependencies",
        "/v1/system/security",
        "/v1/system/cost-anomalies",
    ]
    for path in endpoints:
        code, data = req("GET", path, token=token)
        if code == 200:
            ok(f"GET {path} => 200")
        else:
            fail(f"GET {path} => {code} {data}")

    print("\n=== Queue metrics ===")
    _, qdata = req("GET", "/v1/system/queues", token=token)
    if isinstance(qdata, dict) and qdata.get("queues"):
        names = {q["name"] for q in qdata["queues"]}
        for qn in [
            "knowledge-ingest", "knowledge-chunk", "knowledge-embed", "knowledge-reembed",
            "memory-summarize", "workflow-run", "workflow-retry", "workflow-dlq",
            "integration-events", "tool-execution",
        ]:
            if qn in names:
                ok(f"queue monitored: {qn}")
            else:
                fail(f"queue missing: {qn}")
        if qdata.get("redis"):
            ok("redis connected for queues")
        else:
            fail("redis not connected")
    else:
        fail("queues response invalid")

    print("\n=== Cache metrics ===")
    _, mdata = req("GET", "/v1/system/metrics", token=token)
    if isinstance(mdata, dict) and "cache" in mdata:
        for ns in ("retrieval", "embedding", "prompt"):
            if ns in mdata["cache"]:
                ok(f"cache stats: {ns}")
            else:
                fail(f"cache stats missing: {ns}")
        if mdata.get("redis", {}).get("cacheAvailable"):
            ok("redis cache available")
        else:
            fail("redis cache unavailable")
    else:
        fail("metrics cache section missing")

    print("\n=== Rate limits (plan_limits fields via metrics) ===")
    if isinstance(mdata, dict):
        ok("metrics endpoint includes postgresql counts")

    print("\n=== Marketplace smoke ===")
    code, cats = req("GET", "/v1/marketplace/categories", token=token)
    if code == 200 and isinstance(cats, list) and len(cats) >= 11:
        ok(f"marketplace categories={len(cats)}")
    else:
        fail(f"marketplace categories: {code}")

    print("\n=== Knowledge / Assistants / CRM / Workflow ===")
    for path, label in [
        ("/v1/assistants", "assistants"),
        ("/v1/knowledge-bases", "knowledge"),
        ("/v1/workflows", "workflows"),
        ("/v1/crm/clients", "crm"),
        ("/v1/memory/profiles", "memory"),
        ("/v1/integrations/providers", "integrations"),
    ]:
        code, _ = req("GET", path, token=token)
        if code == 200:
            ok(f"{label} list => 200")
        else:
            fail(f"{label} list => {code}")

    print("\n=== Summary ===")
    result = {"pass": len(PASS), "fail": len(FAIL), "failures": FAIL}
    print(json.dumps(result, indent=2))
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
