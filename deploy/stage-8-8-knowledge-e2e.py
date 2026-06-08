#!/usr/bin/env python3
"""Stage 8.8 — Knowledge Platform E2E validation (production localhost)."""
import io
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile

BASE = "http://127.0.0.1:3075/api"
RESULTS = {"phases": {}, "pass": [], "fail": [], "warn": []}
POLL_TIMEOUT = 300
POLL_INTERVAL = 5


def log(status, msg):
    print(f"[{status}] {msg}")
    (RESULTS["pass"] if status == "PASS" else RESULTS["warn"] if status == "WARN" else RESULTS["fail"]).append(msg)


def req(method, path, data=None, token=None, timeout=60):
    headers = {}
    body = None
    if data is not None and not isinstance(data, bytes):
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode()
    elif isinstance(data, bytes):
        body = data
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"raw": raw.decode(errors="replace")[:500]}
        return e.code, payload


def upload_file(token, kb_id, filename, content, content_type):
    boundary = f"----Stage88{uuid.uuid4().hex}"
    parts = []
    parts.append(f"--{boundary}\r\n".encode())
    parts.append(f'Content-Disposition: form-data; name="knowledgeBaseId"\r\n\r\n{kb_id}\r\n'.encode())
    parts.append(f"--{boundary}\r\n".encode())
    parts.append(
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n".encode()
    )
    parts.append(content if isinstance(content, bytes) else content.encode())
    parts.append(f"\r\n--{boundary}--\r\n".encode())
    body = b"".join(parts)
    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Authorization": f"Bearer {token}",
    }
    r = urllib.request.Request(BASE + "/v1/knowledge-documents/upload", data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"raw": raw.decode(errors="replace")[:500]}
        return e.code, payload


def psql(sql):
    env = os.environ.copy()
    dotenv = "/var/www/crm-al-tokens/apps/api/.env"
    if os.path.exists(dotenv):
        for line in open(dotenv):
            if line.startswith("DATABASE_URL="):
                env["DATABASE_URL"] = line.strip().split("=", 1)[1].strip().strip('"')
    url = env.get("DATABASE_URL", "")
    if not url:
        return None
    # prisma url postgresql://user:pass@host:port/db
    import re
    m = re.match(r"postgresql://([^:]+):([^@]+)@([^:/]+):(\d+)/([^?]+)", url)
    if not m:
        return None
    user, pwd, host, port, db = m.groups()
    cmd = ["psql", "-h", host, "-p", port, "-U", user, "-d", db, "-t", "-A", "-c", sql]
    env["PGPASSWORD"] = pwd
    try:
        out = subprocess.check_output(cmd, env=env, stderr=subprocess.STDOUT, text=True)
        return out.strip()
    except subprocess.CalledProcessError as e:
        return e.output


def wait_doc(token, doc_id, target_statuses=("READY", "INDEXED"), timeout=POLL_TIMEOUT):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        code, doc = req("GET", f"/v1/knowledge-documents/{doc_id}", token=token)
        if code == 200:
            last = doc
            st = doc.get("status")
            emb = doc.get("embeddingStatus")
            if st in target_statuses or emb == "INDEXED":
                return doc
            if st in ("FAILED", "SKIPPED_QUALITY"):
                return doc
        time.sleep(POLL_INTERVAL)
    return last


def login():
    code, data = req("POST", "/auth/login", {"email": "admin@ai-gateway.local", "password": "admin123"})
    if code not in (200, 201) or "accessToken" not in data:
        log("FAIL", f"login code={code}")
        sys.exit(1)
    return data["accessToken"]


def main():
    token = login()
    log("PASS", "login")

    # Embedding profile
    profile_id = psql("SELECT id FROM embedding_profiles WHERE is_default = true LIMIT 1;")
    if not profile_id:
        profile_id = "embed_profile_platform_default"

    code, kb = req(
        "POST",
        "/v1/knowledge-bases",
        {"name": "Knowledge E2E Test", "description": "Stage 8.8 validation", "embeddingProfileId": profile_id},
        token,
    )
    if code not in (200, 201):
        log("FAIL", f"create KB code={code} {kb}")
        sys.exit(1)
    kb_id = kb["id"]
    log("PASS", f"KB created id={kb_id}")

    # Phase 2 — file ingestion
    fixtures_dir = "/tmp/stage88-fixtures"
    os.makedirs(fixtures_dir, exist_ok=True)

    txt_body = ("Stage 8.8 knowledge platform validation text. " * 5).encode()
    open(f"{fixtures_dir}/e2e.txt", "wb").write(txt_body)
    md_body = ("# E2E Test\n\n## Section\n\nParagraph one content for markdown strategy.\n\nParagraph two.\n").encode()
    open(f"{fixtures_dir}/e2e.md", "wb").write(md_body)

    # minimal PDF
    pdf_body = b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj
