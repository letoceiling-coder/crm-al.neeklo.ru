#!/usr/bin/env python3
import json, urllib.request, time

BASE = "http://127.0.0.1:3075/api"
body = json.dumps({"email": "admin@ai-gateway.local", "password": "admin123"}).encode()
req = urllib.request.Request(BASE + "/auth/login", body, {"Content-Type": "application/json"}, method="POST")
token = json.loads(urllib.request.urlopen(req).read())["accessToken"]
h = {"Content-Type": "application/json", "Authorization": "Bearer " + token}

def post(path, data):
    r = urllib.request.Request(BASE + path, json.dumps(data).encode(), h, method="POST")
    return json.loads(urllib.request.urlopen(r).read())

def get(path):
    r = urllib.request.Request(BASE + path, headers={"Authorization": "Bearer " + token})
    return json.loads(urllib.request.urlopen(r).read())

def patch(path, data):
    r = urllib.request.Request(BASE + path, json.dumps(data).encode(), h, method="PATCH")
    return json.loads(urllib.request.urlopen(r).read())

wf = post("/v1/workflows", {"name": "WF run probe active", "triggerType": "MANUAL"})
patch("/v1/workflows/" + wf["id"], {"isActive": True})
print("create", wf.get("id"), "currentVersionId", wf.get("currentVersionId"))
time.sleep(3)
wf2 = get("/v1/workflows/" + wf["id"])
print("get currentVersionId", wf2.get("currentVersionId"), "hasVersion", bool(wf2.get("currentVersion")))
try:
    run = post("/v1/workflows/" + wf["id"] + "/run", {"triggerData": {}})
    print("run OK", run.get("id"))
except urllib.error.HTTPError as e:
    print("run FAIL", e.code, e.read().decode()[:200])
