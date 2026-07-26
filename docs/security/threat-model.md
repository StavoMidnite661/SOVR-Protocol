# SOVR Protocol — Threat Model

**Version:** 0.9.0  
**Date:** 2026-07-24  
**Status:** ACTIVE  
**Classification:** Internal — Security Audit Input

---

## 1. Scope

This threat model covers the SOVR Financial OS reference implementation:
- Compiler (`packages/compiler`)
- Runtime (`packages/runtime`)
- Protocol specification (YAML corpus)
- Generated artifacts (IR, registries, TLA+ specs)
- PostgreSQL event store
- Kafka / Redis publishers
- REST API (Fastify)
- JWT authentication layer
- Boundary adapters (ACH mock)

Out of scope for this document:
- Infrastructure hosting (cloud provider hardening)
- Physical security
- Social engineering of operators
- Supply chain beyond npm package substitution

---

## 2. Threat Actor Profiles

| Actor | Motivation | Capability | Target |
|---|---|---|---|
| Malicious Insider | Financial gain, disruption | High — has repo access, knows internals | Registry tampering, YAML injection |
| External Attacker | Theft, fraud, disruption | Medium — network access, no source access | API exploitation, SQL injection, JWT forgery |
| Compromised Dependency | Supply chain attack | High — trusted npm package is malicious | Runtime takeover via malicious package |
| Nation-State | Espionage, systemic disruption | Very high — unlimited resources | Protocol manipulation, key exfiltration |
| Negligent Operator | None (accidental) | Low — misconfiguration | Exposure of secrets, weak keys, open PostgreSQL |

---

## 3. Threat Categories

### THREAT CATEGORY 1: Protocol Manipulation

#### T1.1 — Malicious YAML Injection

**Description:** An attacker with commit access injects malicious state machines, commands, or capabilities into the YAML corpus.

**Threat Actor:** Malicious Insider

**Attack Vector:** Direct commit to repository, or compromised CI pipeline that modifies YAML before compilation.

**Current Mitigations:**
- Constitution lock hash verified at boot (build_hash chain)
- PASS-001 YAML syntax verification
- PASS-002 reference integrity checks
- SHA-256 build hash — any YAML change changes the hash
- Compiler certification (`compiler-certification.json`)
- Byte-identical reproducibility (R1–R10)

**Residual Risk:** Low. An attacker with commit access can modify YAML, but the resulting build hash changes, boot attestation fails, and the system detects tampering. The threat is detectable, not preventable without code review controls.

**Audit Evidence:**
- `generated/compiler-manifest.yaml` — build_hash
- `generated/boot-attestation.json` — boot_hash chain
- `packages/compiler/src/pipeline/` — PASS-001, PASS-002 implementation
- `scripts/verify-spec.mjs` — reproducibility check

---

#### T1.2 — Registry Tampering

**Description:** An attacker modifies compiled registry files (`commands.registry.json`, `machines.registry.json`, etc.) after compilation but before deployment.

**Threat Actor:** Malicious Insider, Compromised CI/CD

**Attack Vector:** Modified files in artifact store, compromised build artifact, or post-compile injection.

**Current Mitigations:**
- SHA-256 per registry file in `compiler-manifest.yaml`
- Build hash covers all registry files
- Runtime verifies build hash at boot
- `registry.manifest.json` acts as ELF header equivalent

**Residual Risk:** Low. Registry files are content-addressed. Any modification changes the manifest hash. Runtime detects mismatch at boot.

**Audit Evidence:**
- `generated/compiler-manifest.yaml` — per-file hashes
- `packages/runtime/src/server/config.ts` — build_hash verification
- Boot attestation chain in `bootKernel()`

---

#### T1.3 — Compiler Substitution

**Description:** An attacker replaces the SOVR compiler binary with a modified version that emits malicious registries while appearing to produce valid output.

**Threat Actor:** Nation-State, Compromised Dependency

**Attack Vector:** Compromised npm package, modified `dist/cli.js`, supply chain attack on `js-yaml` or `jose`.

**Current Mitigations:**
- Build hash includes compiler version (R8)
- Byte-identical reproducibility — known-good compiler produces same output
- `npm audit` / `package-lock.json` for dependency integrity
- No dynamic code generation in compiler

