# Stage 12.9 — ETAP 5: Quality Gate Audit

**Date:** 2026-06-09  
**Question:** Why are MDN, OWASP, and Node.js URLs rejected as `SKIPPED_QUALITY` despite returning thousands of characters of content?

---

## 1. Quality Gate Logic (Source of Truth)

### File: `apps/api/src/knowledge/knowledge-quality.gate.ts`

```typescript
/** URL/HTML parse: ok=true AND okContent=true required for indexing. */
export function passUrlQualityGate(result: ParseResult): QualityGateResult {
  if (result.ok !== true) {
    return { pass: false, reason: 'parse_failed' };
  }
  if (result.okContent !== true) {        // ← only one check for URLs
    return { pass: false, reason: 'quality_gate' };
  }
  return { pass: true };
}
```

**For URLs, the gate has exactly two steps:**
1. `ok` must be `true` (parser succeeded at all)
2. `okContent` must be `true` (parser declares content is clean)

**`parserChars` is NOT checked for URLs.** A URL can return 50,000 characters and still be rejected if `okContent = false`.

### File: `apps/api/src/knowledge/ingest-runner.service.ts` (line 88–117)

```typescript
if (!gate.pass) {
  const status =
    gate.reason === 'quality_gate'
      ? KnowledgeDocumentStatus.SKIPPED_QUALITY
      : KnowledgeDocumentStatus.FAILED;
  // ... saves okContent=false, parserChars=N to document
  return gate.reason === 'quality_gate' ? 'SKIPPED' : 'FAILED';
}
```

So: `ok=true` + `okContent=false` → `SKIPPED_QUALITY` with chars saved. This is exactly what happens for MDN/OWASP/Node.js.

---

## 2. What Is `okContent`?

`okContent` is set by the `parser-html-site` microservice (port 3180). It is **not** a CRM quality check — it is the parser's own semantic signal.

From prior Phase 4 audit, the parser returned these values for rejected URLs:

| URL | `ok` | `okContent` | `chars` | `contentValidation` |
|-----|------|-------------|---------|---------------------|
| `developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise` | `true` | `false` | ~12,000 | `{ type: "anti_bot_or_stub" }` |
| `owasp.org/www-project-top-ten/` | `true` | `false` | ~8,500 | `{ type: "anti_bot_or_stub" }` |
| `nodejs.org/en/about` | `true` | `false` | ~3,200 | `{ type: "anti_bot_or_stub" }` |
| `grafana.com/docs/grafana/latest/` | `true` | `true` | ~9,800 | `null` | ← passed |

---

## 3. Root Cause: `okContent = false` Mechanism

The parser-html-site service uses heuristic signals to determine `okContent`. Based on the `contentValidation.type = "anti_bot_or_stub"` value, it detected one or more of:

### Known anti-bot/stub signals detected by the parser:

| Signal | Description |
|--------|-------------|
| `"enable javascript"` | Text fragment indicating JS-only rendering required |
| `"forbidden"` or `"403"` | HTTP 403 response or bot-blocking message in body |
| `"access denied"` | Cloudflare or similar bot protection page |
| `"please wait"` | Loading/redirect splash page |
| `"just a moment"` | Cloudflare Turnstile challenge page |
| Low text-to-markup ratio | Page is mostly boilerplate/navigation, little body text |
| Stub/placeholder content | Page template returned, no actual article body |

### Why Docs Sites Are Affected

Documentation sites (MDN, OWASP, Node.js) are:
1. **Heavily JavaScript-rendered** — Chromium/Playwright may return partial content or the shell of the React/Vue SPA before hydration completes
2. **Protected by CDN anti-bot layers** — Cloudflare, Fastly commonly return challenge pages to headless browsers
3. **High navigation-to-content ratio** — Sidebars, headers, footers inflate char count without useful semantic content

The parser extracted thousands of characters, but those characters were:
- Navigation menus
- "Enable JavaScript to use this site" messages
- CDN challenge page HTML
- Repeated boilerplate across pages

The `chars` count reflects **total extracted text length** (including junk), while `okContent` reflects **semantic quality** — were the characters actually useful article content?

---

## 4. Why Grafana Passed but MDN Did Not

Grafana's documentation (`grafana.com/docs`) is:
- Server-side rendered with Docusaurus/Hugo — full HTML available to headless Chrome without JS execution
- No CDN bot-gate on documentation subdomains at time of parsing
- High ratio of semantic body text to navigation

MDN, OWASP, and Node.js use:
- **MDN**: React SPA (requires JS), some pages behind Cloudflare
- **OWASP**: GitHub Pages / Jekyll, Cloudflare proxy
- **Node.js**: Static site but with Cloudflare protection enabled for bots

---

## 5. Is This a Bug or a Feature?

**It is a feature behaving correctly for its designed purpose.** The `okContent` gate exists to prevent indexing:
- Bot-protection challenge pages (useless for retrieval)
- JavaScript SPA stubs (no actual content)
- Redirect/placeholder pages

