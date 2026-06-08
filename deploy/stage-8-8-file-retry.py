#!/usr/bin/env python3
"""Retry PDF/DOCX upload with content meeting 500-char quality gate."""
import io
import json
import time
import urllib.error
import urllib.request
import uuid
import zipfile

BASE = "http://127.0.0.1:3075/api"
KB = "cmq4h6kyu0003vtr4qegsopgh"


def req(method, path, data=None, token=None, timeout=120):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def upload(token, fname, content, ctype):
    boundary = f"----Stage88{uuid.uuid4().hex}"
    body = b"".join([
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="knowledgeBaseId"\r\n\r\n{KB}\r\n'.encode(),
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="file"; filename="{fname}"\r\nContent-Type: {ctype}\r\n\r\n'.encode(),
        content,
        f"\r\n--{boundary}--\r\n".encode(),
    ])
    r = urllib.request.Request(
        BASE + "/v1/knowledge-documents/upload",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}", "Authorization": f"Bearer {token}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(r, timeout=180) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def wait_job_doc(token, job_id, timeout=240):
    deadline = time.time() + timeout
    doc_id = None
    while time.time() < deadline:
        _, job = req("GET", f"/v1/knowledge-jobs/{job_id}", token=token)
        doc_id = job.get("knowledgeDocumentId")
        if job.get("status") in ("SUCCESS", "FAILED", "SKIPPED"):
            return doc_id, job
        time.sleep(5)
    return doc_id, {}


def wait_doc(token, doc_id, timeout=180):
    deadline = time.time() + timeout
    while time.time() < deadline:
        _, doc = req("GET", f"/v1/knowledge-documents/{doc_id}", token=token)
        if doc.get("status") in ("READY", "INDEXED", "FAILED", "SKIPPED_QUALITY"):
            return doc
        if doc.get("embeddingStatus") == "INDEXED":
            return doc
        time.sleep(5)
    return doc


def make_docx(text):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr("word/document.xml", f'<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>')
        z.writestr("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
    return buf.getvalue()


def main():
    _, login = req("POST", "/auth/login", {"email": "admin@ai-gateway.local", "password": "admin123"})
    token = login["accessToken"]
    results = {}

    long_text = ("Stage 8.8 Knowledge Platform E2E validation document content. " * 15).strip()
    docx = make_docx(long_text)
    code, resp = upload(token, "e2e-full.docx", docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    doc_id, job = wait_job_doc(token, resp.get("jobId", ""))
    doc = wait_doc(token, doc_id) if doc_id else {}
    results["docx"] = {"upload": code, "job": job, "doc": {"status": doc.get("status"), "emb": doc.get("embeddingStatus"), "chunks": doc.get("chunkCount")}}

    # Download sample PDF from server
    import subprocess
    subprocess.run(["curl", "-sfL", "-o", "/tmp/stage88-sample.pdf", "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"], check=False)
    try:
        pdf = open("/tmp/stage88-sample.pdf", "rb").read()
    except FileNotFoundError:
        pdf = b""
    if len(pdf) > 100:
        code, resp = upload(token, "e2e-sample.pdf", pdf, "application/pdf")
        doc_id, job = wait_job_doc(token, resp.get("jobId", ""))
        doc = wait_doc(token, doc_id) if doc_id else {}
        results["pdf"] = {"upload": code, "job": job, "doc": {"status": doc.get("status"), "emb": doc.get("embeddingStatus"), "chunks": doc.get("chunkCount")}}
    else:
        results["pdf"] = {"error": "could not download sample pdf"}

    # reembed test
    _, docs = req("GET", f"/v1/knowledge-documents?knowledgeBaseId={KB}", token=token)
    txt = next((d for d in docs if d.get("title") == "e2e.txt"), None)
    if txt:
        code, re = req("POST", f"/v1/knowledge-documents/{txt['id']}/reembed", token=token)
        time.sleep(25)
        _, doc = req("GET", f"/v1/knowledge-documents/{txt['id']}", token=token)
        results["reembed"] = {"code": code, "status": doc.get("embeddingStatus"), "chunks": doc.get("chunkCount")}

    print(json.dumps(results, indent=2, default=str))


if __name__ == "__main__":
    main()
