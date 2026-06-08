#!/usr/bin/env python3
"""Stage 11.1 — Full commercial smoke test (production)."""
from __future__ import annotations

import json
import sys
import time
import uuid
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3075/api"
PASS: list[str] = []
FAIL: list[str] = []
WARN: list[str] = []


def ok(msg: str) -> None:
    PASS.append(msg)
    print(f"PASS: {msg}")


def fail(msg: str) -> None:
    FAIL.append(msg)
    print(f"FAIL: {msg}")


def warn(msg: str) -> None:
    WARN.append(msg)
    print(f"WARN: {msg}")


def success_code(code: int) -> bool:
    return code in (200, 201)


def req(method: str, path: str, token: str | None = None, body: dict | None = None, timeout: int = 60):
    url = BASE.rstrip("/") + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = raw
        return e.code, parsed


def upload_txt(token: str, kb_id: str, content: str) -> tuple[int, dict | None]:
    boundary = f"----Stage111{uuid.uuid4().hex}"
    body = b"".join([
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="knowledgeBaseId"\r\n\r\n{kb_id}\r\n'.encode(),
        f"--{boundary}\r\n".encode(),
        b'Content-Disposition: form-data; name="file"; filename="stage-11-1-smoke.txt"\r\n',
        b"Content-Type: text/plain\r\n\r\n",
        content.encode(),
        f"\r\n--{boundary}--\r\n".encode(),
    ])
    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Authorization": f"Bearer {token}",
    }
    r = urllib.request.Request(BASE + "/v1/knowledge-documents/upload", data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
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
    if not success_code(code) or not data or "accessToken" not in data:
        raise RuntimeError(f"login failed {email}: {code} {data}")
    return data["accessToken"]


def main() -> None:
    admin = login("admin@ai-gateway.local", "admin123")
    ok("login admin")

    tag = f"stage-111-{int(time.time())}"

    print("=== Organization invite ===")
    code, inv = req("POST", "/v1/organizations/current/members/invite", token=admin, body={
        "email": f"invite-{tag}@test.local", "role": "OPERATOR",
    })
    invite_token = inv.get("token") if success_code(code) and isinstance(inv, dict) else None
    ok(f"invitation created token={bool(invite_token)}") if invite_token else fail(f"invite {code} {inv}")

    print("=== Assistant ===")
    code, asst = req("POST", "/v1/assistants", token=admin, body={
        "name": f"Commercial Smoke {tag}",
        "systemPrompt": "Commercial smoke assistant.",
    })
    asst_id = asst.get("id") if success_code(code) and isinstance(asst, dict) else None
    ok(f"assistant id={asst_id}") if asst_id else fail(f"assistant {code} {asst}")

    print("=== Knowledge base + document ===")
    code, kb = req("POST", "/v1/knowledge-bases", token=admin, body={
        "name": f"Commercial Smoke KB {tag}",
    })
    kb_id = kb.get("id") if success_code(code) and isinstance(kb, dict) else None
    if not kb_id and code == 400:
        code, existing = req("GET", "/v1/knowledge-bases", token=admin)
        if code == 200 and isinstance(existing, list) and existing:
            kb_id = existing[0].get("id")
            warn(f"KB limit — reusing {kb_id}")
        else:
            fail(f"KB unavailable {existing}")
    elif kb_id:
        ok(f"KB id={kb_id}")
    else:
        fail(f"KB {code} {kb}")

    if asst_id and kb_id:
        code, _ = req("POST", f"/v1/assistants/{asst_id}/knowledge-bindings", token=admin, body={
            "knowledgeBaseId": kb_id, "enabled": True,
        })
        ok(f"KB binding {code}") if success_code(code) else warn(f"KB binding {code}")

    if kb_id:
        code, up = upload_txt(admin, kb_id, f"Commercial smoke document {tag}. " * 10)
        ok(f"document upload {code}") if success_code(code) else warn(f"document upload {code} {up}")

    print("=== Workflow ===")
    code, wf = req("POST", "/v1/workflows", token=admin, body={
        "name": f"Commercial Smoke WF {tag}",
        "triggerType": "MANUAL",
    })
    wf_id = wf.get("id") if success_code(code) and isinstance(wf, dict) else None
    if wf_id:
        ok(f"workflow id={wf_id}")
        req("PATCH", f"/v1/workflows/{wf_id}", token=admin, body={"isActive": True})
        code, run = req("POST", f"/v1/workflows/{wf_id}/run", token=admin, body={"triggerData": {"smoke": tag}})
        ok(f"workflow run {code}") if success_code(code) else warn(f"workflow run {code} {run}")
    else:
        fail(f"workflow {code} {wf}")

    print("=== CRM Lead ===")
    code, lead = req("POST", "/v1/crm/leads", token=admin, body={
        "name": f"Commercial Lead {tag}",
        "email": f"lead-{tag}@example.com",
    })
    ok(f"CRM lead {code}") if success_code(code) else fail(f"CRM lead {code} {lead}")

    print("=== Marketplace package publish ===")
    slug = f"commercial-smoke-{tag}"
    code, pkg = req("POST", "/v1/marketplace/packages", token=admin, body={
        "name": f"Commercial Smoke Package {tag}",
        "slug": slug,
        "type": "ASSISTANT",
        "visibility": "PRIVATE",
        "manifest": {"type": "ASSISTANT", "assistant": {"name": "Smoke", "systemPrompt": "Smoke"}},
        "billingType": "PAID",
        "price": 1500,
        "currency": "RUB",
    })
    ok(f"marketplace package {code}") if success_code(code) else fail(f"marketplace {code} {pkg}")

    print("=== Plan change + invoice ===")
    code, _ = req("POST", "/v1/billing/subscription/change", token=admin, body={"tier": "PRO"})
    ok(f"plan change PRO {code}") if success_code(code) else fail(f"plan change {code}")
    code, invoices = req("GET", "/v1/billing/invoices", token=admin)
    has_open = isinstance(invoices, list) and any(i.get("status") == "OPEN" for i in invoices)
    ok("OPEN invoice present") if has_open else fail(f"no OPEN invoice {invoices}")
    req("POST", "/v1/billing/subscription/change", token=admin, body={"tier": "FREE"})

    print("=== Usage export download ===")
    url = BASE.rstrip("/") + "/v1/exports/usage?format=csv"
    r = urllib.request.Request(url, headers={"Authorization": f"Bearer {admin}"})
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            data = resp.read()
            ok(f"usage export csv {len(data)} bytes") if len(data) > 10 else fail("usage export empty")
    except Exception as e:
        fail(f"usage export: {e}")

    print("\n=== Summary ===")
    summary = {"pass": len(PASS), "warn": len(WARN), "fail": len(FAIL), "failures": FAIL}
    print(json.dumps(summary, indent=2))
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
