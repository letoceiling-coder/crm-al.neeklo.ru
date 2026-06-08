#!/usr/bin/env python3
import json, time, urllib.error, urllib.request, uuid
BASE = "http://127.0.0.1:3075/api"
KB = "cmq4h6kyu0003vtr4qegsopgh"
URLS = [
    "https://filesamples.com/samples/document/pdf/sample1.pdf",
    "https://file-examples.com/storage/fe68c0e7c6368f6c95053/2017/10/file-sample_150kB.pdf",
]

def req(method, path, data=None, token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(BASE + path, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")

def upload(token, fname, content):
    boundary = f"----pdf{uuid.uuid4().hex}"
    body = b"".join([
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="knowledgeBaseId"\r\n\r\n{KB}\r\n'.encode(),
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="file"; filename="{fname}"\r\nContent-Type: application/pdf\r\n\r\n'.encode(),
        content,
        f"\r\n--{boundary}--\r\n".encode(),
    ])
    r = urllib.request.Request(BASE + "/v1/knowledge-documents/upload", data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}", "Authorization": f"Bearer {token}"}, method="POST")
    try:
        with urllib.request.urlopen(r, timeout=180) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")

_, login = req("POST", "/auth/login", {"email": "admin@ai-gateway.local", "password": "admin123"})
token = login["accessToken"]
pdf = None
for url in URLS:
    try:
        with urllib.request.urlopen(url, timeout=60) as resp:
            pdf = resp.read()
            if len(pdf) > 1000:
                print("downloaded", url, len(pdf))
                break
    except Exception as e:
        print("fail", url, e)
if not pdf:
    raise SystemExit("no pdf")

code, up = upload(token, "sample-real.pdf", pdf)
job_id = up.get("jobId")
job = {}
for _ in range(80):
    _, job = req("GET", f"/v1/knowledge-jobs/{job_id}", token=token)
    if job.get("status") in ("SUCCESS", "FAILED", "SKIPPED"):
        break
    time.sleep(3)
doc_id = job.get("knowledgeDocumentId")
doc = {}
for _ in range(80):
    _, doc = req("GET", f"/v1/knowledge-documents/{doc_id}", token=token)
    if doc.get("status") in ("READY", "INDEXED", "SKIPPED_QUALITY", "FAILED") or doc.get("embeddingStatus") == "INDEXED":
        break
    time.sleep(3)
print(json.dumps({"upload": code, "job_status": job.get("status"), "doc": {"status": doc.get("status"), "emb": doc.get("embeddingStatus"), "chunks": doc.get("chunkCount"), "chars": doc.get("parserChars")}}, indent=2))
