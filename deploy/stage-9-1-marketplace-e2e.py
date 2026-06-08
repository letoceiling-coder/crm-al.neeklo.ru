#!/usr/bin/env python3
"""Stage 9.1 — Marketplace production E2E validation."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from typing import Any

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3075/api"
PUBLIC_BASE = sys.argv[2] if len(sys.argv) > 2 else "https://crm-al.neeklo.ru/api"

USERS = {
    "org_a": ("admin@ai-gateway.local", "admin123"),
    "org_b": ("dev@ai-gateway.local", "dev123"),
}


def req(
    method: str,
    path: str,
    token: str | None = None,
    body: dict | None = None,
    base: str = BASE,
    expect: int | None = None,
) -> tuple[int, Any]:
    url = base.rstrip("/") + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            code = resp.getcode()
            raw = resp.read().decode()
            parsed = json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        code = e.code
        raw = e.read().decode()
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = raw
    if expect is not None and code != expect:
        raise AssertionError(f"{method} {path} => {code}, expected {expect}: {parsed}")
    return code, parsed


def login(email: str, password: str) -> str:
    code, data = req("POST", "/auth/login", body={"email": email, "password": password})
    if code not in (200, 201) or not data or "accessToken" not in data:
        raise AssertionError(f"Login failed for {email}: {code} {data}")
    return data["accessToken"]


def main() -> None:
    results: list[str] = []
    failures: list[str] = []

    def ok(msg: str) -> None:
        results.append(f"PASS: {msg}")
        print(f"✅ {msg}")

    def fail(msg: str) -> None:
        failures.append(msg)
        results.append(f"FAIL: {msg}")
        print(f"❌ {msg}")

    print("=== Phase 4 — API unauthenticated (expect 401, not 404) ===")
    for path in [
        "/v1/marketplace/packages",
        "/v1/marketplace/categories",
        "/v1/marketplace/featured",
        "/v1/marketplace/installed",
    ]:
        code, _ = req("GET", path, base=PUBLIC_BASE)
        if code == 401:
            ok(f"{path} => 401")
        elif code == 404:
            fail(f"{path} => 404 (route missing)")
        else:
            fail(f"{path} => {code} (expected 401)")

    print("\n=== Login Org A / Org B ===")
    try:
        token_a = login(*USERS["org_a"])
        ok("Org A login")
    except AssertionError as e:
        fail(str(e))
        token_a = None
    try:
        token_b = login(*USERS["org_b"])
        ok("Org B login")
    except AssertionError as e:
        fail(str(e))
        token_b = None

    if not token_a or not token_b:
        print(json.dumps({"results": results, "failures": failures}, indent=2))
        sys.exit(1)

    print("\n=== Phase 3/4 — Categories & Featured ===")
    code, cats = req("GET", "/v1/marketplace/categories", token=token_a)
    if code == 200 and isinstance(cats, list) and len(cats) >= 11:
        ok(f"Categories count={len(cats)}")
    else:
        fail(f"Categories: code={code} count={len(cats) if isinstance(cats, list) else cats}")

    code, featured = req("GET", "/v1/marketplace/featured", token=token_a)
    if code == 200 and isinstance(featured, dict) and all(
        k in featured for k in ("featured", "popular", "newest", "topRated", "mostInstalled")
    ):
        ok("Featured sections present")
    else:
        fail(f"Featured: {code} {type(featured)}")

    print("\n=== Phase 6 — E2E Publish (Org A) ===")
    manifest = {
        "type": "ASSISTANT",
        "assistant": {
            "name": "Stage 9.1 E2E Sales Assistant",
            "systemPrompt": "You are a sales assistant for Stage 9.1 production validation.",
            "settings": {"temperature": 0.7},
            "variables": [{"key": "company", "value": "Neeklo"}],
        },
    }
    slug_suffix = "stage-91-e2e"
    code, pkg = req(
        "POST",
        "/v1/marketplace/packages",
        token=token_a,
        body={
            "name": "Stage 9.1 E2E Assistant Package",
            "slug": slug_suffix,
            "description": "Production marketplace E2E validation package",
            "type": "ASSISTANT",
            "visibility": "PUBLIC",
            "manifest": manifest,
            "version": "1.0.0",
            "changelog": "Initial production E2E",
        },
    )
    package_id = None
    if code in (200, 201) and isinstance(pkg, dict) and pkg.get("id"):
        package_id = pkg["id"]
        ok(f"Created package {package_id}")
    else:
        fail(f"Create package: {code} {pkg}")

    if package_id:
        code, pub = req(
            "POST",
            f"/v1/marketplace/packages/{package_id}/publish",
            token=token_a,
            body={"version": "1.0.0", "changelog": "Production E2E", "manifest": manifest},
        )
        if code in (200, 201):
            ok("Published v1.0.0")
        else:
            fail(f"Publish: {code} {pub}")

        code, analytics = req(
            "GET", f"/v1/marketplace/packages/{package_id}/analytics", token=token_a
        )
        if code == 200 and isinstance(analytics, dict):
            ok(f"Analytics downloads={analytics.get('downloads')}")
        else:
            fail(f"Analytics: {code}")

    print("\n=== Phase 7 — E2E Install (Org B) ===")
    cloned_entities = None
    if package_id:
        code, install_res = req(
            "POST",
            "/v1/marketplace/install",
            token=token_b,
            body={"packageId": package_id, "version": "1.0.0"},
        )
        if code in (200, 201) and isinstance(install_res, dict):
            cloned_entities = install_res.get("clonedEntities") or install_res.get("install", {}).get(
                "clonedEntities"
            )
            ok(f"Install OK clonedEntities={cloned_entities}")
        else:
            fail(f"Install: {code} {install_res}")

        if cloned_entities and cloned_entities.get("assistantId"):
            aid = cloned_entities["assistantId"]
            code, agent = req("GET", f"/v1/assistants/{aid}", token=token_b)
            if code == 200 and isinstance(agent, dict):
                if agent.get("templateId") is None:
                    ok("Clone assistant templateId=null")
                else:
                    fail(f"templateId not null: {agent.get('templateId')}")
                if agent.get("organizationId"):
                    ok(f"Assistant org-scoped id={aid}")
            else:
                fail(f"Get cloned assistant: {code}")

        code, installed = req("GET", "/v1/marketplace/installed", token=token_b)
        if code == 200 and isinstance(installed, list) and any(
            i.get("package", {}).get("id") == package_id for i in installed
        ):
            ok("Install log present")
        else:
            fail(f"Installed list: {code}")

    print("\n=== Phase 8 — Review (Org B) ===")
    if package_id:
        code, review = req(
            "POST",
            "/v1/marketplace/reviews",
            token=token_b,
            body={"packageId": package_id, "rating": 5, "comment": "Stage 9.1 E2E review"},
        )
        if code in (200, 201):
            ok("Review created")
        else:
            fail(f"Review: {code} {review}")

        code, detail = req("GET", f"/v1/marketplace/packages/{package_id}", token=token_b)
        if code == 200 and isinstance(detail, dict) and detail.get("ratingCount", 0) >= 1:
            ok(f"Rating aggregate rating={detail.get('rating')} count={detail.get('ratingCount')}")
        else:
            fail(f"Rating aggregate: {code}")

    print("\n=== Phase 10 — Security (PRIVATE package) ===")
    if package_id:
        code, _ = req(
            "PATCH",
            f"/v1/marketplace/packages/{package_id}",
            token=token_a,
            body={"visibility": "PRIVATE"},
        )
        if code == 200:
            ok("Set PRIVATE visibility")
        code, _ = req("GET", f"/v1/marketplace/packages/{package_id}", token=token_b, expect=403)
        if code == 403:
            ok("Org B forbidden on PRIVATE package")
        else:
            fail(f"PRIVATE access should be 403, got {code}")
        req(
            "PATCH",
            f"/v1/marketplace/packages/{package_id}",
            token=token_a,
            body={"visibility": "PUBLIC"},
        )

    print("\n=== Summary ===")
    print(json.dumps({"pass": len([r for r in results if r.startswith("PASS")]), "fail": len(failures), "failures": failures}, indent=2))
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
