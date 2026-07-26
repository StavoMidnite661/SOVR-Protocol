# SOVR Protocol — Security Surface Inventory

**Generated:** 2026-07-25T03:11:13-07:00  
**Build Hash:** `d27fdbe60290ba976f684bb7d0096b911195776d975bb1da8bdd6c56d835e512`  
**Protocol Version:** v1.0.0 (FROZEN)  

---

## Purpose

This document inventories all security-relevant surfaces in the SOVR Protocol. Each surface is analyzed for trust boundaries, attack vectors, mitigations, and remaining risk.

**Methodology:**
- Static analysis of source code
- Review of authentication/authorization implementations
- Review of infrastructure configuration
- Review of dependency security posture

---

## Security Surfaces

### 1. REST API

| Property | Value |
|---|---|
| **Location** | `packages/runtime/src/server/index.ts` |
| **Framework** | Fastify v5 |
| **Port** | 3001 (configurable) |
| **TLS** | Not enforced in reference implementation |
| **Authentication** | JWT RS256 bearer token |
| **Authorization** | Capability gate + policy evaluation |

**Trust Boundary:** External clients → Fastify HTTP server

**Attack Surface:**
- Unauthenticated endpoint access
- JWT token forgery
- Capability bypass
- Rate limit bypass
- HTTP method tampering
- Header injection

**Mitigations:**
- All endpoints require JWT bearer token (except `/health`, `/api/v1/manifest`, `/api/v1/boot-attestation`)
- RS256 asymmetric JWT (algorithm confusion blocked)
- Pre-execution capability gate
- Identity-sovereign rate limiting (`@fastify/rate-limit v11`)
- CORS configured (`@fastify/cors v10`)
- Input validation via JSON schema

**Remaining Risk:** TLS not enforced in reference implementation. Production deployment must terminate TLS at load balancer.

---

### 2. JWT Authentication

| Property | Value |
|---|---|
| **Location** | `packages/runtime/src/server/jwt.ts`, `packages/runtime/src/security/jwt.ts` |
| **Library** | `jose v6.2` |
| **Algorithm** | RS256 (asymmetric) |
| **Key Management** | File-based (dev), environment variables (prod) |

**Trust Boundary:** Client → Server (token transmission)

**Attack Surface:**
- Algorithm confusion (HS256/RS256)
- Token forgery
- Expired token replay
- Key material exposure
- Token leakage in logs

**Mitigations:**
- RS256 only — HS256 explicitly rejected
- `jose` library enforces algorithm validation
- Expired tokens rejected (403)
- Missing/invalid tokens rejected (403)
- Private key never transmitted
- JWT secret not logged

**Remaining Risk:** Key rotation not automated. Key material stored in environment variables — production requires secrets manager (HashiCorp Vault, AWS Secrets Manager).

---

### 3. Identity System

| Property | Value |
|---|---|
| **Location** | `packages/runtime/src/identity/did-service.ts`, `packages/runtime/src/server/jwt.ts` |
| **Standard** | DID (decentralized identifier) — not yet W3C-compliant |
| **Actor Types** | human, organization, ai_agent, service_account, governance, external_system |
| **Trust Levels** | NONE, LOW, MEDIUM, HIGH, SOVEREIGN |

**Trust Boundary:** Identity provider → SOVR runtime

**Attack Surface:**
- Identity spoofing
- Delegation chain abuse
- Trust level escalation
- Session fixation

**Mitigations:**
- JWT-verified identity context (not raw headers)
- Delegation depth limited to 2 levels
- Trust level validated at registration
- Session IDs cryptographically random

**Remaining Risk:** Identity not backed by persistent registry (in-memory only). Not W3C DID/VC compliant. Production requires persistent identity store.

---

### 4. Compiler Security

| Property | Value |
|---|---|
| **Location** | `packages/compiler/` |
| **Input** | YAML constitutional specification |
| **Output** | Generated artifacts + compiler certification |
| **Determinism** | Byte-identical (R1–R10) |

**Trust Boundary:** YAML input → Compiler → Generated output

**Attack Surface:**
- YAML injection (malicious spec)
- Compiler supply chain attack
- Non-deterministic output (build tampering)
- Pass runner bypass

