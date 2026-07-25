# SOVR Protocol — Security Findings Register

**Version:** v1.0.0-rc
**Date:** 2026-07-25
**Build hash:** `d27fdbe60290ba976f684bb7d0096b911195776d975bb1da8bdd6c56d835e512`
**Classification:** Auditor Confidential
---

## SOVR-SEC-001

| Field | Value |
|---|---|
| **ID** | SOVR-SEC-001 |
| **Title** | FinancialRateLimiter keyed on spoofable x-actor-id header |
| **Severity** | MEDIUM |
| **Discovered** | 2026-07-25 (internal pre-audit self-test Q10) |
| **Status** | REMEDIATED ✅ |
| **Closed** | 2026-07-25 |
| **File** | `packages/runtime/src/server/index.ts` lines 401-414 |

### Description

The `FinancialRateLimiter` preHandler hook keyed rate-limit buckets on the raw `x-actor-id` request header:

```typescript
const key = (request.headers['x-actor-id'] as string) ?? request.ip;
```

This header is client-supplied and attacker-controlled. An attacker could:

1. **Rate limit evasion:** Rotate `x-actor-id` values to bypass per-actor rate limits
2. **Actor DoS:** Exhaust another actor's rate-limit bucket by sending requests with that actor's `x-actor-id`

### Fix Applied

```typescript
// BEFORE (vulnerable):
app.addHook('preHandler', async (request, reply) => {
  if (request.method === 'POST' && String(request.url).startsWith('/api/v1/') && !String(request.url).includes('/identity/session')) {
    const key = (request.headers['x-actor-id'] as string) ?? request.ip;
    const limit = financialRateLimiter.check(key);
    ...
  }
});

// AFTER (remediated):
app.addHook('preHandler', async (request, reply) => {
  if (request.method === 'POST' && String(request.url).startsWith('/api/v1/') && !String(request.url).includes('/identity/session')) {
    const ctx = await identityContextFromReq(request);
    const key = ctx.actor_id;
    const limit = financialRateLimiter.check(key);
    ...
  }
});
```

The rate limiter now keys on the **JWT-verified `actor_id`** from `identityContextFromReq()`, which is extracted from a cryptographically verified RS256 JWT. This value cannot be spoofed by the client.

### Verification

| Test | Method | Result |
|---|---|---|
| Q9 Rate limit 429 | 25 rapid POST requests | ✅ 429 returned |
| Q10 Spoofed x-actor-id | 10 requests with different `x-actor-id`, same JWT | ✅ Same bucket, 429 returned |
| Q10b Per-actor isolation | Separate JWT for Bob | ✅ Independent bucket |
| 16/16 integration tests | `npm run test:integration` | ✅ All pass |
| 13/13 demo | `bash scripts/demo.sh` | ✅ All pass |

### Auditor Verification Steps

1. Send 20 rapid POST requests to `/api/v1/vault/asset` with valid JWT (actor A)
2. Observe 429 after threshold
3. Resend 10 requests with different `x-actor-id` header values, same JWT
4. Observe same bucket — same 429 response
5. Send 20 rapid POST requests with different JWT (actor B)
6. Observe independent bucket — B not affected by A's exhaustion

### Impact Assessment

| Aspect | Before Fix | After Fix |
|---|---|---|
| Rate limit bypass | Possible via header rotation | Not possible |
| Cross-actor DoS | Possible | Not possible |
| Per-actor isolation | No | Yes |
| Production risk | Medium | None |

---

## Finding History

| Date | Event |
|---|---|
| 2026-07-25 | Discovered during pre-audit self-test Q10 |
| 2026-07-25 | Fix applied: `packages/runtime/src/server/index.ts` |
| 2026-07-25 | Rebuilt: `tsc -p tsconfig.json` |
| 2026-07-25 | Q9 retest: 429 confirmed |
| 2026-07-25 | Q10 retest: spoofed header hits same bucket |
| 2026-07-25 | Q10b: per-actor bucket isolation proven |
| 2026-07-25 | 16/16 integration tests pass |
| 2026-07-25 | 13/13 demo passes |
| 2026-07-25 | Status changed to REMEDIATED |

---

## Open Findings

**None.**

All findings from the pre-audit self-test have been remediated or verified as non-issues.

---

## Pre-Disclosed Dev-Only Findings

These findings exist in dev dependencies only and are not in the production bundle:

| Finding | Severity | Status | Component |
|---|---|---|---|
| esbuild moderate | MODERATE | OPEN | vite (dev) |
| brace-expansion high | HIGH | OPEN | @vitest/coverage-v8 (dev) |

**Production bundle: 0 HIGH / 0 CRITICAL.**