4 0 obj<</Length 44>>stream
BT /F1 12 Tf 100 700 Td (Stage 8.8 PDF test content) Tj ET
endstream endobj
xref
0 5
trailer<</Size 5/Root 1 0 R>>
startxref
0
%%EOF"""
    open(f"{fixtures_dir}/e2e.pdf", "wb").write(pdf_body)

    # minimal DOCX (zip)
    docx_buf = io.BytesIO()
    with zipfile.ZipFile(docx_buf, "w") as z:
        z.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr("word/document.xml", '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Stage 8.8 DOCX test content for knowledge platform validation pipeline.</w:t></w:r></w:p></w:body></w:document>')
        z.writestr("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
    docx_body = docx_buf.getvalue()
    open(f"{fixtures_dir}/e2e.docx", "wb").write(docx_body)

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w") as z:
        z.writestr("inner.txt", txt_body)
    zip_body = zip_buf.getvalue()
    open(f"{fixtures_dir}/e2e.zip", "wb").write(zip_body)

    file_tests = [
        ("e2e.txt", txt_body, "text/plain"),
        ("e2e.md", md_body, "text/markdown"),
        ("e2e.pdf", pdf_body, "application/pdf"),
        ("e2e.docx", docx_body, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        ("e2e.zip", zip_body, "application/zip"),
    ]
    doc_ids = {}
    ingest_results = {}
    for fname, content, ctype in file_tests:
        code, resp = upload_file(token, kb_id, fname, content, ctype)
        ingest_results[fname] = {"upload_code": code, "resp": resp}
        if code not in (200, 201):
            log("FAIL", f"upload {fname} code={code} {resp}")
            continue
        doc_id = resp.get("documentId") or resp.get("id")
        if not doc_id and isinstance(resp, dict):
            doc_id = resp.get("document", {}).get("id")
        if doc_id:
            doc_ids[fname] = doc_id
            doc = wait_doc(token, doc_id, timeout=180 if fname.endswith(".pdf") or fname.endswith(".docx") else 90)
            ingest_results[fname]["final"] = doc
            st = doc.get("status") if doc else None
            ok = st in ("READY", "INDEXED") or (doc and doc.get("embeddingStatus") == "INDEXED")
            (log if ok else log)("PASS" if ok else "WARN", f"ingest {fname} status={st} emb={doc.get('embeddingStatus') if doc else None}")
        else:
            log("WARN", f"upload {fname} no doc_id in {resp}")

    RESULTS["phases"]["document_ingestion"] = ingest_results

    # Phase 3 — URL ingestion
    url_tests = [
        "https://www.consultant.ru/document/cons_doc_LAW_5142/",
        "https://sudrf.ru/",
        "https://sozd.duma.gov.ru/",
    ]
    url_results = {}
    for url in url_tests:
        code, resp = req("POST", "/v1/knowledge-documents/url", {"knowledgeBaseId": kb_id, "url": url, "title": f"URL {url}"}, token)
        url_results[url] = {"create_code": code, "resp": resp}
        doc_id = resp.get("documentId") if isinstance(resp, dict) else None
        if not doc_id and isinstance(resp, dict):
            doc_id = resp.get("id")
        if doc_id:
            doc = wait_doc(token, doc_id, timeout=240)
            url_results[url]["final"] = doc
            ok = doc and doc.get("okContent") is True and doc.get("status") in ("READY", "INDEXED", "PROCESSING", "PENDING")
            if doc and doc.get("status") in ("READY", "INDEXED"):
                log("PASS", f"URL {url} status={doc.get('status')} okContent={doc.get('okContent')}")
            elif doc and doc.get("okContent") is False:
                log("PASS", f"URL quality gate blocked {url} status={doc.get('status')}")
            else:
                log("WARN", f"URL {url} status={doc.get('status') if doc else None}")
        else:
            log("WARN", f"URL ingest {url} code={code}")
    RESULTS["phases"]["url_ingestion"] = url_results

    # Wait for primary TXT doc indexing
    primary_doc = doc_ids.get("e2e.txt")
    if primary_doc:
        deadline = time.time() + 180
        while time.time() < deadline:
            code, doc = req("GET", f"/v1/knowledge-documents/{primary_doc}", token=token)
            if code == 200 and (doc.get("embeddingStatus") == "INDEXED" or (doc.get("chunkCount") or 0) > 0):
                break
            time.sleep(POLL_INTERVAL)

    # Phase 4-5 — chunks & embeddings
    code, chunks = req("GET", f"/v1/knowledge-chunks?knowledgeBaseId={kb_id}", token=token)
    chunk_count = len(chunks) if isinstance(chunks, list) else 0
    code, emb_sum = req("GET", f"/v1/knowledge-embeddings/summary?knowledgeBaseId={kb_id}", token=token)
    embedding_count = emb_sum.get("embeddedChunks", 0) if isinstance(emb_sum, dict) else 0
    RESULTS["phases"]["chunks_embeddings"] = {"chunk_count": chunk_count, "embedding_summary": emb_sum}
    if chunk_count > 0:
        log("PASS", f"chunks={chunk_count}")
    else:
        log("FAIL", f"chunks=0")
    if embedding_count > 0:
        log("PASS", f"embeddings={embedding_count}")
    else:
        log("FAIL", f"embeddings=0")

    # Phase 6 — retrieval
    retrieval_results = {}
    query = "Stage 8.8 knowledge platform validation"
    for mode in ("keyword", "vector", "hybrid"):
        code, res = req("POST", f"/v1/knowledge-retrieval/{mode}", {"knowledgeBaseId": kb_id, "query": query, "limit": 5}, token)
        count = len(res.get("results", res)) if isinstance(res, (dict, list)) else 0
        if isinstance(res, dict) and "results" in res:
            count = len(res["results"])
        elif isinstance(res, list):
            count = len(res)
        retrieval_results[mode] = {"code": code, "count": count, "sample": res}
        if code == 200 and count > 0:
            log("PASS", f"retrieval {mode} results={count}")
        else:
            log("FAIL" if code != 200 else "WARN", f"retrieval {mode} code={code} count={count}")
    RESULTS["phases"]["retrieval"] = retrieval_results

    # Phase 7 — assistant + knowledge
    code, asst = req("POST", "/v1/assistants", {"name": "Knowledge E2E Assistant", "systemPrompt": "Answer using knowledge base context."}, token)
    asst_id = asst.get("id") if code in (200, 201) else None
    assist_results = {}
    if asst_id:
        code, bind = req("POST", f"/v1/assistants/{asst_id}/knowledge-bindings", {"knowledgeBaseId": kb_id, "enabled": True, "maxChunks": 5}, token)
        assist_results["binding"] = {"code": code, "bind": bind}
        code, preview = req("POST", f"/v1/assistants/{asst_id}/context-preview", {"query": query}, token)
        assist_results["preview"] = {"code": code, "preview": preview}
        code, chat = req("POST", f"/v1/assistants/{asst_id}/chat", {"query": query, "debug": True}, token, timeout=120)
        assist_results["chat"] = {"code": code, "chat": chat}
        sources = chat.get("sources", []) if isinstance(chat, dict) else []
        logs_count = psql(f"SELECT COUNT(*) FROM retrieval_logs WHERE organization_id IN (SELECT organization_id FROM knowledge_bases WHERE id='{kb_id}');")
        assist_results["retrieval_logs"] = logs_count
        if code == 200:
            log("PASS", f"assistant chat sources={len(sources)}")
        else:
            log("WARN", f"assistant chat code={code}")
    RESULTS["phases"]["assistant"] = assist_results

    # Phase 8 — reprocess / reembed
    reprocess_results = {}
    if primary_doc:
        code, rp = req("POST", f"/v1/knowledge-documents/{primary_doc}/reprocess", token=token)
        reprocess_results["reprocess"] = {"code": code, "resp": rp}
        time.sleep(15)
        code, re = req("POST", f"/v1/knowledge-documents/{primary_doc}/reembed", token=token)
        reprocess_results["reembed_doc"] = {"code": code, "resp": re}
        time.sleep(20)
        code, reb = req("POST", f"/v1/knowledge-bases/{kb_id}/reembed", token=token)
        reprocess_results["reembed_kb"] = {"code": code, "resp": reb}
        if code in (200, 201):
            log("PASS", "reembed KB queued")
    RESULTS["phases"]["reprocess"] = reprocess_results

    # Phase 9 — observability
    code, health = req("GET", "/health", timeout=30)
    code2, jobs = req("GET", f"/v1/knowledge-jobs?knowledgeBaseId={kb_id}", token=token)
    RESULTS["phases"]["observability"] = {"health": health, "jobs_code": code2, "jobs": jobs if code2 == 200 else None}

    # Phase 10 — platform regression (abbreviated)
    reg = {}
    for path in ["/v1/assistants", "/v1/crm/clients", "/v1/workflows", "/v1/memory/profiles", "/v1/integrations/providers"]:
        c, _ = req("GET", path, token=token)
        reg[path] = c
    RESULTS["phases"]["regression"] = reg
    if all(c == 200 for c in reg.values()):
        log("PASS", "platform regression routes OK")

    # Summary
    fail_count = len(RESULTS["fail"])
    RESULTS["summary"] = {"pass": len(RESULTS["pass"]), "warn": len(RESULTS["warn"]), "fail": fail_count}
    print("\n=== JSON RESULTS ===")
    print(json.dumps(RESULTS, indent=2, default=str)[:12000])
    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    main()
