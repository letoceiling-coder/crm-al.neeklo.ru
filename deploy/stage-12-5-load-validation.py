#!/usr/bin/env python3
"""Stage 12.5 — Load validation (production). Skips payment if not configured."""
from __future__ import annotations

import concurrent.futures
import json
import sys
import time
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://crm-al.neeklo.ru/api"
PASS, FAIL, WARN = [], [], []


def ok(m):
    PASS.append(m)
    print(f"PASS: {m}")


def fail(m):
    FAIL.append(m)
    print(f"FAIL: {m}")


def warn(m):
    WARN.append(m)
    print(f"WARN: {m}")


def req(method, path, token=None, body=None, timeout=30):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            resp.read()
            return resp.status, time.perf_counter() - t0
    except urllib.error.HTTPError as e:
        e.read()
        return e.code, time.perf_counter() - t0
    except Exception:
        return 0, time.perf_counter() - t0


def login():
    code, _ = req("POST", "/auth/login", body={"email": "admin@ai-gateway.local", "password": "admin123"})
    if code not in (200, 201):
        raise RuntimeError("admin login failed")
    r = urllib.request.Request(
        BASE + "/auth/login",
        data=json.dumps({"email": "admin@ai-gateway.local", "password": "admin123"}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read())["accessToken"]


def burst(name, fn, n=50):
    codes = {}
    times = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        futs = [ex.submit(fn) for _ in range(n)]
        for f in concurrent.futures.as_completed(futs):
            code, dt = f.result()
            codes[code] = codes.get(code, 0) + 1
            times.append(dt)
    avg = sum(times) / len(times) if times else 0
    p95 = sorted(times)[int(len(times) * 0.95) - 1] if times else 0
    if 500 in codes or 0 in codes:
        fail(f"{name}: codes={codes} avg={avg:.2f}s p95={p95:.2f}s")
    elif 429 in codes:
        warn(f"{name}: rate limited codes={codes} avg={avg:.2f}s")
    else:
        ok(f"{name}: n={n} codes={codes} avg={avg:.2f}s p95={p95:.2f}s")


def main():
    print("=== Stage 12.5 Load Validation ===")
    admin = login()
    ok("admin login")

    burst("health x50", lambda: req("GET", "/health"))
    burst("login x50", lambda: req("POST", "/auth/login", body={"email": "admin@ai-gateway.local", "password": "admin123"}))
    burst("registration-status x50", lambda: req("GET", "/auth/registration-status"))

    def invoice_req():
        return req("GET", "/v1/billing/invoices", token=admin)

    burst("invoice-list x100", invoice_req, n=100)

    def chat_req():
        return req("GET", "/v1/assistants", token=admin)

    burst("assistants x100", chat_req, n=100)

    code, _ = req("GET", "/v1/system/health", token=admin)
    ok(f"post-load system health => {code}") if code == 200 else fail(f"post-load system health => {code}")

    print(json.dumps({"pass": len(PASS), "fail": len(FAIL), "warn": len(WARN)}, indent=2))
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