**Residual Risk:** Medium. The compiler is a Node.js application with npm dependencies. A compromised dependency could modify compiler behavior. Mitigation: dependency pinning, SRI, reproducible builds.

**Audit Evidence:**
- `packages/compiler/package.json` — pinned dependencies
- `scripts/verify-spec.mjs` — reproducibility verification
- `BUILD_MANIFEST.yaml` — R1–R10 rules

---

### THREAT CATEGORY 2: Runtime Attacks

#### T2.1 — Command Injection via API

**Description:** An attacker sends crafted payloads to the universal command route (`POST /api/v1/:domain/:aggregate`) to trigger unauthorized state transitions or bypass validation.

**Threat Actor:** External Attacker

**Attack Vector:** HTTP POST with crafted `commandName`, `payload`, or `meta` fields.

**Current Mitigations:**
- Instruction tree validation — payloads validated against compiled validation trees
- VEL evaluator is Turing-incomplete — no arbitrary code execution
- State machine enforcement — invalid transitions rejected (409)
- No `eval()`, no `switch(commandName)` in runtime
- Capability gate — commands require valid capability_id
- Rate limiting — 20 financial commands/minute per actor

**Residual Risk:** Low. The universal route delegates to the compiled instruction tree. Invalid payloads are rejected before execution. No runtime code path accepts arbitrary code.

**Audit Evidence:**
- `packages/runtime/src/execution/instruction-evaluator.ts` — VEL AST evaluator
- `packages/runtime/src/execution/state-machine-interpreter.ts` — transition enforcement
- `packages/runtime/src/server/index.ts` — rate limiter, capability check
- Integration tests: `test/integration.test.ts` — invalid transition rejection

---

#### T2.2 — Authentication Bypass

**Description:** An attacker bypasses JWT authentication to issue commands without identity.

**Threat Actor:** External Attacker

**Attack Vector:** Missing Authorization header, expired token, forged token, algorithm confusion (RS256 → HS256).

**Current Mitigations:**
- RS256 asymmetric signing — private key never shared
- Production mode requires `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` env vars — fails closed
- Development mode uses ephemeral keys — tokens invalid after restart
- `jwtVerify` enforces issuer, audience, algorithm
- Rate limiting applies even without auth (IP-based)

**Residual Risk:** Low. RS256 algorithm confusion is not possible with `jose` library — it rejects algorithm substitution. Key exfiltration from environment is an operational risk, not a code vulnerability.

**Audit Evidence:**
- `packages/runtime/src/security/jwt.ts` — RS256 signing and verification
- `packages/runtime/src/server/index.ts` — `authFromBearer()` helper
- Boot logs: JWT algorithm and mode printed at boot

---

#### T2.3 — Authorization Escalation

**Description:** An attacker uses a valid JWT but with elevated capabilities to execute unauthorized commands.

**Threat Actor:** External Attacker, Malicious Insider

**Attack Vector:** Stolen JWT, capability grant manipulation, scope pattern bypass.

**Current Mitigations:**
- Capability registry — 111 defined capabilities with scope patterns
- Pre-execution capability gate — `capabilityCheck()` in `KernelExecutor`
- Scope pattern language — `{resource}:{id}:{field}` with wildcard control
- INV-003 enforcement — "No actor may exceed granted authority"
- Capability grants stored in PostgreSQL (migration 001)

**Residual Risk:** Medium. Capability grants are checked at the API layer and in the kernel. However, scope pattern evaluation is string-based and could have edge cases. The capability engine is not yet fully wired into all command paths.

**Audit Evidence:**
- `packages/runtime/src/server/capabilityEngine.ts` — scope evaluation
- `packages/runtime/src/execution/kernel-executor.ts` — capabilityCheck()
- `generated/registries/capabilities.registry.json` — 111 capability definitions
- Integration test: capability grant + command execution flow

---

#### T2.4 — Rate Limit Bypass

**Description:** An attacker circumvents rate limiting to send high volumes of financial commands.

**Threat Actor:** External Attacker

**Attack Vector:** IP rotation, distributed requests, header manipulation to change rate limit key.

