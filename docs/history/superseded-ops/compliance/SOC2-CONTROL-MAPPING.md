<!--
HISTORICAL / REMEDIATION RECORD

This file does not describe the current SOVR architecture.
See docs/ARCHITECTURE.md for the implementation that exists now.
-->

# SOVR Protocol — SOC2 Control Mapping

**Version:** 0.6.0  
**Date:** 2026-07-24  
**Status:** ACTIVE  
**Framework:** SOC2 Trust Service Criteria (2017)

---

## Control CC6.1 — Logical Access Controls

**SOC2 Criterion:** The entity implements logical access security software over sensitive information to restrict access to and use of such information.

**SOVR Implementation:**

SOVR enforces logical access controls at three layers:

1. **Transport Layer:** All API endpoints require Bearer JWT (RS256). No unauthenticated access to financial commands.
2. **Capability Layer:** 111 defined capabilities with scope patterns. Each command requires a specific capability grant.
3. **Identity Layer:** Actor types (human, ai_agent, governance, service_account, external_system) determine permitted commands.

**Evidence Locations:**
- `packages/runtime/src/security/jwt.ts` — RS256 JWT implementation
- `packages/runtime/src/server/capabilityEngine.ts` — capability registry and scope evaluation
- `packages/runtime/src/execution/kernel-executor.ts` — identityCheck(), capabilityCheck()
- `/health` endpoint — JWT mode reported in response

**Test Procedure:**
```bash
# 1. Verify JWT required
curl -X POST http://localhost:3001/api/v1/vault/asset
# Expected: 403 or missing_bearer

# 2. Verify capability required
# (with valid JWT but no capability grant)
curl -X POST http://localhost:3001/api/v1/vault/asset \
  -H "Authorization: Bearer <jwt>" \
  -d '{"commandName":"vault.asset.register"}'
# Expected: 403 CAPABILITY_DENIED
```

**Current Gaps:**
- Capability grants are in-memory only (not persisted across restarts in v0.8.0)
- Full scope pattern enforcement not wired into all command paths
- Multi-factor authentication not implemented

---

## Control CC6.2 — Authentication

**SOC2 Criterion:** The entity authenticates users and systems before granting access to system resources.

**SOVR Implementation:**

1. **RS256 Asymmetric JWT:** Private key signs tokens, public key verifies. No shared secret.
2. **Production Fails-Closed:** `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` env vars required in production. Missing keys = startup failure.
3. **Development Ephemeral Keys:** Auto-generated on boot, invalid after restart. Prevents token reuse across sessions.
4. **Token Validation:** `jwtVerify` enforces issuer (`sovr-protocol`), audience (`sovr-clients`), algorithm (`RS256`), expiration.

**Evidence Locations:**
- `packages/runtime/src/security/jwt.ts` — `JWTService.initialize()`, `sign()`, `verify()`
- `packages/runtime/src/server/index.ts` — `authFromBearer()` helper
- `packages/runtime/src/server/config.ts` — `JWT_PRIVATE_KEY` production validation
- Boot log: `JWT: RS256 keys loaded from environment` or `Using ephemeral RS256 keys`

**Test Procedure:**
```bash
# 1. Verify production fails without keys
NODE_ENV=production node dist/server/index.js
# (without JWT_PRIVATE_KEY/JWT_PUBLIC_KEY set)
# Expected: FATAL error on startup

# 2. Verify RS256 algorithm enforced
# (attempt HS256 algorithm confusion)
# Expected: jwtVerify rejects with algorithm mismatch

# 3. Verify issuer enforced
# Expected: 403 on issuer mismatch
```

**Current Gaps:**
- No MFA
- No session revocation (tokens valid until expiration)
- No key rotation ceremony documented
- No HSM integration for production key storage

---

## Control CC6.3 — Authorization

**SOC2 Criterion:** The entity restricts logical access to system resources to authorized users and processes.

**SOVR Implementation:**

