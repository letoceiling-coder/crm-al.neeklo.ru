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

req = urllib.request.Request(
    "http://127.0.0.1:3075/api/api-keys",
    headers={"Authorization": f"Bearer {token}"},
)
keys = json.load(urllib.request.urlopen(req))
print("status: OK")
print("keys count:", len(keys))
