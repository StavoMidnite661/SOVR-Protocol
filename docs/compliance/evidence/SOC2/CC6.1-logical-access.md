# SOC2 Evidence — CC6.1 Logical Access Controls

**Control ID:** CC6.1  
**Control Name:** Logical Access Controls  
**Framework:** SOC2 Trust Service Criteria (2017)  
**SOVR Version:** 0.9.0  
**Evidence Date:** 2026-07-24

---

## Control Statement

The entity implements logical access security software over sensitive information to restrict access to and use of such information.

---

## SOVR Implementation

SOVR enforces logical access controls at three layers:

1. **Transport Layer:** All financial API endpoints require Bearer JWT (RS256). No unauthenticated access to financial commands.
2. **Capability Layer:** 111 defined capabilities with scope patterns restrict what each actor can do.
3. **Identity Layer:** Actor types determine permitted commands and capabilities.

---

## Evidence

### Evidence 1: JWT Authentication Required

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

**Verification Command:**
```bash
curl -X POST http://localhost:3001/api/v1/vault/asset \
  -H "Content-Type: application/json" \
  -d '{"commandName":"vault.asset.register"}'
# Expected: 403 or missing_bearer
```

---

### Evidence 2: Capability Gate Enforced

**File:** `packages/runtime/src/execution/kernel-executor.ts`  
**Function:** `capabilityCheck()`  
**Lines:** Referenced in execute() pipeline

**Verification Command:**
```bash
# 1. Create session (no capability)
curl -X POST http://localhost:3001/api/v1/identity/session \
  -d '{"actor_id":"alice","actor_type":"human"}'
# → { jwt: "..." }

# 2. Attempt command without capability
curl -X POST http://localhost:3001/api/v1/vault/asset \
  -H "Authorization: Bearer <jwt>" \
  -d '{"commandName":"vault.asset.register"}'
# Expected: 403 CAPABILITY_DENIED

# 3. Grant capability
curl -X POST http://localhost:3001/api/v1/capabilities/grant \
  -H "Authorization: Bearer <jwt>" \
  -d '{"capability_id":"vault.asset.register","scope":"vault.asset:*"}'

# 4. Retry command
# Expected: 200 ACCEPTED
```

---

### Evidence 3: Capability Registry

**File:** `generated/registries/capabilities.registry.json`  
**Count:** 111 capabilities

**Sample Entry:**
```json
{
  "capability_id": "vault.asset.register",
  "domain": "vault",
  "resource": "vault.asset",
  "scope_pattern": "vault.asset:{asset_id}",
  "risk_level": "HIGH",
  "grantable_by": ["governance", "human"]
}
```

---

## Test Results

| Test | Expected | Actual | Status |
|---|---|---|---|
| Unauthenticated command | 403 | 403 | ✅ PASS |
| Authenticated without capability | 403 | 403 | ✅ PASS |
| Authenticated with capability | 200 | 200 | ✅ PASS |
| Invalid JWT | 403 | 403 | ✅ PASS |

---

## Current Gaps

1. **Capability Grant Durability:** Grants are in-memory only in v0.8.0. Lost on restart. (Addressed in v0.9.0)
2. **Scope Pattern Edge Cases:** Wildcard matching has untested edge cases.
3. **Multi-Factor Authentication:** Not implemented.

---

## Auditor Verification Steps

1. Review `packages/runtime/src/server/index.ts` auth helpers
2. Review `packages/runtime/src/execution/kernel-executor.ts` capabilityCheck()
3. Run integration tests: `npm run test:integration`
4. Verify 16/16 tests pass
5. Review `generated/registries/capabilities.registry.json`