**Current Mitigations:**
- Global rate limit: 200 requests/minute (Fastify `@fastify/rate-limit`)
- Financial rate limit: 20 financial commands/minute per actor (custom `FinancialRateLimiter`)
- Rate limit key: `x-actor-id` header or IP address
- 429 response with `retry_after_ms`

**Residual Risk:** Low. Distributed rate limit bypass requires botnet. The financial rate limiter is in-process and resets on restart — not suitable for multi-node (documented in ADR-MULTI-NODE.md).

**Audit Evidence:**
- `packages/runtime/src/server/index.ts` — `FinancialRateLimiter` class
- Boot health: rate limiter state visible in `/health`

---

### THREAT CATEGORY 3: Data Attacks

#### T3.1 — Event Log Tampering

**Description:** An attacker with database access modifies or deletes events from the append-only event log.

**Threat Actor:** External Attacker (if PostgreSQL exposed), Malicious Insider (DBA)

**Attack Vector:** Direct SQL UPDATE/DELETE on `sovr_events` table, trigger bypass via superuser.

**Current Mitigations:**
- PostgreSQL trigger `sovr_events_prevent_update_delete` — blocks UPDATE/DELETE at row level
- Trigger owned by `postgres` superuser — not droppable by `sovr` user
- `sovr` database user has INSERT + SELECT only (no UPDATE/DELETE GRANT)
- Boot attestation — build_hash chain proves log integrity
- Event IDs are UUIDs — not guessable for targeted tampering

**Residual Risk:** Low. A PostgreSQL superuser can bypass triggers. Mitigation: separate `sovr` user with minimal grants, trigger in separate schema owned by different role, or use PostgreSQL row-level security (RLS).

**Audit Evidence:**
- `packages/runtime/src/adapters/postgres-event-store.ts` — `MIGRATION_SQL` trigger definition
- `deployment/docker-compose.dev.yml` — database user configuration
- `generated/boot-attestation.json` — boot hash chain

---

#### T3.2 — State Registry Poisoning

**Description:** An attacker injects false state into the `sovr_aggregate_states` table to manipulate command routing or projection results.

**Threat Actor:** External Attacker, Malicious Insider

**Attack Vector:** Direct SQL INSERT/UPDATE on `sovr_aggregate_states`, event log replay with fake events.

**Current Mitigations:**
- StateRegistry rebuilt from event log on startup — ground truth is events, not state table
- State table is a cache — inconsistencies are resolved by replaying events
- `sovr_aggregate_states` has immutability trigger
- Command execution reads state from registry, which is rebuilt from events

**Residual Risk:** Low. State registry poisoning would cause temporary inconsistency until next rebuild. The event log is the source of truth.

**Audit Evidence:**
- `packages/runtime/src/execution/state-registry.ts` — rebuild from genesis
- `packages/runtime/src/adapters/postgres-event-store.ts` — state table trigger

---

#### T3.3 — SQL Injection

**Description:** An attacker injects SQL through API payloads or query parameters to extract or modify data.

**Threat Actor:** External Attacker

**Attack Vector:** Crafted JSON payload with SQL fragments in command parameters, query string injection in event queries.

**Current Mitigations:**
- All PostgreSQL queries use parameterized statements (`$1`, `$2`, ...)
- No dynamic SQL construction from user input
- Fastify does not parse JSON into SQL — payloads go through instruction trees
- Event store queries use named parameters

**Residual Risk:** Very low. No string concatenation in SQL queries anywhere in the runtime.

**Audit Evidence:**
- `packages/runtime/src/adapters/postgres-event-store.ts` — all queries use `pool.query(sql, params)`
- `packages/runtime/src/execution/state-registry.ts` — parameterized upsert

---

### THREAT CATEGORY 4: Constitutional Attacks

#### T4.1 — Invariant Bypass

**Description:** An attacker crafts commands or events that violate constitutional invariants (INV-001 through INV-010) without detection.

**Threat Actor:** Malicious Insider, External Attacker (if API reachable)

**Attack Vector:** Direct event store append, crafted command payload, registry manipulation.

