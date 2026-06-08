# Storage Validation — Stage 8.8

**Date:** 2026-06-08  
**Production server:** `root@212.67.9.173`  
**Bucket:** `crm-al-knowledge`  
**Provider:** Selectel Object Storage (`https://s3.ru-3.storage.selcloud.ru`)

---

## Environment (production)

| Variable | Value |
|----------|-------|
| `S3_ENDPOINT` | `https://s3.ru-3.storage.selcloud.ru` |
| `S3_REGION` | `ru-3` |
| `S3_BUCKET` | `crm-al-knowledge` |
| `S3_ACCESS_KEY` | configured (4785***fe6b) |
| `S3_SECRET_KEY` | configured (5eed***65f9) |
| Configured | **yes** |

---

## Remediation

Bucket `crm-al-knowledge` **did not exist** at Stage 8.7 (caused `NoSuchBucket` on document ingest).

**Action:** Created via `CreateBucketCommand` using `deploy/stage-8-8-s3-validation.js`.

---

## CRUD Validation

Script: `deploy/stage-8-8-s3-validation.js` (run from `/var/www/crm-al-tokens`)

| Operation | Result |
|-----------|--------|
| HEAD Bucket | ✅ PASS (created + verified) |
| PUT Object | ✅ PASS |
| HEAD Object | ✅ PASS |
| GET Object | ✅ PASS (bytes match) |
| DELETE Object | ✅ PASS |

**Overall:** ✅ **PASS**

---

## Knowledge Pipeline S3 Usage

After E2E validation, documents store:

- `raw/` — uploaded files (TXT, MD, PDF, DOCX, ZIP)
- `processed/` — normalized text versions (`v-*.txt`)

Example: `generated.pdf` → processed key with 912 chars, status `READY`, S3 object present.

---

## Health Check Note

`/api/health` reports `storage.ok: true` even when bucket was missing (HeadObject 404 treated as healthy). Recommend tightening health check in future — **not changed in Stage 8.8** (defect-only scope).

---

*Validated: 2026-06-08T00:30:50Z*
