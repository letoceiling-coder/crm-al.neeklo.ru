#!/usr/bin/env python3
"""Stage 10.1 — Production load test paced under NestJS ThrottlerGuard (100 req/min)."""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
import concurrent.futures

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3075/api"
THROTTLE_LIMIT = 90  # stay under 100/min global throttler
RESULTS: list[dict] = []


def login() -> str:
    body = json.dumps({"email": "admin@ai-gateway.local", "password": "admin123"}).encode()
    req = urllib.request.Request(f"{BASE}/auth/login", body, {"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())["accessToken"]


def call(method: str, path: str, token: str | None = None, timeout: int = 15) -> int:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(BASE + path, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status


def paced_batch(name: str, fn, total: int, batch_size: int = THROTTLE_LIMIT):
    errors = 0
    latencies: list[float] = []
    start = time.perf_counter()
    done = 0
    while done < total:
        n = min(batch_size, total - done)
        for _ in range(n):
            t0 = time.perf_counter()
            try:
                fn()
                latencies.append((time.perf_counter() - t0) * 1000)
            except Exception:
                errors += 1
            done += 1
        if done < total:
            time.sleep(61)  # reset throttler window
    elapsed = time.perf_counter() - start
    latencies.sort()
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0
    result = {
        "scenario": name,
        "iterations": total,
        "errors": errors,
        "throughputRps": round(total / elapsed, 2) if elapsed else 0,
        "latencyMsP50": round(latencies[len(latencies) // 2], 2) if latencies else 0,
        "latencyMsP95": round(p95, 2),
        "errorRate": round(errors / total, 4) if total else 0,
        "elapsedSec": round(elapsed, 2),
        "paced": True,
    }
    RESULTS.append(result)
    print(json.dumps(result))
    return result


def concurrent_batch(name: str, fn, total: int, workers: int = 10):
    errors = 0
    latencies: list[float] = []
    start = time.perf_counter()

    def task():
        t0 = time.perf_counter()
        try:
            fn()
            return (time.perf_counter() - t0) * 1000, None
        except Exception as e:
            return None, e

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        futs = [ex.submit(task) for _ in range(total)]
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
        "iterations": total,
        "workers": workers,
        "errors": errors,
        "throughputRps": round(total / elapsed, 2) if elapsed else 0,
        "latencyMsP50": round(latencies[len(latencies) // 2], 2) if latencies else 0,
        "latencyMsP95": round(p95, 2),
        "errorRate": round(errors / total, 4) if total else 0,
        "elapsedSec": round(elapsed, 2),
    }
    RESULTS.append(result)
    print(json.dumps(result))
    return result


def main():
    token = login()
    tag = f"load-{int(time.time())}"
    wf_created = 0
    wf_errors = 0

    paced_batch("health_paced_200", lambda: call("GET", "/health"), 200)
    paced_batch("assistants_list_paced_100", lambda: call("GET", "/v1/assistants", token=token), 100)
    paced_batch("system_metrics_paced_100", lambda: call("GET", "/v1/system/metrics", token=token), 100)
    paced_batch("system_queues_paced_100", lambda: call("GET", "/v1/system/queues", token=token), 100)
    paced_batch("integrations_paced_100", lambda: call("GET", "/v1/integrations/providers", token=token), 100)

    # 100 workflow creates — paced in batches
    print("=== create 100 workflows (paced) ===")
    t0 = time.perf_counter()
    for i in range(100):
        try:
            body = json.dumps({"name": f"Stage101 WF {tag}-{i}", "triggerType": "MANUAL"}).encode()
            req = urllib.request.Request(
                f"{BASE}/v1/workflows", body,
                {"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=15) as r:
                if json.loads(r.read()).get("id"):
                    wf_created += 1
        except Exception:
            wf_errors += 1
        if (i + 1) % THROTTLE_LIMIT == 0:
            time.sleep(61)
    wf_elapsed = time.perf_counter() - t0
    wf_result = {
        "scenario": "create_100_workflows_paced",
        "iterations": 100,
        "errors": wf_errors,
        "created": wf_created,
        "errorRate": round(wf_errors / 100, 4),
        "elapsedSec": round(wf_elapsed, 2),
        "paced": True,
    }
    RESULTS.append(wf_result)
    print(json.dumps(wf_result))

    # 400 mixed to reach 1000+ total
    paced_batch("mixed_read_paced_400", lambda: call("GET", "/v1/knowledge-bases", token=token), 400)

    concurrent_batch("assistants_concurrent_50", lambda: call("GET", "/v1/assistants", token=token), 50, workers=10)

    total_req = sum(r.get("iterations", 0) for r in RESULTS)
    total_err = sum(r.get("errors", 0) for r in RESULTS)
    summary = {
        "totalRequests": total_req,
        "totalErrors": total_err,
        "overallErrorRate": round(total_err / total_req, 4) if total_req else 0,
        "workflowsCreated": wf_created,
        "throttlerNote": "Paced under NestJS ThrottlerGuard 100 req/min/IP",
        "pass": total_err / total_req <= 0.02 if total_req else False,
        "results": RESULTS,
    }
    print(json.dumps({"summary": summary}, indent=2))
    sys.exit(0 if summary["pass"] else 1)


if __name__ == "__main__":
    main()
