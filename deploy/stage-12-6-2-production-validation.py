#!/usr/bin/env python3
"""Stage 12.6.2 — Post-deploy validation."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://crm-al.neeklo.ru/api"
PUBLIC = BASE.replace("/api", "")
PASS, FAIL = [], []


def ok(m):
    PASS.append(m)
    print("PASS:", m)


def fail(m):
    FAIL.append(m)
    print("FAIL:", m)


def req(method, path, token=None, body=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"raw": raw}


def main():
    code, auth = req("POST", "/auth/login", body={"email": "admin@ai-gateway.local", "password": "admin123"})
    if code not in (200, 201):
        fail(f"login {code}")
        sys.exit(1)
    token = auth["accessToken"]
    ok("admin login")

    code, kbs = req("GET", "/v1/knowledge-bases", token=token)
    kb_id = kbs[0]["id"] if code == 200 and isinstance(kbs, list) and kbs else None
    if not kb_id:
        fail("no knowledge base")
    else:
        ok(f"kb id={kb_id[:12]}...")
        for ep in [
            f"/v1/knowledge-categories?knowledgeBaseId={kb_id}",
            f"/v1/knowledge-topics?knowledgeBaseId={kb_id}",
            f"/v1/knowledge-tags?knowledgeBaseId={kb_id}",
        ]:
            c, body = req("GET", ep, token=token)
            if c == 200 and isinstance(body, list):
                ok(f"GET {ep.split('?')[0]} -> 200 ({len(body)} rows)")
            else:
                fail(f"GET {ep} -> {c} {body}")

    code, payments = req("GET", "/v1/system/settings/payments", token=token)
    if code == 200 and isinstance(payments, list):
        providers = [p.get("provider") for p in payments]
        if providers == ["YOOKASSA"]:
            ok("payments API YooKassa-only")
        else:
            fail(f"payments providers={providers}")
    else:
        fail(f"payments settings {code}")

    code, _ = req("GET", "/v1/system/launch", token=token)
    ok(f"launch center {code}") if code == 200 else fail(f"launch {code}")

    # Web bundle markers
    try:
        html = urllib.request.urlopen(PUBLIC + "/", timeout=20).read().decode()
        import re

        m = re.search(r"/assets/(index-[^\"']+\.js)", html)
        if m:
            js = urllib.request.urlopen(PUBLIC + "/assets/" + m.group(1), timeout=30).read().decode("utf-8", errors="ignore")
            for marker in ("Create Test Payment", "system/settings/payments", "Test Connection"):
                if marker in js:
                    ok(f"bundle contains {marker!r}")
                else:
                    fail(f"bundle missing {marker!r}")
        else:
            fail("no index js in html")
    except Exception as e:
        fail(f"web bundle check: {e}")

    print(json.dumps({"pass": len(PASS), "fail": len(FAIL), "verdict": "GO" if not FAIL else "NO-GO"}, indent=2))
    sys.exit(0 if not FAIL else 1)


if __name__ == "__main__":
    main()