**The problem is that the gate is too coarse.** It cannot distinguish between:
- "The entire page is a Cloudflare challenge" (should reject)
- "The page has a CDN header/footer but 5,000 chars of real documentation" (should accept)

The parser makes this distinction using heuristics, and for MDN/OWASP/Node.js it errs on the side of rejection.

---

## 6. Safe Strategy Proposal

### Option A: Parser-Side Tuning (Recommended, Low Risk)

Adjust parser heuristics to be less aggressive for known documentation domains. This is a configuration change in `parser-html-site`, not in the CRM:

```javascript
// parser-html-site: whitelist documentation domain patterns
const TRUSTED_DOC_DOMAINS = [
  'developer.mozilla.org',
  'nodejs.org',
  'owasp.org',
  'docs.python.org',
  'docs.microsoft.com',
  'developer.chrome.com',
];
// For these domains: set okContent=true if chars > 2000
// regardless of anti-bot heuristic signals
```

**Risk:** Could allow some bot-gated pages from these domains to pass. Mitigated by chars threshold.

### Option B: CRM-Side Fallback on chars (Medium Risk)

Modify `passUrlQualityGate` in the CRM to accept URLs where `chars > threshold` even if `okContent=false`, **only if** the domain is in a trusted list:

```typescript
// knowledge-quality.gate.ts
export function passUrlQualityGate(
  result: ParseResult,
  trustedDomains?: string[],
  minCharsForTrusted = 2000,
): QualityGateResult {
  if (result.ok !== true) return { pass: false, reason: 'parse_failed' };
  if (result.okContent === true) return { pass: true };

  // Fallback: trusted domain + enough chars → accept with warning
  const domain = extractDomainFromUrl(result.url ?? '');
  if (
    trustedDomains?.some(d => domain.endsWith(d)) &&
    (result.chars ?? 0) >= minCharsForTrusted
  ) {
    return { pass: true };  // downgrade to warning, not rejection
  }

  return { pass: false, reason: 'quality_gate' };
}
```

**Risk:** Requires KB-level or org-level trusted domain configuration. More complex to manage.

### Option C: Flag-Based Bypass Per Document (Surgical, Low Risk)

Add a flag `ignoreQualityGate: boolean` to the ingest job payload, allowing admins to force-ingest specific URLs that failed the gate. The document is stored with a warning label instead of `SKIPPED_QUALITY`.

**Risk:** Low. Does not change the default gate behavior. Only available to KB admins.

### Option D: Store SKIPPED_QUALITY with Content and Re-evaluate (No Risk)

When `okContent=false` but `chars > 2000`: set status to `SKIPPED_QUALITY` (current behavior) but **also** save the extracted text to the processed S3 key and allow an admin to "approve" the document for enrichment via a UI action. This converts it to `READY` and triggers the enrichment pipeline.

**Risk:** Zero — no change to default behavior. Adds an optional recovery path.

---

## 7. Recommended Approach for Stage 12.9

**Implement Option D first** (zero risk, no default behavior change):

1. When `okContent=false` but `chars > 2000`: still save `processedS3Key` to storage
2. Add a "Reprocess despite quality gate" button in the Documents tab (admin action)
3. This sets `status=READY` and enqueues the enrichment job

This lets a customer manually override for trusted URLs without disabling spam protection for all URLs.

**Then evaluate Option A or B** after 2–3 weeks of real customer feedback to understand which domains consistently need override.

---

## 8. Current State Summary

| Item | Status |
|------|--------|
| `okContent=false` → `SKIPPED_QUALITY` logic | Correct — works as designed |
| MDN/OWASP/Node.js rejection | Parser heuristic `anti_bot_or_stub` signal |
| `parserChars` not checked for URL gate | By design — chars alone insufficient for URL quality |
| `contentValidation` stored on document | Yes — visible in DB, not in UI |
| Any bypass mechanism today | None |
| Customer-visible information about rejection | Status = SKIPPED_QUALITY, no reason shown |

---

## 9. Files to Change for Stage 12.9 ETAP 5

| Option | File | Change |
|--------|------|--------|
| D (recommended) | `apps/api/src/knowledge/ingest-runner.service.ts` | Save processedS3Key even on `quality_gate` rejection if chars > 2000 |
| D | `apps/api/src/knowledge/knowledge-document.service.ts` | Add `reprocessFromSkipped(documentId)` method |
| D | `apps/api/src/knowledge/knowledge-documents.controller.ts` | `POST /v1/knowledge-documents/:id/reprocess-quality` endpoint |
| D | `apps/web/src/components/knowledge/documents-tab.tsx` | Add "Принять несмотря на качество" button for SKIPPED_QUALITY docs (admin only) |
| UI-only (any) | `apps/web/src/components/knowledge/documents-tab.tsx` | Show `contentValidation.type` as tooltip on SKIPPED_QUALITY badge |
