# Stage 10.1 — Load Test Report

**Date:** 2026-06-08  
**Target:** Production `http://127.0.0.1:3075/api` (localhost on server)  
**Scripts:** `deploy/stage-10-load-test.py`, `deploy/stage-10-1-extended-load-test.py`, `deploy/stage-10-1-production-load-test.py`

---

## Executive Summary

| Test | Requests | Error Rate | Verdict |
|------|----------|------------|---------|
| Stage 10 baseline (burst) | 300 | **100%** after prior burst | ❌ Throttler-saturated |
| Extended burst | 1300 | **60.5%** mixed | ❌ Throttler 100/min |
| **Production paced** | **1150** | **0%** | ✅ **PASS** |

**Root cause of burst failures:** NestJS `ThrottlerGuard` — **100 requests / 60 seconds / IP** (`app.module.ts`).

---

## Production Paced Load Test (PASS)

**Script:** `deploy/stage-10-1-production-load-test.py`  
**Strategy:** ≤90 req/min batches with 61s pauses between windows

| Scenario | Iterations | Errors | p50 ms | p95 ms | RPS |
|----------|------------|--------|--------|--------|-----|
| health_paced_200 | 200 | 0 | 24.3 | 27.7 | 1.56 |
| assistants_list_paced_100 | 100 | 0 | 5.4 | 8.0 | 1.62 |
| system_metrics_paced_100 | 100 | 0 | 33.9 | 44.3 | 1.54 |
| system_queues_paced_100 | 100 | 0 | 9.3 | 14.9 | 1.61 |
| integrations_paced_100 | 100 | 0 | 4.3 | 8.8 | 1.63 |
| create_100_workflows_paced | 100 | 0 | — | — | 1.61 |
| mixed_read_paced_400 | 400 | 0 | 5.2 | 8.6 | 1.62 |
| assistants_concurrent_50 | 50 | 0 | 31.0 | 95.2 | 249.5 |

### Totals

| Metric | Value |
|--------|-------|
| Total requests | **1150** |
| Total errors | **0** |
| Overall error rate | **0.0%** |
| Workflows created | **100** |
| Assistant load ops | **100** |
| Integration API calls | **100** |
| Duration | ~11.5 min (paced) |

**Pass threshold:** error rate ≤ 2% → **PASS**

---

## Maximum Tested Load (Production)

| Dimension | Max tested | Sustained throughput | Notes |
|-----------|------------|----------------------|-------|
| Health reads | 200 (paced) | ~1.6 rps | p95 28ms |
| Assistant list | 100 paced + 50 concurrent | 250 rps burst (50 concurrent) | p95 95ms |
| System metrics | 100 | ~1.5 rps | p95 44ms |
| System queues | 100 | ~1.6 rps | p95 15ms |
| Integrations list | 100 | ~1.6 rps | p95 9ms |
| Workflow creates | 100 | ~1.6 rps | 0 errors |
| Mixed reads | 400 | ~1.6 rps | p95 9ms |
| **Burst (no pacing)** | >100/min | **429 ThrottlerException** | Hard ceiling |

### Not tested at scale

- 1000 concurrent assistants (plan limit: 10/org)
- 1M embeddings / 100k chunks
- Multi-tenant parallel load
- OpenRouter chat flood

---

## Bottleneck: Global Throttler

```
ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])
APP_GUARD → ThrottlerGuard
```

Any load test exceeding **100 req/min from one IP** receives HTTP 429, including `/api/health`.

**Recommendation (Stage 11):** Tier-aware throttling — exclude health/metrics probes; integrate `SystemRateLimitService` per-org RPM from PlanLimits; separate limits for API keys vs UI sessions.

---

## Infrastructure Load Headroom

| Resource | Observation |
|----------|-------------|
| CPU | <1% per PM2 process under paced load |
| RAM | API ~168 MB, workers ~140–155 MB each |
| PostgreSQL | Responsive, p95 metrics 44ms |
| Redis | Queue + cache shared; no errors |
| Disk I/O | Not saturated |

Server can handle **significantly higher** load once throttler and worker concurrency are tuned for commercial tiers.

---

*Report generated: Stage 10.1 Load Test — 2026-06-08*
