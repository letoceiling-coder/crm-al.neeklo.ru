#!/usr/bin/env python3
import json, urllib.request
data = json.dumps({"email": "dsc-23@yandex.ru", "password": "123123123"}).encode()
req = urllib.request.Request(
    "http://127.0.0.1:3075/api/auth/login",
    data=data,
    headers={"Content-Type": "application/json"},
    method="POST",
)
print(urllib.request.urlopen(req).read().decode())