1. **Capability Registry:** 113 capabilities organized by domain, each with minimum required capability and scope pattern.
2. **Scope Pattern Language:** `{resource}:{id}:{field}` with wildcard support. Example: `vault.asset:{asset_id}`.
3. **Pre-Execution Gate:** Capability check runs before command execution in `KernelExecutor.capabilityCheck()`.
4. **INV-003 Enforcement:** "No actor may exceed granted authority" — enforced at runtime.

**Evidence Locations:**
- `generated/registries/capabilities.registry.json` — 111 capability definitions
- `packages/runtime/src/server/capabilityEngine.ts` — `grant()`, `hasCapability()`, scope matching
- `packages/runtime/src/execution/kernel-executor.ts` — `capabilityCheck()`
- Integration test: `test/integration.test.ts` — capability grant flow

**Test Procedure:**
```bash
# 1. Grant capability
curl -X POST http://localhost:3001/api/v1/capabilities/grant \
  -H "Authorization: Bearer <jwt>" \
  -d '{"capability_id":"vault.asset.register","scope":"vault.asset:*"}'

# 2. Execute command with capability
curl -X POST http://localhost:3001/api/v1/vault/asset \
  -H "Authorization: Bearer <jwt>" \
  -d '{"commandName":"vault.asset.register","capability_id":"vault.asset.register"}'
# Expected: 200 (ACCEPTED)

# 3. Execute without capability
# (use different actor or omit capability_id)
# Expected: 403 CAPABILITY_DENIED
```

**Current Gaps:**
- Capability grants not durable (in-memory only in v0.8.0)
- Scope pattern edge cases in wildcard matching
- No capability delegation chain enforcement (delegation depth 0-2 specified but not enforced)

---

## Control CC7.1 — System Monitoring

**SOC2 Criterion:** The entity monitors system components and the operation of security controls to ensure their continued effectiveness.

**SOVR Implementation:**

1. **Health Endpoint:** `/health` returns computed health of all subsystems (event store, projections, capabilities, state registry, build provenance).
2. **Circuit Breaker State:** Rail driver circuit breaker states visible in health response (`rails.{railId}.state`).
3. **Event Log:** Append-only event log with 21-field envelope — every financial action is auditable.
4. **Boot Attestation:** Cryptographic boot hash chain proves kernel started from exact frozen YAML.

**Evidence Locations:**
- `packages/runtime/src/server/index.ts` — `computeSubsystemHealth()`, `/health` endpoint
- `packages/runtime/src/adapters/base/BaseRailDriver.ts` — circuit breaker, retry, timeout, audit
- `packages/runtime/src/adapters/RailDriverRegistry.ts` — rail registration
- `packages/runtime/src/execution/event-store.ts` — append-only event store
- `generated/boot-attestation.json` — boot hash chain

**Test Procedure:**
```bash
# 1. Verify health endpoint
curl http://localhost:3001/health
# Expected: HEALTHY with subsystem breakdown

# 2. Verify circuit breaker visible
curl http://localhost:3001/health | jq '.rails'
# Expected: all registered rails show circuit state (CLOSED/OPEN/HALF_OPEN)

# 3. Verify event log completeness
curl http://localhost:3001/api/v1/audit/{correlation_id}
# Expected: complete event trail with identity + audit fields
```

**Current Gaps:**
- No alerting on circuit breaker state changes
- No log aggregation (logs go to stdout only)
- No SIEM integration
- No anomaly detection on command patterns

---

## Control CC8.1 — Change Management

**SOC2 Criterion:** The entity authorizes, designs, develops, configures, documents, tests, and approves changes to infrastructure, data, software, and procedures before implementation.

**SOVR Implementation:**

1. **Constitution Lock:** Protocol specification is versioned and frozen. Changes require governance amendment.
2. **Build Hash:** SHA-256 over all inputs + IR + outputs + compiler version. Any change to inputs changes the hash.
3. **Compiler Certification:** `compiler-certification.json` records compiler version, inputs, outputs, and verification results.
4. **PASS-001 Verification:** YAML syntax and reference integrity verified at compile time.
5. **Boot Attestation:** Boot hash chain proves runtime started from exact compiled output.

