#!/usr/bin/env python3
"""Stage 10.1 — Extended production load test (1000+ requests)."""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
import concurrent.futures

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3075/api"
RESULTS: list[dict] = []


def login() -> str:
    body = json.dumps({"email": "admin@ai-gateway.local", "password": "admin123"}).encode()
    req = urllib.request.Request(f"{BASE}/auth/login", body, {"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())["accessToken"]


def call(method: str, path: str, token: str | None = None, body: dict | None = None, timeout: int = 15):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status


def bench(name: str, fn, iterations: int, workers: int = 1):
    latencies: list[float] = []
    errors = 0
    start = time.perf_counter()

    if workers <= 1:
        for _ in range(iterations):
            t0 = time.perf_counter()
            try:
                fn()
                latencies.append((time.perf_counter() - t0) * 1000)
            except Exception:
                errors += 1
    else:
        def task():
            t0 = time.perf_counter()
            try:
                fn()
                return (time.perf_counter() - t0) * 1000, None
            except Exception as e:
                return None, e

        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
            futs = [ex.submit(task) for _ in range(iterations)]
            for f in futs:
                lat, err = f.result()
                if err:
                    errors += 1
                elif lat is not None:
                    latencies.append(lat)

    elapsed = time.perf_counter() - start
    latencies.sort()
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0
    result = {
        "scenario": name,
        "iterations": iterations,
        "workers": workers,
        "errors": errors,
        "throughputRps": round(iterations / elapsed, 2) if elapsed else 0,
        "latencyMsP50": round(latencies[len(latencies) // 2], 2) if latencies else 0,
        "latencyMsP95": round(p95, 2),
        "errorRate": round(errors / iterations, 4) if iterations else 0,
        "elapsedSec": round(elapsed, 2),
    }
    RESULTS.append(result)
    print(json.dumps(result))
    return result


def main():
    token = login()
    tag = f"load-{int(time.time())}"
    created_assistants: list[str] = []
    created_workflows: list[str] = []

    # 100 assistant API operations (list — plan limit blocks mass create)
    print("=== 100 assistant list requests (concurrent) ===")
    bench("assistants_list_100", lambda: call("GET", "/v1/assistants", token=token), 100, workers=20)

    # Create 100 workflows
    print("=== Creating 100 workflows ===")
    t0 = time.perf_counter()
    wf_errors = 0
    for i in range(100):
        try:
            body = json.dumps({
                "name": f"Stage101 Load WF {tag}-{i}",
                "triggerType": "MANUAL",
            }).encode()
            req = urllib.request.Request(
                f"{BASE}/v1/workflows", body,
                {"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=15) as r:
                data = json.loads(r.read())
                if data.get("id"):
                    created_workflows.append(data["id"])
        except Exception:
            wf_errors += 1
    wf_elapsed = time.perf_counter() - t0
    RESULTS.append({
        "scenario": "create_100_workflows",
        "iterations": 100,
        "errors": wf_errors,
        "created": len(created_workflows),
        "throughputRps": round(100 / wf_elapsed, 2),
        "elapsedSec": round(wf_elapsed, 2),
        "errorRate": round(wf_errors / 100, 4),
    })
    print(json.dumps(RESULTS[-1]))

    # 100 integration API calls
    print("=== 100 integration API calls ===")
    bench("integration_providers_100", lambda: call("GET", "/v1/integrations/providers", token=token), 100, workers=20)

    # 1000 read requests mixed
    print("=== 1000 mixed read requests ===")
    endpoints = [
        lambda: call("GET", "/health"),
        lambda: call("GET", "/v1/assistants", token=token),
        lambda: call("GET", "/v1/system/metrics", token=token),
        lambda: call("GET", "/v1/system/queues", token=token),
        lambda: call("GET", "/v1/knowledge-bases", token=token),
    ]
    mixed_errors = 0
    latencies: list[float] = []
    start = time.perf_counter()
    for i in range(1000):
        fn = endpoints[i % len(endpoints)]
        t1 = time.perf_counter()
        try:
            fn()
            latencies.append((time.perf_counter() - t1) * 1000)
        except Exception:
            mixed_errors += 1
    mixed_elapsed = time.perf_counter() - start
    latencies.sort()
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0
    mixed = {
        "scenario": "mixed_read_1000",
        "iterations": 1000,
        "errors": mixed_errors,
        "throughputRps": round(1000 / mixed_elapsed, 2),
        "latencyMsP50": round(latencies[len(latencies) // 2], 2) if latencies else 0,
        "latencyMsP95": round(p95, 2),
        "errorRate": round(mixed_errors / 1000, 4),
        "elapsedSec": round(mixed_elapsed, 2),
    }
    RESULTS.append(mixed)
    print(json.dumps(mixed))

    total_requests = 100 + 100 + 100 + 1000
    asst_errors = RESULTS[0]["errors"]
    total_errors = asst_errors + wf_errors + RESULTS[-2]["errors"] + mixed_errors
    summary = {
        "totalRequests": total_requests,
        "totalErrors": total_errors,
        "overallErrorRate": round(total_errors / total_requests, 4),
        "assistantsLoadOps": 100,
        "workflowsCreated": len(created_workflows),
        "passThreshold": "errorRate <= 0.02",
        "pass": total_errors / total_requests <= 0.02,
        "results": RESULTS,
    }
    print(json.dumps({"summary": summary}, indent=2))
    sys.exit(0 if summary["pass"] else 1)


if __name__ == "__main__":
    main()
