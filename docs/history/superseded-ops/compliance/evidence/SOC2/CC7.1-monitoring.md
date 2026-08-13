<!--
HISTORICAL / REMEDIATION RECORD

This file does not describe the current SOVR architecture.
See docs/ARCHITECTURE.md for the implementation that exists now.
-->

# SOC2 Evidence — CC7.1 System Monitoring

**Control ID:** CC7.1  
**Control Name:** System Monitoring  
**Framework:** SOC2 Trust Service Criteria (2017)  
**SOVR Version:** 0.6.0  
**Evidence Date:** 2026-07-24

---

## Control Statement

The entity monitors system components and the operation of security controls to ensure their continued effectiveness.

---

## SOVR Implementation

SOVR provides system monitoring through:

1. **Health Endpoint:** `/health` returns computed health of all subsystems.
2. **Circuit Breaker State:** Rail driver circuit breaker states visible in health (`rails.{railId}.state`).
3. **Event Log:** Append-only event log — every action auditable.
4. **Boot Attestation:** Cryptographic proof of kernel integrity.

---

## Evidence

### Evidence 1: Health Endpoint

**File:** `packages/runtime/src/server/index.ts`  
**Endpoint:** `GET /health`  
**Lines:** 407-447

**Subsystems Monitored:**
- `event_store` — total events, adapter type, connection status
- `projections` — projection count, record count
- `capabilities` — capability definitions, actors with grants
- `state_registry` — rebuild status, aggregate count
- `build_provenance` — manifest hash === attestation hash

**Sample Response:**
```json
{
  "status": "HEALTHY",
  "service": "sovr-financial-os",
  "protocol_version": "1.0.0",
  "compiler_version": "0.8.0",
  "build_hash": "b7d8221b...",
  "boot_hash": "...",
  "runlevel": 7,
  "final_health": "HEALTHY",
  "jwt": { "algorithm": "RS256", "mode": "development" },
  "rails": { "sovr-private-ledger": { "state": "CLOSED", "failures": 0 }, "ach": { "state": "CLOSED", "failures": 0 } },
  "subsystems": { ... },
  "event_store": { "totalEvents": 13, "adapter": "JSON" },
  "projections": { "projections": 16, "totalRecords": 0 },
  "capabilities": { "definitions": 111, "actorsWithGrants": 0 },
  "state_registry": { "status": "ready" },
  "timestamp": "2026-07-24T19:00:00.000Z"
}
```

---

### Evidence 2: Circuit Breaker State

**File:** `packages/runtime/src/adapters/base/BaseRailDriver.ts`  
**File:** `packages/runtime/src/adapters/RailDriverRegistry.ts`

**States:**
- `CLOSED` — normal operation
- `OPEN` — failures exceed threshold, calls rejected
- `HALF_OPEN` — recovery attempt

**Configuration (per rail):**
- Circuit breaker threshold: configurable per driver
- Circuit breaker reset: configurable ms before HALF_OPEN
- Retry: configurable maxRetries with exponential backoff
- Timeout: configurable per rail

**Verification:**
```bash
curl http://localhost:3001/health | jq '.rails'
# Expected: {"sovr-private-ledger":{"state":"CLOSED",...},...}
```

---

### Evidence 3: Event Log Audit Trail

**File:** `packages/runtime/src/execution/event-store.ts`  
**Endpoint:** `GET /api/v1/audit/:correlation_id`

**Returns:**
- Complete event trail for correlation ID
- `isComplete` flag (all events have audit + identity_context)
- `trail_length`

**Verification:**
```bash
# After running demo
curl http://localhost:3001/api/v1/audit/{correlation_id}
# Expected: { correlation_id, events: [...], isComplete: true, trail_length: N }
```

---

### Evidence 4: Boot Attestation

**File:** `packages/runtime/src/server/config.ts`  
**Endpoint:** `GET /api/v1/boot-attestation`

**Contains:**
- `build_hash` — must match compiler manifest
- `boot_hash` — SHA-256 over build_hash + boot_log + timings + health
- `boot_log_hash` — hash of boot sequence log
- `boot_timings_hash` — hash of stage timings

**Verification:**
```bash
curl http://localhost:3001/api/v1/manifest | grep build_hash
curl http://localhost:3001/api/v1/boot-attestation | grep build_hash
# Expected: matching hashes
```

---

## Test Results

| Test | Expected | Actual | Status |
|---|---|---|---|
| Health endpoint returns HEALTHY | 200 | 200 | ✅ PASS |
| Health includes JWT mode | Present | Present | ✅ PASS |
| Health includes circuit state | Present | Present | ✅ PASS |
| Audit trail complete | isComplete=true | true | ✅ PASS |
| Build hash matches attestation | Match | Match | ✅ PASS |

---

## Current Gaps

1. **Alerting:** No automated alerting on health degradation.
2. **Log Aggregation:** Logs go to stdout only. No centralized logging.
3. **Metrics Export:** No Prometheus/metrics endpoint.
4. **Anomaly Detection:** No automated detection of unusual command patterns.

---

## Auditor Verification Steps

1. Start runtime: `PORT=3001 node dist/server/index.js`
2. `curl http://localhost:3001/health` — verify HEALTHY
3. `curl http://localhost:3001/health | jq '.rails'` — verify all registered rails show circuit state
4. Run demo: `bash scripts/demo.sh`
5. `curl http://localhost:3001/api/v1/audit/{correlation_id}` — verify complete trail
6. `curl http://localhost:3001/api/v1/boot-attestation` — verify boot hash chain
