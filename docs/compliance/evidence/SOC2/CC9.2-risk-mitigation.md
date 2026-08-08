# SOC2 Evidence — CC9.2 Risk Mitigation

**Control ID:** CC9.2  
**Control Name:** Risk Mitigation  
**Framework:** SOC2 Trust Service Criteria (2017)  
**SOVR Version:** 0.6.0  
**Evidence Date:** 2026-07-24

---

## Control Statement

The entity identifies, assesses, and manages risks to the achievement of its objectives.

---

## SOVR Implementation

SOVR mitigates risks through:

1. **Rate Limiting:** Global (200/min) and financial (20/min) rate limits.
2. **Circuit Breaker:** Rail driver circuit breakers prevent cascade failures across all registered rails.
3. **Fail-Closed Kernel:** Constitutional violations halt execution.
4. **Guardrail Bus:** Pre-execution checks for INV-001 and INV-002.

---

## Evidence

### Evidence 1: Rate Limiting

**File:** `packages/runtime/src/server/index.ts`  
**Classes:** `FinancialRateLimiter`  
**Lines:** 367-402

**Configuration:**
- Global: 200 requests/minute (Fastify `@fastify/rate-limit`)
- Financial: 20 financial commands/minute per actor (custom limiter)
- Key: `x-actor-id` header or IP address
- Response: 429 with `retry_after_ms`

**Verification:**
```bash
# Send 25 POST /api/v1/vault/asset commands in 1 minute
# Expected: 429 on 21st request
```

---

### Evidence 2: Circuit Breaker

**File:** `packages/runtime/src/adapters/base/BaseRailDriver.ts`  
**File:** `packages/runtime/src/adapters/RailDriverRegistry.ts`

**Configuration:**
- Failure threshold: 5 failures
- Time window: 60 seconds
- Success threshold: 2 successes to close
- Timeout: 60s

**States:**
- CLOSED — normal operation
- OPEN — reject all calls
- HALF_OPEN — allow test calls

**Verification:**
```bash
# Send failing requests to any registered rail until circuit opens
# Expected: circuit opens after threshold, subsequent requests return CircuitOpenError
```

---

### Evidence 3: Guardrail Bus

**File:** `packages/runtime/src/execution/index.ts`  
**Class:** `GuardrailCommandBus`  
**Function:** `executeSecure()`

**Checks:**
- INV-001: Cannot mutate state without emitting event
- INV-002: Double-entry balance must match (debits === credits)
- INV-003: Actor must have required capability
- INV-004: AI agents cannot grant financial authority

**Verification:**
```bash
# Send unbalanced ledger entry
curl -X POST http://localhost:3001/api/v1/ledger/entry \
  -H "Authorization: Bearer <jwt>" \
  -d '{"commandName":"ledger.entry.post","payload":{"debits":100,"credits":50}}'
# Expected: 422 ConstitutionalViolationError
```

---

### Evidence 4: Constitutional Invariants

**File:** `01_constitution.yaml`  
**Enforcement:** Runtime + compiler

**10 Invariants:**
- INV-001: Event Immutability
- INV-002: Double-Entry Balance
- INV-003: Authority Boundary
- INV-004: Agent Financial Authority Prohibition
- INV-005: Audit Trail Completeness
- INV-006: Events Describe, Don't Mutate
- INV-007: Value Preservation Priority
- INV-008: Command Execution Gates
- INV-009: Unknown State Representation
- INV-010: No Autonomous Bypass

---

## Test Results

| Test | Expected | Actual | Status |
|---|---|---|---|
| Rate limit (21st request) | 429 | 429 | ✅ PASS |
| Circuit breaker (6th failure) | CircuitOpenError | CircuitOpenError | ✅ PASS |
| Unbalanced ledger entry | 422 | 422 | ✅ PASS |
| Invalid state transition | 409 | 409 | ✅ PASS |
| Missing capability | 403 | 403 | ✅ PASS |

---

## Current Gaps

1. **Distributed Rate Limiting:** In-process only. Not effective in multi-node deployment.
2. **Multi-Adapter Circuit Breaker:** ✅ FIXED — all rails inherit circuit breaker, retry, and timeout from `BaseRailDriver`.
3. **Full Invariant Enforcement:** INV-001, INV-002, INV-003, INV-004 partially enforced. INV-005 through INV-010 specified but not fully wired.

---

## Auditor Verification Steps

1. Start runtime: `PORT=3001 node dist/server/index.js`
2. Run demo: `bash scripts/demo.sh`
3. Verify demo passes 13/13 checks
4. Run integration tests: `npm run test:integration`
5. Verify 16/16 tests pass
6. Review `packages/runtime/src/execution/index.ts` GuardrailCommandBus
7. Review `01_constitution.yaml` invariants
