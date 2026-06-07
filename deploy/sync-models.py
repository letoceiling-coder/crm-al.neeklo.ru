#!/usr/bin/env python3
import json, urllib.request

login_data = json.dumps({"email": "dsc-23@yandex.ru", "password": "123123123"}).encode()
login_req = urllib.request.Request(
    "http://127.0.0.1:3075/api/auth/login",
    data=login_data,
    headers={"Content-Type": "application/json"},
    method="POST",
)
token = json.load(urllib.request.urlopen(login_req))["accessToken"]

sync_req = urllib.request.Request(
    "http://127.0.0.1:3075/api/admin/models/sync",
    headers={"Authorization": f"Bearer {token}"},
    method="POST",
)
result = json.load(urllib.request.urlopen(sync_req))
print(json.dumps(result, indent=2))