**Evidence Locations:**
- `generated/compiler-manifest.yaml` — build_hash, per-file hashes
- `generated/compiler-certification.json` — compiler version, verification results
- `generated/boot-attestation.json` — boot_hash chain
- `packages/compiler/src/pipeline/` — PASS-001 through PASS-020
- `scripts/verify-spec.mjs` — byte-identical reproducibility check

**Test Procedure:**
```bash
# 1. Compile and verify
node packages/compiler/dist/cli.js compile
node packages/compiler/dist/cli.js verify
# Expected: "Reproducible build verified: b7d8221b..."

# 2. Boot and verify attestation
PORT=3001 node packages/runtime/dist/server/index.js &
curl http://localhost:3001/api/v1/boot-attestation | jq '.build_hash'
# Expected: matches compiler-manifest.yaml build_hash

# 3. Modify YAML and verify hash changes
# (edit 01_constitution.yaml)
node packages/compiler/dist/cli.js compile
# Expected: different build_hash
```

**Current Gaps:**
- No automated CI gate for build hash stability (compiler changes can change hash without spec changes)
- No signed compiler artifacts
- No reproducible build verification in CI (verify-spec.mjs exists but not in CI)

---

## Control CC9.2 — Risk Mitigation

**SOC2 Criterion:** The entity identifies, assesses, and manages risks to the achievement of its objectives.

**SOVR Implementation:**

1. **Rate Limiting:** Global (200/min) and financial (20/min) rate limits prevent abuse.
2. **Circuit Breaker:** Rail driver circuit breakers (configurable per rail) prevent cascade failures across all registered rails.
3. **Fail-Closed Kernel:** Constitutional violations halt execution (ERROR/FATAL in compiler, 422 in runtime).
4. **Guardrail Bus:** Pre-execution checks for INV-001 (event immutability) and INV-002 (double-entry balance).

**Evidence Locations:**
- `packages/runtime/src/server/index.ts` — `FinancialRateLimiter` class
- `packages/runtime/src/adapters/base/BaseRailDriver.ts` — circuit breaker, retry, timeout per rail
- `packages/runtime/src/execution/index.ts` — `GuardrailCommandBus`
- Integration tests: rate limit test, circuit breaker test, invariant enforcement test

**Test Procedure:**
```bash
# 1. Rate limit
# (send 25 financial commands in 1 minute)
# Expected: 429 on 21st request

# 2. Circuit breaker
# (send failing requests to any registered rail)
# Expected: rail circuit opens after threshold, subsequent requests rejected

# 3. Invariant enforcement
# (send unbalanced ledger entry)
# Expected: 422 ConstitutionalViolationError
```

**Current Gaps:**
- Circuit breaker only on ACH adapter (not on all external dependencies) — ✅ FIXED: all rails inherit `BaseRailDriver` circuit breaker
- No distributed rate limiting (in-process only)
- No automatic recovery from circuit open (manual intervention required)

---

## 6. SOC2 Readiness Assessment

| Control | Implemented | Evidence Complete | Testable | Gaps |
|---|---|---|---|---|
| CC6.1 Logical Access | Partial | Partial | Yes | Capability durability, scope edge cases |
| CC6.2 Authentication | Partial | Partial | Yes | MFA, key rotation, HSM |
| CC6.3 Authorization | Partial | Partial | Yes | Durable grants, delegation enforcement |
| CC7.1 Monitoring | Partial | Partial | Yes | Alerting, log aggregation, SIEM |
| CC8.1 Change Management | Partial | Partial | Yes | CI gate, signed artifacts |
| CC9.2 Risk Mitigation | Partial | Partial | Yes | Distributed rate limiting, multi-adapter circuit breaker |

**Overall SOC2 Readiness:** Partial. Core controls are implemented and testable. Gaps are documented and tracked to v1.0.0.

**Next Steps for SOC2:**
1. Complete capability grant persistence (v0.6.0)
2. Add CI gate for build hash stability (v0.6.0)
3. Implement key rotation ceremony (v1.0.0)
4. Add SIEM integration (v1.0.0)
5. External SOC2 auditor engagement (post-v1.0.0)
