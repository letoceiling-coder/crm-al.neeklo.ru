#!/usr/bin/env python3
import json, urllib.request, urllib.error, sys

BASE = "http://127.0.0.1:3075/api"
KB = sys.argv[1] if len(sys.argv) > 1 else "cmq4h6kyu0003vtr4qegsopgh"

def req(method, path, data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")

_, login = req("POST", "/auth/login", {"email": "admin@ai-gateway.local", "password": "admin123"})
token = login["accessToken"]
_, docs = req("GET", f"/v1/knowledge-documents?knowledgeBaseId={KB}", token=token)
print(f"documents={len(docs)}")
for d in docs:
    print(f"  {d.get('title')[:40]:40} status={d.get('status')} emb={d.get('embeddingStatus')} chunks={d.get('chunkCount')}")
_, chunks = req("GET", f"/v1/knowledge-chunks?knowledgeBaseId={KB}", token=token)
print(f"chunk_rows={len(chunks) if isinstance(chunks,list) else chunks}")
_, emb = req("GET", f"/v1/knowledge-embeddings/summary?knowledgeBaseId={KB}", token=token)
print("embedding_summary", json.dumps(emb))
_, jobs = req("GET", f"/v1/knowledge-jobs?knowledgeBaseId={KB}", token=token)
print(f"jobs={len(jobs) if isinstance(jobs,list) else jobs}")
for j in (jobs if isinstance(jobs, list) else [])[:15]:
    print(f"  job {j.get('type')} status={j.get('status')} err={j.get('error')}")
_, pa = req("GET", "/v1/provider-accounts", token=token)
print(f"provider_accounts={len(pa) if isinstance(pa,list) else pa}")