**Mitigations:**
- Closed frontier — only declared inputs read (R1)
- Sorted lists — deterministic ordering (R2)
- No randomness during compilation (R4)
- No environment leakage (R5)
- Fail-closed on errors (ERROR/FATAL halt)
- 20-pass DAG with dependency enforcement
- Build hash serves as tamper evidence

**Remaining Risk:** Compiler not yet audited. Pass runner bodies partially delegate to v0.2 stages. Full certification pending v1.0.0.

---

### 5. Package Loader

| Property | Value |
|---|---|
| **Location** | `packages/compiler/src/utils/yaml-loader.ts` |
| **Mechanism** | File system read |
| **Validation** | YAML schema validation |

**Trust Boundary:** File system → Compiler

**Attack Surface:**
- Path traversal
- Malicious YAML content
- Symlink attacks

**Mitigations:**
- Path validation against declared inputs
- YAML schema validation
- No dynamic `require()` or `import()`
- Closed frontier (R1)

**Remaining Risk:** File system permissions not enforced. Production deployment must restrict compiler working directory.

---

### 6. Registry Verification

| Property | Value |
|---|---|
| **Location** | `packages/compiler/src/generators/registries.ts` |
| **Mechanism** | SHA-256 hash over canonical JSON |
| **Verification** | Runtime boot attestation chain |

**Trust Boundary:** Compiler output → Runtime consumption

**Attack Surface:**
- Registry tampering
- Manifest substitution
- Hash collision (theoretical)

**Mitigations:**
- SHA-256 over canonical JSON (collision-resistant)
- Boot attestation chain verification
- Registry package hash in manifest
- Runtime verifies manifest.build_hash === attestation.build_hash

**Remaining Risk:** SHA-256 only. Quantum-resistant hashing not implemented (not required for v1.0.0).

---

### 7. Filesystem

| Property | Value |
|---|---|
| **Event Store** | JSON file (CI/dev), PostgreSQL (production) |
| **Generated Artifacts** | `generated/` directory |
| **Working Directory** | Protocol root |

**Trust Boundary:** Operating system → SOVR process

**Attack Surface:**
- Event log tampering (JSON file)
- Artifact substitution
- Directory traversal
- Symlink attacks

**Mitigations:**
- PostgreSQL immutable triggers (production)
- In-process event store exposes no mutation API
- File system permissions (OS-level)
- Build hash verification on boot

**Remaining Risk:** JSON file mode is mutable at filesystem level. Production must use PostgreSQL.

---

### 8. Docker

| Property | Value |
|---|---|
| **Configs** | `deployment/docker-compose*.yml` |
| **Base Image** | Node.js 20 |
| **User** | Not specified (runs as root) |

**Trust Boundary:** Docker host → Container

**Attack Surface:**
- Privilege escalation (root user)
- Volume mount tampering
- Network exposure
- Image supply chain

**Mitigations:**
- Minimal base image (Node.js Alpine)
- No secrets in image
- Environment variables for configuration
- Network segmentation via docker-compose

**Remaining Risk:** Container runs as root. Production must specify non-root user. Image signing not implemented.

---

### 9. Build Pipeline

| Property | Value |
|---|---|
| **CI/CD** | `.github/workflows/ci*.yml` |
| **Steps** | Install, compile, test, verify |
| **Secrets** | GitHub Actions secrets |

**Trust Boundary:** GitHub → Build artifacts

**Attack Surface:**
- CI/CD injection
- Secret leakage
- Artifact tampering
- Dependency confusion

**Mitigations:**
- GitHub Actions sandboxed environment
- Secrets stored in GitHub Secrets (encrypted)
- Build hash verification in CI
- Lockfile committed to repository
- `npm audit` in CI (not yet implemented)

**Remaining Risk:** No SLSA provenance. No signed artifacts. Production requires signed releases.

---

### 10. Environment Variables

| Property | Value |
|---|---|
| **Configuration** | `.env.example`, `config.ts` |
| **Sensitive** | JWT keys, database credentials, Kafka/Redis URLs |

**Trust Boundary:** Environment → Application

**Attack Surface:**
- Secret leakage in logs
- Environment variable injection
- Default credential usage

