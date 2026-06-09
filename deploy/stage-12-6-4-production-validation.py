#!/usr/bin/env python3
"""Stage 12.6.4 production validation."""
from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request

BASE = "https://crm-al.neeklo.ru/api"
PUBLIC = "https://crm-al.neeklo.ru"
PASS: list[str] = []
FAIL: list[str] = []


def ok(m: str) -> None:
    PASS.append(m)
    print("PASS:", m)


def fail(m: str) -> None:
    FAIL.append(m)
    print("FAIL:", m)


def req(method: str, path: str, body=None, token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"raw": raw}


def main():
    _, auth = req("POST", "/auth/login", body={"email": "admin@ai-gateway.local", "password": "admin123"})
    token = auth["accessToken"]
    ok("admin login")

    _, launch = req("GET", "/v1/system/launch", token=token)
    pct = launch.get("readinessPercent", 0)
    verdict = launch.get("verdict", "?")
    ok(f"launch {pct}% {verdict}")
    for k, v in launch.get("checks", {}).items():
        print(f"  check.{k}={v}")
    for k, v in (launch.get("informational") or {}).items():
        print(f"  info.{k}={v}")

    _, tg = req("GET", "/v1/system/telegram/settings", token=token)
    ok("telegram settings") if "webhookUrl" in tg else fail(f"telegram settings {tg}")

    _, users = req("GET", "/v1/system/telegram/users", token=token)
    ok("telegram users") if isinstance(users, list) else fail("telegram users")

    _, notif = req("GET", "/v1/system/telegram/notifications", token=token)
    ok("telegram notifications") if isinstance(notif, list) else fail("telegram notifications")

    code, wh = req("POST", "/v1/telegram/webhook", body={"update_id": 1})
    ok("telegram webhook public") if code == 200 or (isinstance(wh, dict) and wh.get("ok")) else fail(f"webhook {code}")

    _, payments = req("GET", "/v1/system/settings/payments", token=token)
    if isinstance(payments, list) and len(payments) == 1 and payments[0].get("provider") == "YOOKASSA":
        ok("YooKassa-only payments")
    else:
        fail("payments")

    html = urllib.request.urlopen(PUBLIC + "/", timeout=20).read().decode()
    m = re.search(r"/assets/(index-[^\"']+\.js)", html)
    if m:
        js = urllib.request.urlopen(PUBLIC + "/assets/" + m.group(1), timeout=30).read().decode("utf-8", errors="ignore")
        for marker in ("Центр запуска", "system/telegram/settings", "Сохранить", "Проверить подключение"):
            ok(f"bundle {marker!r}") if marker in js else fail(f"bundle missing {marker!r}")
    else:
        fail("no js bundle")

    print(json.dumps({"pass": len(PASS), "fail": len(FAIL), "verdict": "GO" if not FAIL else "NO-GO"}, indent=2))
    sys.exit(0 if not FAIL else 1)


if __name__ == "__main__":
    main()
