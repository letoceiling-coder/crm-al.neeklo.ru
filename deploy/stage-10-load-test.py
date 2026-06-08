#!/usr/bin/env python3
"""Stage 10 — Load test suite (synthetic benchmarks)."""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
import concurrent.futures

BASE = "http://127.0.0.1:3075/api"
RESULTS: list[dict] = []


def login() -> str:
    body = json.dumps({"email": "admin@ai-gateway.local", "password": "admin123"}).encode()
    req = urllib.request.Request(f"{BASE}/auth/login", body, {"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())["accessToken"]


def bench(name: str, fn, iterations: int = 50):
    latencies: list[float] = []
    errors = 0
    start = time.perf_counter()
    for _ in range(iterations):
        t0 = time.perf_counter()
        try:
            fn()
            latencies.append((time.perf_counter() - t0) * 1000)
        except Exception:
            errors += 1
    elapsed = time.perf_counter() - start
    latencies.sort()
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0
    result = {
        "scenario": name,
        "iterations": iterations,
        "errors": errors,
        "throughputRps": round(iterations / elapsed, 2) if elapsed else 0,
        "latencyMsP50": round(latencies[len(latencies) // 2], 2) if latencies else 0,
        "latencyMsP95": round(p95, 2),
        "errorRate": round(errors / iterations, 4),
    }
    RESULTS.append(result)
    print(json.dumps(result))


def main():
    token = login()

    def health():
        urllib.request.urlopen(f"{BASE}/health", timeout=10)

    def system_metrics():
        req = urllib.request.Request(f"{BASE}/v1/system/metrics", headers={"Authorization": f"Bearer {token}"})
        urllib.request.urlopen(req, timeout=15)

    def system_queues():
        req = urllib.request.Request(f"{BASE}/v1/system/queues", headers={"Authorization": f"Bearer {token}"})
        urllib.request.urlopen(req, timeout=15)

    bench("health_100", health, 100)
    bench("system_metrics_50", system_metrics, 50)
    bench("system_queues_50", system_queues, 50)

    # Concurrent assistants list simulation
    def assistants():
        req = urllib.request.Request(f"{BASE}/v1/assistants", headers={"Authorization": f"Bearer {token}"})
        urllib.request.urlopen(req, timeout=15)

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as ex:
        start = time.perf_counter()
        futs = [ex.submit(assistants) for _ in range(100)]
        errors = sum(1 for f in futs if f.exception())
        elapsed = time.perf_counter() - start
    RESULTS.append({
        "scenario": "concurrent_assistants_list_100",
        "iterations": 100,
        "errors": errors,
        "throughputRps": round(100 / elapsed, 2),
        "latencyMsP50": 0,
        "latencyMsP95": 0,
        "errorRate": round(errors / 100, 4),
    })
    print(json.dumps(RESULTS[-1]))

    summary = {
        "maxTestedAssistantsListConcurrent": 100,
        "maxTestedHealthRequests": 100,
        "note": "Full 1000 assistants / 1M embeddings require dedicated staging cluster",
    }
    print(json.dumps({"results": RESULTS, "summary": summary}, indent=2))


if __name__ == "__main__":
    main()