**Mitigations:**
- `.env` in `.gitignore`
- Environment validation on startup
- Fail-closed if required secrets missing
- No secrets in documentation

**Remaining Risk:** No secrets manager integration. Production requires HashiCorp Vault or equivalent.

---

### 11. Secrets Management

| Property | Value |
|---|---|
| **Current** | Environment variables |
| **Production Required** | HashiCorp Vault, AWS Secrets Manager, Azure Key Vault |

**Trust Boundary:** Secrets store → Application

**Attack Surface:**
- Secret exposure in process memory
- Secret leakage in logs
- Unauthorized access to secrets store

**Mitigations:**
- Secrets loaded at startup only
- Secrets not logged
- JWT private key never transmitted

**Remaining Risk:** No secrets manager in reference implementation. Production requires external secrets management.

---

### 12. External Adapters

| Property | Value |
|---|---|
| **Rail Driver Framework** | `packages/runtime/src/adapters/` — `BaseRailDriver`, `RailDriverRegistry`, `BoundaryEventBus`, plus 12 rail drivers |
| **Financial Database** | TigerBeetle (`TigerBeetleDriver`, `TigerBeetleAccountManager`, `TigerBeetleTransferBuilder`) |
| **Private Ledger** | `SovrLedgerDriver` — native kernel path |
| **ACH** | `AchDriver` — 3 providers (Dwolla, Modern Treasury, Column) |
| **FedNow** | `FedNowDriver` — ISO 20022 scaffold |
| **Fedwire** | `FedwireDriver` — operating-hours scaffold |
| **RTP** | `RtpDriver` — TCH scaffold |
| **Card Networks** | `CardNetworkDriver` — Marqeta/Stripe/Lithic scaffold |
| **Blockchain (EVM)** | `EvmDriver` — ethers.js/viem hook scaffold |
| **Stablecoin** | `StablecoinDriver` — Circle API wired |
| **SWIFT** | `SwiftDriver` — SWIFT gpi scaffold |
| **SEPA** | `SepaDriver` — IBAN/pain.001 scaffold |
| **Price Oracle** | `PriceOracleDriver` — READ-ONLY scaffold (Chainlink/Band/internal) |

**Trust Boundary:** SOVR → External system

**Attack Surface:**
- Adapter compromise
- Data exfiltration
- Replay attacks
- Man-in-the-middle
- Credential leakage at boot

**Mitigations:**
- All adapters emit events only — cannot mutate constitutional state (INV-001/INV-005)
- Circuit breaker + retry + timeout enforced at `BaseRailDriver`
- Credential validation at boot — only valid rails registered
- Fail-silent registration — bad credentials skip, log, continue
- Rail isolation — failure in one rail does not affect others
- TigerBeetle provides double-entry enforcement at storage layer (INV-002)
- TLS for external connections (production)
- Event envelope includes timestamp and causation chain

**Remaining Risk:** Rail drivers are scaffold implementations for external providers. Production adapters require TLS, mutual authentication, audit logging, and secrets-manager-backed credentials.

---

### 13. Kafka

| Property | Value |
|---|---|
| **Client** | `kafkajs v2.2` |
| **Purpose** | Event publication (non-authoritative) |
| **Configuration** | `generated/config/kafka/topics.yaml` |

**Trust Boundary:** SOVR → Kafka cluster

**Attack Surface:**
- Event tampering in transit
- Unauthorized topic access
- Consumer group hijacking

**Mitigations:**
- Events are non-authoritative (event log is source of truth)
- Kafka ACLs (production)
- TLS for broker communication (production)
- Event envelope includes signature (future)

**Remaining Risk:** Kafka not running in reference implementation. Production requires ACLs, TLS, and monitoring.

---

### 14. Redis

| Property | Value |
|---|---|
| **Client** | `ioredis v5.3` |
| **Purpose** | Stream publishing (non-authoritative), rate limiting |
| **Configuration** | `generated/config/redis/streams.yaml` |

**Trust Boundary:** SOVR → Redis instance

**Attack Surface:**
- Stream tampering
- Rate limit bypass
- Memory exhaustion

**Mitigations:**
- Redis streams are non-authoritative
- Rate limiting enforced at application layer
- Memory limits configured (production)
- AUTH configured (production)