**Current Mitigations:**
- GuardrailBus — intercepts commands before persistence, checks INV-001 and INV-002
- Instruction tree evaluation — declarative validation rules enforced at compile time
- State machine interpreter — invalid transitions rejected with 409
- INV-002 BALANCED_POSTINGS — enforced in validation registry
- Event envelope has 21 mandatory fields — missing fields rejected

**Residual Risk:** Medium. INV-003 through INV-010 are partially implemented. Full enforcement is on the v1.0.0 roadmap. The guardrail bus covers INV-001 and INV-002 only.

**Audit Evidence:**
- `packages/runtime/src/execution/guardrail-bus.ts` — INV-001/002 checks
- `generated/registries/validation.registry.json` — validation rules
- Purity audit: 0 violations in handwritten runtime code

---

#### T4.2 — Agent Authority Escalation

**Description:** A malicious AI agent creates, grants, or modifies financial authority in violation of INV-004 and INV-010.

**Threat Actor:** Malicious Insider (agent operator), Compromised Agent

**Attack Vector:** Agent sends commands with `actor_type: ai_agent` to grant capabilities, create assets, or modify governance.

**Current Mitigations:**
- INV-004: "No agent may create, grant, or modify financial authority"
- INV-010: "No autonomous agent may bypass constitutional enforcement"
- AgentSandbox — tracks financial quotas, LLM prompt audit, escalation at 90%
- GuardrailBus — checks `effects.emittedEvents` for capability.granted events from ai_agent
- Capability gate — agents cannot grant capabilities without governance authority

**Residual Risk:** Medium. Agent sandbox is generated as skeleton. Full wiring into execution path is in progress. An agent with a stolen governance capability grant could escalate.

**Audit Evidence:**
- `packages/runtime/src/sdk/agent-sandbox.ts` — quota tracking, escalation
- `packages/runtime/src/execution/index.ts` — GuardrailCommandBus INV-004 check
- `generated/registries/capabilities.registry.json` — agent capability definitions

---

#### T4.3 — Governance Capture

**Description:** A small group of governance actors colludes to amend the constitution or override protections for financial gain.

**Threat Actor:** Malicious Insider (governance role)

**Attack Vector:** Governance proposal to amend invariants, emergency halt abuse, capability wildcard grants.

**Current Mitigations:**
- Amendment process defined in `11_governance-amendments.yaml`
- Multi-sig requirement for constitutional amendments (in spec, not yet enforced)
- Emergency halt is logged and auditable
- Governance events are part of immutable event log

**Residual Risk:** Medium. Multi-sig governance enforcement is specified but not yet wired into runtime. A single governance actor with the right capability can currently initiate amendments.

**Audit Evidence:**
- `11_governance-amendments.yaml` — amendment process definition
- `generated/registries/commands.registry.json` — governance command definitions
- Event log: governance.proposal.submitted, governance.vote.cast

---

### THREAT CATEGORY 5: Infrastructure Attacks

#### T5.1 — PostgreSQL Direct Access

**Description:** An attacker gains direct access to the PostgreSQL instance and bypasses application-level controls.

**Threat Actor:** External Attacker, Malicious Insider (DBA)

**Attack Vector:** Exposed PostgreSQL port, weak password, compromised DBA credentials, cloud metadata access.

**Current Mitigations:**
- `sovr` database user has INSERT + SELECT only (no UPDATE/DELETE, no DDL)
- Immutability triggers on all tables
- Docker Compose binds PostgreSQL to internal network only
- `DATABASE_URL` required for PostgreSQL mode — no default credentials

**Residual Risk:** Medium. If the `sovr` user is compromised, triggers prevent data modification but not exfiltration. A PostgreSQL superuser can bypass all triggers.

**Audit Evidence:**
- `packages/runtime/src/adapters/postgres-event-store.ts` — `MIGRATION_SQL` GRANT pattern
- `deployment/docker-compose.dev.yml` — PostgreSQL configuration
- `docs/architecture/ADR-MULTI-NODE.md` — replication security

---

#### T5.2 — Key Exfiltration

**Description:** An attacker obtains JWT private keys from environment variables, logs, or process memory.

**Threat Actor:** External Attacker, Malicious Insider

