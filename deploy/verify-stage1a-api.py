#!/usr/bin/env python3
import json, urllib.request, sys

BASE = "http://127.0.0.1:3075/api"

def post(path, data, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(data).encode(),
        headers=headers,
        method="POST",
    )
    return json.loads(urllib.request.urlopen(req).read())

def get(path, token):
    req = urllib.request.Request(
        BASE + path,
        headers={"Authorization": f"Bearer {token}"},
    )
    return json.loads(urllib.request.urlopen(req).read())

login = post("/auth/login", {"email": "admin@ai-gateway.local", "password": "admin123"})
token = login["accessToken"]
templates = get("/v1/assistants/templates", token)
assistants = get("/v1/assistants", token)
print(f"templates_count={len(templates)}")
print(f"assistants_count={len(assistants)}")
print("OK")
