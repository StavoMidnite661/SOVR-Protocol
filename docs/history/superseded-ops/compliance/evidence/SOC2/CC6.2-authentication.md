<!--
HISTORICAL / REMEDIATION RECORD

This file does not describe the current SOVR architecture.
See docs/ARCHITECTURE.md for the implementation that exists now.
-->

# SOC2 Evidence — CC6.2 Authentication

**Control ID:** CC6.2  
**Control Name:** Authentication  
**Framework:** SOC2 Trust Service Criteria (2017)  
**SOVR Version:** 0.6.0  
**Evidence Date:** 2026-07-24

---

## Control Statement

The entity authenticates users and systems before granting access to system resources.

---

## SOVR Implementation

SOVR authenticates using RS256 asymmetric JWT:

1. **RS256 Asymmetric Signing:** Private key signs tokens, public key verifies. No shared secret.
2. **Production Fails-Closed:** `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` env vars required. Missing keys = startup failure.
3. **Development Ephemeral Keys:** Auto-generated on boot, invalid after restart.
4. **Token Validation:** `jwtVerify` enforces issuer, audience, algorithm, expiration.

---

## Evidence

### Evidence 1: RS256 Key Generation and Storage

**File:** `packages/runtime/src/security/jwt.ts`  
**Function:** `initialize()`  
**Lines:** 33-60

**Key Points:**
- Production: loads PKCS8 private key + SPKI public key from env vars
- Development: generates ephemeral 2048-bit RSA keypair via `jose`
- Never commits keys to git
- Production fails closed if keys missing

**Verification Command:**
```bash
# Production mode
JWT_PRIVATE_KEY="$(openssl genrsa 4096)" \
JWT_PUBLIC_KEY="$(openssl rsa -pubout)" \
NODE_ENV=production node dist/server/index.js
# Expected: JWT: RS256 keys loaded from environment

# Missing keys in production
NODE_ENV=production node dist/server/index.js
# Expected: FATAL: JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required in production.
```

---

### Evidence 2: JWT Signing

**File:** `packages/runtime/src/security/jwt.ts`  
**Function:** `sign()`  
**Lines:** 62-87

**Claims:**
- `sub`: subject (actor_id)
- `identity_id`: identity identifier
- `actor_id`: actor identifier
- `actor_type`: human, ai_agent, governance, etc.
- `session_id`: unique session identifier
- `iss`: sovr-protocol
- `aud`: sovr-clients
- `iat`: issued at
- `exp`: expiration (default 1h)
- `jti`: unique token identifier

**Algorithm:** RS256 (RSA + SHA-256)

---

### Evidence 3: JWT Verification

**File:** `packages/runtime/src/security/jwt.ts`  
**Function:** `verify()`  
**Lines:** 89-110

**Validation:**
- Signature verified with RS256 public key
- Issuer must be `sovr-protocol`
- Audience must be `sovr-clients`
- Expiration enforced
- Returns `{ valid: true, payload }` or `{ valid: false, reason }`

**Error Reasons:**
- `expired` — token past expiration
- `not_yet_valid` — nbf in future
- `wrong_issuer` — iss mismatch
- `wrong_audience` — aud mismatch
- `bad_signature` — signature invalid

---

### Evidence 4: Authentication in API Layer

**File:** `packages/runtime/src/server/index.ts`  
**Function:** `authFromBearer()`  
**Lines:** 341-347

```typescript
async function authFromBearer(authHeader?: string): Promise<{ ok: boolean; payload?: any; reason?: string }> {
  if (!authHeader?.startsWith('Bearer ')) return { ok: false, reason: 'missing_bearer' };
  const token = authHeader.slice(7);
  const result = await jwt.verify(token);
  if (!result.valid) return { ok: false, reason: result.reason };
  return { ok: true, payload: result.payload };
}
```

**Applied to:**
- All `POST /api/v1/:domain/:aggregate` commands
- All payment rail endpoints
- All capability management endpoints

**Not applied to:**
- `POST /api/v1/identity/session` (creates JWT, no auth required)
- `GET /health`, `/api/v1/health` (health checks)
- `GET /api/v1/manifest`, `/api/v1/boot-attestation` (public info)

---

## Test Results

| Test | Expected | Actual | Status |
|---|---|---|---|
| Valid JWT | 200 | 200 | ✅ PASS |
| Missing JWT | 403 | 403 | ✅ PASS |
| Expired JWT | 403 | 403 | ✅ PASS |
| Forged JWT | 403 | 403 | ✅ PASS |
| Wrong issuer | 403 | 403 | ✅ PASS |
| Algorithm confusion (RS256→HS256) | Rejected | Rejected | ✅ PASS |
| Production without keys | FATAL | FATAL | ✅ PASS |
| Ephemeral keys in dev | Warning | Warning | ✅ PASS |

---

## Current Gaps

1. **Multi-Factor Authentication:** Not implemented.
2. **Session Revocation:** No token revocation mechanism. Tokens valid until expiration.
3. **Key Rotation:** No automated key rotation ceremony.
4. **HSM Integration:** Keys stored in env vars, not HSM.

---

## Auditor Verification Steps

1. Review `packages/runtime/src/security/jwt.ts`
2. Review `packages/runtime/src/server/index.ts` auth helpers
3. Run integration tests: `npm run test:integration`
4. Verify boot log shows JWT algorithm and mode
5. Test with `curl` — missing/expired/invalid JWT scenarios
