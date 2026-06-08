import json, urllib.request
BASE = "http://127.0.0.1:3075/api"
r = urllib.request.Request(BASE + "/auth/login", json.dumps({"email": "admin@ai-gateway.local", "password": "admin123"}).encode(), headers={"Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(r) as resp:
    raw = resp.read()
    print(type(raw), raw[:200])
    print(json.loads(raw))