**Remaining Risk:** Redis not running in reference implementation. Production requires AUTH, TLS, and memory limits.

---

### 15. PostgreSQL

| Property | Value |
|---|---|
| **Client** | `pg v8.11` |
| **Purpose** | Durable event store (production) |
| **Migrations** | `migrations/001_create_sovr_events.sql`, `002_create_sovr_aggregate_states.sql`, `003_create_did_documents.sql` |

**Trust Boundary:** SOVR → PostgreSQL instance

**Attack Surface:**
- SQL injection
- Data exfiltration
- Unauthorized access
- Event log tampering

**Mitigations:**
- Parameterized queries (pg library)
- Immutable triggers (UPDATE/DELETE blocked)
- Connection pooling
- Database-level authentication
- Event envelope includes actor_id, timestamp

**Remaining Risk:** PostgreSQL not running in reference implementation. Production requires TLS, connection pooling, backup/restore, and monitoring.

---

### 16. OpenAPI

| Property | Value |
|---|---|
| **Spec** | `generated/openapi.yaml` |
| **Version** | 3.1.0 |
| **Generated** | Yes (compiler output) |

**Trust Boundary:** Client → API documentation

**Attack Surface:**
- Outdated documentation
- Schema poisoning
- Information disclosure

**Mitigations:**
- OpenAPI spec generated from canonical IR
- Spec versioned with build hash
- No sensitive data in spec

**Remaining Risk:** Spec is reference-only. Production API gateway should enforce rate limiting, authentication, and authorization at edge.

---

### 17. GitHub Actions

| Property | Value |
|---|---|
| **Workflows** | `.github/workflows/ci.yml`, `ci-production.yml`, `formal-verify.yml` |
| **Triggers** | Push, pull_request |
| **Permissions** | Read/Write (contents) |

**Trust Boundary:** GitHub → CI/CD pipeline

**Attack Surface:**
- Workflow injection
- Secret leakage
- Artifact tampering

**Mitigations:**
- GitHub Actions sandboxed environment
- Secrets stored in GitHub Secrets
- Workflow files reviewed via PR
- Minimal permissions

**Remaining Risk:** No signed commits. No SLSA provenance. Production requires signed releases and provenance generation.

---

## Security Posture Summary

| Surface | Risk Level | Status |
|---|---|---|
| REST API | Medium | 🔧 Partial — TLS not enforced |
| JWT Authentication | Low | ✅ RS256 enforced |
| Identity System | Medium | 🔧 Partial — not persistent |
| Compiler | Low | ✅ Deterministic, fail-closed |
| Package Loader | Low | ✅ Closed frontier |
| Registry Verification | Low | ✅ SHA-256 chain |
| Filesystem | Medium | 🔧 Partial — JSON mutable |
| Docker | Medium | 🔧 Partial — root user |
| Build Pipeline | Medium | 🔧 Partial — no provenance |
| Environment Variables | Medium | 🔧 Partial — no secrets manager |
| Secrets Management | High | 🔧 Partial — env vars only |
| External Adapters | Medium | 🔧 Partial — mock only |
| Kafka | Low | 📋 Not implemented |
| Redis | Low | 📋 Not implemented |
| PostgreSQL | Low | 📋 Not running |
| OpenAPI | Low | ✅ Generated from IR |
| GitHub Actions | Medium | 🔧 Partial — no provenance |

**Overall Security Posture:** 🔧 PARTIAL — Reference implementation. Production hardening required before financial transaction processing.

---

## Critical Findings

| Finding | Severity | Status |
|---|---|---|
| SOVR-SEC-001: Rate limiter keyed on raw header | HIGH | ✅ REMEDIATED |
| No TLS enforcement | MEDIUM | 🔧 Production requirement |
| No secrets manager | HIGH | 🔧 Production requirement |
| Identity not persistent | MEDIUM | 🔧 Production requirement |
| JSON event store mutable | MEDIUM | 🔧 PostgreSQL required for production |
| Container runs as root | MEDIUM | 🔧 Production requirement |
| No signed releases | MEDIUM | 🔧 Production requirement |

---

*Security surface inventory generated from static analysis. All findings verified against source code and configuration.*
