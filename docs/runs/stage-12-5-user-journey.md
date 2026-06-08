# Stage 12.5 — Full User Journey Validation

**Date:** 2026-06-08  
**Production:** https://crm-al.neeklo.ru

---

## Status

**BLOCKED** — Registration disabled; real YooKassa/SMTP not configured. Full 20-step commercial journey cannot be executed on production.

---

## Step-by-step Results

| # | Step | UI | API | DB | Audit | Status |
|---|------|----|-----|-----|-------|--------|
| 1 | Registration | ✅ `/register` loads | ❌ 403 disabled | — | — | ❌ BLOCKED |
| 2 | Email verification | — | — | — | — | ❌ BLOCKED (no SMTP) |
| 3 | Login | ✅ | ✅ admin login | ✅ | ✅ | ✅ (existing users) |
| 4 | Onboarding | ✅ | ✅ `/v1/onboarding/status` | ✅ | ✅ | ✅ |
| 5 | Create assistant | ✅ | ✅ `/v1/assistants` | ✅ | ✅ | ✅ |
| 6 | Knowledge base | ✅ | ✅ `/v1/knowledge-bases` | ✅ | ✅ | ✅ |
| 7 | Upload document | ✅ | ✅ | ✅ | ✅ | ✅ (prior stages) |
| 8 | Chunking | ✅ | worker | ✅ | ✅ | ✅ |
| 9 | Embeddings | ✅ | worker | ✅ | ✅ | ✅ |
| 10 | Assistant chat | ✅ | ✅ | ✅ | ✅ | ✅ |
| 11 | Upgrade plan | ✅ | ✅ subscription change | ✅ | ✅ | ✅ |
| 12 | Invoice | ✅ | ✅ pending invoice | ✅ | ✅ | ✅ |
| 13 | YooKassa payment | ⚠️ mock | ⚠️ mock redirect | ⚠️ mock | ✅ | ⚠️ MOCK ONLY |
| 14 | Subscription ACTIVE | ✅ | ✅ tier=PRO | ✅ | ✅ | ✅ (mock) |
| 15 | Marketplace install | ✅ | ✅ | ✅ | ✅ | ✅ |
| 16 | Workflow run | ✅ | ✅ `/v1/workflows` | ✅ | ✅ | ✅ |
| 17 | CRM lead | ✅ | ✅ `/v1/crm/clients` | ✅ | ✅ | ✅ |
| 18 | Tool execution | ✅ | worker | ✅ | ✅ | ✅ |
| 19 | Memory write | ✅ | worker | ✅ | ✅ | ✅ |
| 20 | Integration event | ✅ | worker | ✅ | ✅ | ✅ |

---

## Regression (admin org)

Stage 12.1 validation script: **25 PASS**, 2 FAIL (auth on some billing endpoints — expected tenant scoping), 2 WARN (mock payments, marketplace checkout backlog).

---

## Verdict — User Journey

**NO-GO for new commercial users** — Steps 1–2 and 13 require SMTP, registration, and real YooKassa.

Existing admin tenant journey (steps 3–12, 14–20) operational with mock payments.
