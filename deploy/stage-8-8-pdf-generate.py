#!/usr/bin/env python3
import json, time, urllib.error, urllib.request, uuid
from fpdf import FPDF

BASE = "http://127.0.0.1:3075/api"
KB = "cmq4h6kyu0003vtr4qegsopgh"


def req(method, path, data=None, token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(BASE + path, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            return json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}")


pdf = FPDF()
pdf.add_page()
pdf.set_font("Helvetica", size=12)
pdf.multi_cell(0, 8, "Stage 8.8 Knowledge Platform PDF validation. " * 20)
data = bytes(pdf.output())

_, login = req("POST", "/auth/login", {"email": "admin@ai-gateway.local", "password": "admin123"})
token = login["accessToken"]
boundary = f"----g{uuid.uuid4().hex}"
body = b"".join([
    f"--{boundary}\r\n".encode(),
    f'Content-Disposition: form-data; name="knowledgeBaseId"\r\n\r\n{KB}\r\n'.encode(),
    f"--{boundary}\r\n".encode(),
    b'Content-Disposition: form-data; name="file"; filename="generated.pdf"\r\nContent-Type: application/pdf\r\n\r\n',
    data,
    f"\r\n--{boundary}--\r\n".encode(),
])
r = urllib.request.Request(
    BASE + "/v1/knowledge-documents/upload",
    data=body,
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}", "Authorization": f"Bearer {token}"},
    method="POST",
)
up = json.loads(urllib.request.urlopen(r, timeout=180).read())
job_id = up["jobId"]
job = {}
for _ in range(80):
    job = req("GET", f"/v1/knowledge-jobs/{job_id}", token=token)
    if job.get("status") in ("SUCCESS", "FAILED", "SKIPPED"):
        break
    time.sleep(3)
doc_id = job.get("knowledgeDocumentId")
doc = {}
for _ in range(80):
    doc = req("GET", f"/v1/knowledge-documents/{doc_id}", token=token)
    if doc.get("status") in ("READY", "INDEXED", "SKIPPED_QUALITY", "FAILED") or doc.get("embeddingStatus") == "INDEXED":
        break
    time.sleep(3)
print(json.dumps({
    "pdf_bytes": len(data),
    "job": job.get("status"),
    "status": doc.get("status"),
    "emb": doc.get("embeddingStatus"),
    "chunks": doc.get("chunkCount"),
    "chars": doc.get("parserChars"),
}, indent=2))