**Attack Vector:** Environment variable dump (`/proc/self/environ`), log injection, memory dump, CI/CD secret exposure.

**Current Mitigations:**
- Keys loaded from env vars — never committed to git
- Production mode fails closed if keys are missing
- Ephemeral keys in development — invalid after restart
- Keys not logged (no `console.log(key)` in codebase)
- `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` required in production

**Residual Risk:** Medium. Environment variables are visible to any process with the same PID namespace. In containerized deployments, secrets should use Kubernetes secrets or Docker secrets, not plain env vars.

**Audit Evidence:**
- `packages/runtime/src/security/jwt.ts` — key loading from env
- `packages/runtime/src/server/config.ts` — `JWT_PRIVATE_KEY` validation
- `.env.example` — documented required secrets

---

#### T5.3 — Rail Adapter Compromise

**Description:** An attacker compromises an external rail adapter (ACH, FedNow, etc.) to inject fraudulent payment instructions or exfiltrate data.

**Threat Actor:** External Attacker, Nation-State

**Attack Vector:** Compromised adapter endpoint, MITM on adapter communication, malicious adapter implementation.

**Current Mitigations:**
- Circuit breaker — configurable threshold per rail; opens after N failures, stopping all calls
- Retry with exponential backoff — transient failures retried up to `maxRetries`
- Timeout — every rail call bounded by configurable `timeout` ms
- Adapter isolation — adapters cannot mutate constitutional state (INV-001/005)
- Credential validation at boot — only rails with valid credentials are registered
- Fail-silent registration — bad credentials skip, log, continue
- Rail isolation — failure in one rail does not affect others
- Payment events are auditable — every rail call emits pre/post/retry/circuit events
- TigerBeetle financial database — double-entry enforcement at storage layer (INV-002)

**Residual Risk:** Medium. Rail drivers are scaffold implementations for external providers. Production adapters would need TLS, mutual auth, adapter-level audit logs, and secrets-manager-backed credentials. Circuit breaker prevents cascade failures but not fraudulent instructions from a compromised adapter.

**Audit Evidence:**
- `packages/runtime/src/adapters/base/BaseRailDriver.ts` — circuit breaker, retry, audit, timeout
- `packages/runtime/src/adapters/RailDriverRegistry.ts` — credential-validated boot registration
- `packages/runtime/src/adapters/BoundaryEventBus.ts` — constitutional bridge from external events → CommandBus
- `packages/runtime/src/adapters/tigerbeetle/TigerBeetleDriver.ts` — financial database driver
- `hybrid-boundary.yaml` — declared rails

---

## 4. Residual Risk Summary

| Threat Category | Residual Risk | Key Gap |
|---|---|---|
| Protocol Manipulation | Low | Compiler dependency supply chain |
| Runtime Attacks | Low | Partial invariant enforcement (v1.0.0) |
| Data Attacks | Very Low | PostgreSQL superuser can bypass triggers |
| Constitutional Attacks | Medium | Agent sandbox not fully wired |
| Infrastructure Attacks | Medium | Key storage in env vars; adapter isolation not tested in production |

---

## 5. Audit Evidence Index

| Evidence | Location | Test |
|---|---|---|
| Build hash verification | `generated/compiler-manifest.yaml` | `node packages/compiler/dist/cli.js verify` |
| Boot attestation | `generated/boot-attestation.json` | `/api/v1/boot-attestation` |
| Immutability triggers | `postgres-event-store.ts` MIGRATION_SQL | `psql -c '\dx'` |
| JWT RS256 keys | `security/jwt.ts` | `/health` JWT mode |
| Rate limiting | `server/index.ts` FinancialRateLimiter | Load test |
| Capability enforcement | `kernel-executor.ts` capabilityCheck | Integration test |
| Agent sandbox | `sdk/agent-sandbox.ts` | Unit test |
| Circuit breaker | `adapters/circuit-breaker.ts` | Adapter test |

---

## 6. Review Schedule

This threat model must be reviewed:
- Before every major version release
- After any new attack surface is introduced
- After any external security finding
- Annually, minimum

**Next review:** v1.0.0 security audit preparation
