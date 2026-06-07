#!/usr/bin/env python3
"""Stage 8.7 production smoke test — run on server localhost."""
import json
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:3075/api"


def req(method, path, data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"raw": raw.decode(errors="replace")}
        return e.code, payload


def main():
    ok = True

    code, login = req("POST", "/auth/login", {"email": "admin@ai-gateway.local", "password": "admin123"})
    if code != 200 or "accessToken" not in login:
        print(f"FAIL login code={code} {login}")
        sys.exit(1)
    token = login["accessToken"]
    print("PASS login")

    # Assistant
    code, asst = req(
        "POST",
        "/v1/assistants",
        {"name": "Smoke Assistant 8.7", "systemPrompt": "You are a test assistant."},
        token,
    )
    if code not in (200, 201):
        print(f"FAIL assistant code={code} {asst}")
        ok = False
    else:
        asst_id = asst.get("id") or asst.get("agent", {}).get("id")
        print(f"PASS assistant id={asst_id}")

    # Knowledge base
    code, kb = req("POST", "/v1/knowledge-bases", {"name": "Smoke KB 8.7", "description": "test"}, token)
    if code not in (200, 201):
        print(f"FAIL knowledge-base code={code} {kb}")
        ok = False
    else:
        kb_id = kb["id"]
        print(f"PASS knowledge-base id={kb_id}")

        code, doc = req(
            "POST",
            "/v1/knowledge-documents/manual",
            {
                "knowledgeBaseId": kb_id,
                "title": "Smoke Doc",
                "content": "Test paragraph for chunking and embeddings.",
            },
            token,
        )
        if code not in (200, 201):
            print(f"WARN document code={code} {doc}")
        else:
            print(f"PASS document id={doc.get('id')}")

    # Workflow
    code, wf = req(
        "POST",
        "/v1/workflows",
        {"name": "Smoke Workflow 8.7", "triggerType": "MANUAL"},
        token,
    )
    if code not in (200, 201):
        print(f"FAIL workflow code={code} {wf}")
        ok = False
    else:
        print(f"PASS workflow id={wf.get('id')}")

    # CRM lead
    code, lead = req(
        "POST",
        "/v1/crm/leads",
        {"name": "Smoke Lead 8.7", "email": "smoke@parity.test"},
        token,
    )
    if code not in (200, 201):
        print(f"FAIL crm lead code={code} {lead}")
        ok = False
    else:
        print(f"PASS crm lead id={lead.get('id')}")

    # Memory
    code, prof = req(
        "POST",
        "/v1/memory/profiles",
        {"entityType": "ORGANIZATION", "entityId": "smoke", "name": "Smoke Memory"},
        token,
    )
    if code not in (200, 201):
        code, prof = req(
            "POST",
            "/v1/memory/profiles/get-or-create",
            {"entityType": "ORGANIZATION", "entityId": "smoke", "name": "Smoke Memory"},
            token,
        )
    if code not in (200, 201):
        print(f"FAIL memory profile code={code} {prof}")
        ok = False
    else:
        pid = prof.get("id")
        code, entry = req(
            "POST",
            f"/v1/memory/profiles/{pid}/entries",
            {"content": "Smoke memory entry", "entryType": "NOTE"},
            token,
        )
        if code not in (200, 201):
            print(f"WARN memory entry code={code} {entry}")
        else:
            print(f"PASS memory entry id={entry.get('id')}")

    # Telegram integration account
    code, prov = req("GET", "/v1/integrations/providers/TELEGRAM", token=token)
    if code != 200:
        print(f"FAIL integration provider code={code}")
        ok = False
    else:
        code, acc = req(
            "POST",
            "/v1/integrations/accounts",
            {"provider": "TELEGRAM", "name": "Smoke Telegram", "secret": "smoke-token-placeholder"},
            token,
        )
        if code not in (200, 201):
            print(f"FAIL integration account code={code} {acc}")
            ok = False
        else:
            print(f"PASS integration account id={acc.get('id')}")

    if ok:
        print("SMOKE_OK")
        sys.exit(0)
    print("SMOKE_PARTIAL_FAIL")
    sys.exit(1)


if __name__ == "__main__":
    main()
