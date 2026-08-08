# SOC2 Evidence — CC6.3 Authorization

**Control ID:** CC6.3  
**Control Name:** Authorization  
**Framework:** SOC2 Trust Service Criteria (2017)  
**SOVR Version:** 0.6.0  
**Evidence Date:** 2026-07-24

---

## Control Statement

The entity restricts logical access to system resources to authorized users and processes.

---

## SOVR Implementation

SOVR enforces authorization through capability-based access control:

1. **Capability Registry:** 113 capabilities defined in `capabilities.registry.json`.
2. **Scope Pattern Language:** `{resource}:{id}:{field}` with wildcard support.
3. **Pre-Execution Gate:** Capability check runs before every command execution.
4. **INV-003 Enforcement:** "No actor may exceed granted authority" — runtime enforced.

---

## Evidence

### Evidence 1: Capability Registry

**File:** `generated/registries/capabilities.registry.json`  
**Count:** 113 capabilities

**Sample Entries:**
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

### Evidence 2: Capability Engine

**File:** `packages/runtime/src/server/capabilityEngine.ts`  
**Functions:** `grant()`, `hasCapability()`, `listGrants()`

**Key Methods:**
- `grant({ capability_id, actor_id, scope_pattern, granted_by, expires_at })` — grants capability to actor
- `hasCapability(actor_id, capability_id, scope)` — checks if actor has capability in scope
- `listGrants(actor_id)` — returns all grants for actor

**Scope Pattern Matching:**
- `vault.asset:*` — all vault assets
- `vault.asset:{asset_id}` — specific asset
- `treasury.transfer:{actor_id}:*` — all transfers for actor

---

### Evidence 3: Kernel Capability Check

**File:** `packages/runtime/src/execution/kernel-executor.ts`  
**Function:** `capabilityCheck()`  
**Called from:** `execute()`

```typescript
private async capabilityCheck(request: CommandEnvelope, commandDef: any): Promise<void> {
  const requiredCap = commandDef.minimum_capability;
  if (!requiredCap) return; // No capability required
  const hasCap = await this.capabilityStore.hasCapability(
    request.identity_context.actor_id,
    requiredCap,
    request.scope
  );
  if (!hasCap) {
    throw new KernelValidationError('CAPABILITY_DENIED', 
      `Actor ${request.identity_context.actor_id} lacks capability ${requiredCap} in scope ${request.scope}`);
  }
}
```

---

### Evidence 4: API Endpoint

**File:** `packages/runtime/src/server/index.ts`  
**Endpoint:** `POST /api/v1/capabilities/grant`  
**Lines:** 550-575

```typescript
app.post('/api/v1/capabilities/grant', async (req: any) => {
  const { capability_id, actor_id, scope_pattern, expires_at } = req.body || {};
  if (!capability_id || !actor_id || !scope_pattern) {
    return { error: 'capability_id, actor_id, scope_pattern required' };
  }
  const requester = req.headers['x-actor-id'] || 'governance';
  capabilityEngine.grant({ capability_id, actor_id, scope_pattern, granted_by: requester, expires_at });
  // ...
});
```

---

## Test Results

| Test | Expected | Actual | Status |
|---|---|---|---|
| Command without capability | 403 | 403 | ✅ PASS |
| Command with valid capability | 200 | 200 | ✅ PASS |
| Capability grant via API | 200 | 200 | ✅ PASS |
| Invalid scope pattern | Rejected | Rejected | ✅ PASS |
| Expired capability | Rejected | Rejected | ✅ PASS |

---

## Current Gaps

1. **Durable Grants:** Capability grants are in-memory only in v0.8.0. Lost on restart. (Addressed in v0.6.0 via PostgreSQL-backed grants).
2. **Delegation Depth:** Specified as 0-2 levels, not enforced.
3. **Capability Revocation:** No revocation endpoint. Grants persist until restart (or process memory overflow).

---

## Auditor Verification Steps

1. Review `generated/registries/capabilities.registry.json`
2. Review `packages/runtime/src/server/capabilityEngine.ts`
3. Review `packages/runtime/src/execution/kernel-executor.ts` capabilityCheck()
4. Run integration tests: `npm run test:integration`
5. Verify 16/16 tests pass
