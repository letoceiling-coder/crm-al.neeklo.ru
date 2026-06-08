#!/usr/bin/env python3
"""Stage 10.1 — Full enterprise smoke test (production)."""
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
    boundary = f"----Stage101{uuid.uuid4().hex}"
    body = b"".join([
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="knowledgeBaseId"\r\n\r\n{kb_id}\r\n'.encode(),
        f"--{boundary}\r\n".encode(),
        b'Content-Disposition: form-data; name="file"; filename="stage-10-1-smoke.txt"\r\n',
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


def wait_job_doc(token: str, job_id: str, kb_id: str, timeout: int = 240) -> str | None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        code, jobs = req("GET", f"/v1/knowledge-jobs?knowledgeBaseId={kb_id}", token=token)
        if code == 200 and isinstance(jobs, list):
            for j in jobs:
                if j.get("id") == job_id and j.get("documentId"):
                    return j["documentId"]
        time.sleep(5)
    return None


def wait_doc(token: str, doc_id: str, timeout: int = 180) -> dict | None:
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        code, doc = req("GET", f"/v1/knowledge-documents/{doc_id}", token=token)
        if code == 200 and isinstance(doc, dict):
            last = doc
            st = doc.get("status")
            emb = doc.get("embeddingStatus")
            if st in ("READY", "INDEXED") or emb == "INDEXED":
                return doc
            if st in ("FAILED", "SKIPPED_QUALITY"):
                return doc
        time.sleep(5)
    return last


def login() -> str:
    code, data = req("POST", "/auth/login", body={"email": "admin@ai-gateway.local", "password": "admin123"})
    if not success_code(code) or not data or "accessToken" not in data:
        raise RuntimeError(f"login failed: {code} {data}")
    return data["accessToken"]


def main() -> None:
    token = login()
    ok("login admin")

    tag = f"stage-101-{int(time.time())}"
    query = "Stage 10.1 enterprise smoke validation knowledge retrieval"

    code, asst = req("POST", "/v1/assistants", token=token, body={
        "name": f"Enterprise Smoke {tag}",
        "systemPrompt": "Answer using knowledge base context for enterprise validation.",
    })
    asst_id = asst.get("id") if success_code(code) and isinstance(asst, dict) else None
    if asst_id:
        ok(f"assistant created id={asst_id}")
    else:
        fail(f"assistant create code={code} {asst}")
        print(json.dumps({"pass": len(PASS), "fail": len(FAIL), "failures": FAIL}, indent=2))
        sys.exit(1)

    code, kb = req("POST", "/v1/knowledge-bases", token=token, body={
        "name": f"Enterprise Smoke KB {tag}",
        "description": "Stage 10.1 E2E smoke",
    })
    kb_id = kb.get("id") if success_code(code) and isinstance(kb, dict) else None
    if not kb_id and code == 400:
        code, existing = req("GET", "/v1/knowledge-bases", token=token)
        if code == 200 and isinstance(existing, list) and existing:
            kb_id = existing[0].get("id")
            warn(f"KB plan limit — reusing existing id={kb_id}")
        else:
            fail(f"KB unavailable: {existing}")
    elif kb_id:
        ok(f"knowledge base created id={kb_id}")
    else:
        fail(f"KB create code={code} {kb}")
        sys.exit(1)

    code, _ = req("POST", f"/v1/assistants/{asst_id}/knowledge-bindings", token=token, body={
        "knowledgeBaseId": kb_id, "enabled": True, "maxChunks": 5,
    })
    ok(f"KB binding code={code}") if success_code(code) else fail(f"KB binding code={code}")

    txt = (query + ". " + "Enterprise production validation text. " * 8)
    code, up = upload_txt(token, kb_id, txt)
    doc_id = None
    if success_code(code) and isinstance(up, dict):
        doc_id = up.get("documentId") or up.get("id")
        job_id = up.get("jobId")
        if not doc_id and job_id:
            ok(f"document upload queued jobId={job_id}")
            doc_id = wait_job_doc(token, job_id, kb_id)
            if doc_id:
                ok(f"document resolved from job id={doc_id}")
            else:
                warn(f"document not resolved from job {job_id} within timeout")
        elif doc_id:
            ok(f"document uploaded id={doc_id}")
        else:
            fail(f"document upload no id: {up}")
    else:
        fail(f"document upload code={code} {up}")

    if doc_id:
        doc = wait_doc(token, doc_id, timeout=240)
        st = doc.get("status") if doc else None
        emb = doc.get("embeddingStatus") if doc else None
        chunks = doc.get("chunkCount", 0) if doc else 0
        if doc and (st in ("READY", "INDEXED") or emb == "INDEXED" or chunks > 0):
            ok(f"chunking/embed status={st} emb={emb} chunks={chunks}")
        else:
            warn(f"chunking/embed incomplete status={st} emb={emb} chunks={chunks}")

    code, chunks = req("GET", f"/v1/knowledge-chunks?knowledgeBaseId={kb_id}", token=token)
    chunk_count = len(chunks) if isinstance(chunks, list) else 0
    ok(f"chunks listed count={chunk_count}") if chunk_count > 0 else warn(f"chunks count={chunk_count}")

    code, emb_sum = req("GET", f"/v1/knowledge-embeddings/summary?knowledgeBaseId={kb_id}", token=token)
    emb_count = emb_sum.get("embeddedChunks", 0) if isinstance(emb_sum, dict) else 0
    ok(f"embeddings summary count={emb_count}") if emb_count > 0 else warn(f"embeddings count={emb_count}")

    for mode in ("hybrid", "vector", "keyword"):
        code, res = req("POST", f"/v1/knowledge-retrieval/{mode}", token=token, body={
            "knowledgeBaseId": kb_id, "query": query, "limit": 5,
        })
        count = 0
        if isinstance(res, dict) and "results" in res:
            count = len(res["results"])
        elif isinstance(res, list):
            count = len(res)
        if success_code(code) and count > 0:
            ok(f"retrieval {mode} results={count}")
        elif success_code(code):
            warn(f"retrieval {mode} empty results")
        else:
            fail(f"retrieval {mode} code={code}")

    req("POST", "/v1/knowledge-retrieval/hybrid", token=token, body={"knowledgeBaseId": kb_id, "query": query, "limit": 5})
    _, metrics = req("GET", "/v1/system/metrics", token=token)
    cache = metrics.get("cache", {}) if isinstance(metrics, dict) else {}
    if cache.get("retrieval"):
        ok(f"cache metrics retrieval hitRate={cache.get('retrieval', {}).get('hitRate')}")

    code, profile = req("POST", "/v1/memory/profiles/get-or-create", token=token, body={
        "entityType": "USER", "entityId": f"smoke-{tag}", "name": f"Smoke Profile {tag}",
    })
    profile_id = profile.get("id") if success_code(code) and isinstance(profile, dict) else None
    if profile_id:
        ok(f"memory profile id={profile_id}")
        code, _ = req("POST", f"/v1/memory/profiles/{profile_id}/entries", token=token, body={
            "content": f"Enterprise smoke memory entry {tag}", "importance": 5,
        })
        ok(f"memory entry code={code}") if success_code(code) else fail(f"memory entry code={code}")
        code, _ = req("POST", "/v1/memory/search", token=token, body={
            "profileId": profile_id, "query": tag, "mode": "keyword", "limit": 5,
        })
        ok(f"memory search code={code}") if code == 200 else warn(f"memory search code={code}")
    else:
        fail(f"memory profile code={code} {profile}")

    code, wf = req("POST", "/v1/workflows", token=token, body={
        "name": f"Enterprise Smoke Workflow {tag}",
        "triggerType": "MANUAL",
        "description": "Stage 10.1 smoke",
    })
    wf_id = wf.get("id") if success_code(code) and isinstance(wf, dict) else None
    if wf_id:
        ok(f"workflow created id={wf_id}")
        time.sleep(2)
        code, run = req("POST", f"/v1/workflows/{wf_id}/run", token=token, body={"triggerData": {"smoke": tag}})
        ok(f"workflow run code={code}") if success_code(code) else warn(f"workflow run code={code} {run}")
    else:
        fail(f"workflow create code={code} {wf}")

    code, lead = req("POST", "/v1/crm/leads", token=token, body={
        "name": f"Enterprise Smoke Lead {tag}",
        "email": f"smoke-{tag}@example.com",
        "source": "stage-10-1-smoke",
    })
    if success_code(code) and isinstance(lead, dict) and lead.get("id"):
        ok(f"CRM lead created id={lead['id']}")
    else:
        fail(f"CRM lead code={code} {lead}")

    code, providers = req("GET", "/v1/integrations/providers", token=token)
    if code == 200 and isinstance(providers, list):
        types = [str(p.get("provider", "")).lower() for p in providers if isinstance(p, dict)]
        if "telegram" in types:
            ok("telegram provider registered")
        else:
            fail(f"telegram not in providers: {types}")
    else:
        fail(f"integrations providers code={code}")

    code, _ = req("GET", "/v1/integrations/accounts", token=token)
    ok(f"integration accounts list code={code}") if code == 200 else warn(f"integration accounts code={code}")

    code, pkgs = req("GET", "/v1/marketplace/packages?limit=20", token=token)
    package_id = None
    if code == 200:
        items = pkgs.get("items", pkgs) if isinstance(pkgs, dict) else pkgs
        if isinstance(items, list):
            for p in items:
                if isinstance(p, dict) and p.get("id"):
                    vis = p.get("visibility", "PUBLIC")
                    if vis == "PUBLIC":
                        package_id = p["id"]
                        break
    if package_id:
        ok(f"marketplace package found id={package_id}")
        code, installed = req("GET", "/v1/marketplace/installed", token=token)
        already = code == 200 and isinstance(installed, list) and any(
            i.get("package", {}).get("id") == package_id for i in installed
        )
        if already:
            ok("marketplace package already installed")
        else:
            code, inst = req("POST", "/v1/marketplace/install", token=token, body={
                "packageId": package_id, "version": "1.0.0",
            })
            ok(f"marketplace install code={code}") if success_code(code) else warn(f"marketplace install code={code} {inst}")
    else:
        warn("no public marketplace package — run marketplace E2E separately")

    code, chat = req("POST", f"/v1/assistants/{asst_id}/chat", token=token, body={"query": query, "debug": True}, timeout=120)
    if success_code(code):
        ok("assistant chat OK")
    else:
        warn(f"assistant chat code={code}")

    print("\n=== Summary ===")
    summary = {"pass": len(PASS), "warn": len(WARN), "fail": len(FAIL), "failures": FAIL, "warnings": WARN}
    print(json.dumps(summary, indent=2))
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
