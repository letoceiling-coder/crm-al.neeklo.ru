#!/usr/bin/env python3
"""Stage 8.8 — retrieval + assistant validation on existing KB."""
import json
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:3075/api"
KB = sys.argv[1] if len(sys.argv) > 1 else "cmq4h6kyu0003vtr4qegsopgh"
OUT = {"retrieval": {}, "assistant": {}, "pass": [], "fail": []}


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


def count_results(res):
    if isinstance(res, list):
        return len(res)
    if isinstance(res, dict):
        return len(res.get("results") or res.get("chunks") or [])
    return 0


def top_score(res):
    items = res.get("results") if isinstance(res, dict) else res
    if isinstance(items, list) and items and isinstance(items[0], dict):
        return items[0].get("score")
    return None


def main():
    _, login = req("POST", "/auth/login", {"email": "admin@ai-gateway.local", "password": "admin123"})
    token = login["accessToken"]

    queries = [
        "consultant document law",
        "Stage 8.8 knowledge",
        "sudrf court portal",
    ]
    for mode in ("keyword", "vector", "hybrid"):
        mode_res = {}
        for q in queries:
            code, res = req("POST", f"/v1/knowledge-retrieval/{mode}", {"knowledgeBaseId": KB, "query": q, "limit": 5}, token)
            mode_res[q] = {"code": code, "count": count_results(res), "top_score": top_score(res)}
        OUT["retrieval"][mode] = mode_res
        total = sum(v["count"] for v in mode_res.values())
        (OUT["pass"] if total > 0 else OUT["fail"]).append(f"retrieval_{mode}")

    _, asst = req("POST", "/v1/assistants", {"name": "KB E2E Assistant 8.8", "systemPrompt": "Use knowledge base. Cite sources."}, token)
    asst_id = asst.get("id")
    bind_code, bind = req("POST", f"/v1/assistants/{asst_id}/knowledge-bindings", {"knowledgeBaseId": KB, "enabled": True, "maxChunks": 8}, token)
    preview_code, preview = req("POST", f"/v1/assistants/{asst_id}/context-preview", {"query": "consultant law document"}, token)
    chat_code, chat = req("POST", f"/v1/assistants/{asst_id}/chat", {"query": "What content is in the consultant.ru document?", "debug": True}, token, timeout=180)
    sources = chat.get("sources", []) if isinstance(chat, dict) else []
    OUT["assistant"] = {
        "binding_code": bind_code,
        "preview_code": preview_code,
        "preview_chunks": count_results(preview),
        "chat_code": chat_code,
        "sources_count": len(sources),
        "has_answer": bool(chat.get("answer") or chat.get("content") or chat.get("message")),
        "preview": preview,
        "chat_keys": list(chat.keys()) if isinstance(chat, dict) else [],
    }

    if OUT["assistant"]["sources_count"] > 0 or OUT["assistant"]["preview_chunks"] > 0:
        OUT["pass"].append("assistant_kb")
    else:
        OUT["fail"].append("assistant_kb")

    print(json.dumps(OUT, indent=2, default=str))
    sys.exit(0 if not OUT["fail"] else 1)


if __name__ == "__main__":
    main()
