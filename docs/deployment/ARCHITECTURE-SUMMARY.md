# SOVR Protocol — Architecture Summary
**Version:** v1.0.0-rc
**Date:** 2026-07-25
**Classification:** External / Institution Restricted

---

## The Central Thesis

Every financial behavior executed by SOVR is derived exclusively from the constitutional YAML corpus through deterministic compiler generation.

No human writes financial logic at runtime. The constitution compiles it. The kernel executes it. The event store remembers it — immutably.

This is not a framework where developers write handlers. This is a compiler that generates a complete financial kernel from a YAML specification.

---

## System Architecture

```
YAML Constitution (source of truth)
    │
    ▼
SOVR Compiler v0.6.0 (deterministic, content-addressed)
    │   Input:  YAML corpus
    │   Output: Registry ABI v1 (JSON instruction trees)
    │   Hash:   b7d8221b... (content-addressed, byte-identical)
    ▼
Registry Package (sovr-runtime-abi-v1)
    ├── commands.registry.json      (105 commands)
    ├── machines.registry.json      (43 state machines)
    ├── validation.registry.json    (guard expressions)
    ├── events.registry.json        (259 event definitions)
    ├── capabilities.registry.json  (111 capability grants)
    ├── topology.registry.json      (10 domains)
    └── registry.manifest.json      (content hashes)
    │
    ▼
KernelExecutor (generic financial kernel)
    │   Zero domain knowledge
    │   Zero handwritten financial logic
    │   Pure registry execution
    │   Guard AST evaluation (VEL)
    │   State machine traversal
    │   Capability authorization
    │   Event emission
    ▼
Infrastructure Layer
    ├── PostgreSQL 16+     (tamper-evident event store)
    │   ├── sovr_events (19 columns, immutable trigger)
    │   └── sovr_aggregate_states (4 columns, immutable trigger)
    ├── RS256 JWT          (asymmetric authentication via jose v6.2)
    ├── @fastify/rate-limit v11 (global abuse prevention)
    ├── FinancialRateLimiter (financial command rate limiting)
    ├── Kafka (optional)   (external event streaming)
    └── Redis Streams (optional) (real-time event streaming)
```

**Ground truth:** `packages/compiler/` — compiler source.
**Ground truth:** `generated/registries/` — generated artifacts.
**Ground truth:** `packages/runtime/src/server/index.ts` — kernel executor.
**Ground truth:** `packages/runtime/src/adapters/postgres-event-store.ts` — PostgreSQL schema.

---

## Constitutional Proof (XV3-Escrow)

The escrow domain was added to the YAML constitution only. No TypeScript was written. The compiler generated all artifacts. The runtime executed them.

```
escrow.account.create   → ACCEPTED (INIT → CREATED)
escrow.account.fund     → ACCEPTED (CREATED → FUNDED)
escrow.account.release  → ACCEPTED (FUNDED → RELEASED)
escrow.account.reject   → ACCEPTED (CREATED → REJECTED)
```

**Purity audit: PASS — 0 violations.**

This is the proof. The kernel is constitutional.

**Ground truth:** `test/integration.test.ts` — "Constitutional Proof XV3 verified" in demo output.
**Ground truth:** `docs/reports/` — multiple verification audit reports.

---

## Data Flow

```
Client Request (JWT + command)
    │
    ▼
Fastify v5 HTTP Server
    │
    ▼
authFromBearer() → JWT verification (RS256)
    │
    ▼
identityContextFromReq() → actor_id, actor_type, session_id
    │
    ▼
Capability Check → scope pattern match against registry
    │
    ▼
CommandBus.submit() → StateMachine traversal
    │   Guard evaluation (VEL AST)
    │   State transition validation
    │   Invariant checking (INV-001..010)
    ▼
EventStore.append() → PostgreSQL INSERT (atomic)
    │   trigger: prevent UPDATE/DELETE
    ▼
Publisher.fire() → Kafka / Redis / WebSocket broadcast
    │
    ▼
ProjectionEngine.rebuild() → read model update
    │
    ▼
HTTP Response (ACCEPTED | REJECTED)
```

**Ground truth:** `packages/runtime/src/server/index.ts` lines 711-766 — universal route handler.
**Ground truth:** `packages/runtime/src/execution/` — CommandBus, StateMachine, EventStore.

---

## Invariants

| ID | Rule | Enforcement |
|---|---|---|
| INV-001 | Event log is immutable | PostgreSQL trigger |
| INV-002 | Double-entry bookkeeping (debits = credits) | Guard AST evaluation |
| INV-003 | Capability required for all commands | CapabilityEngine |
| INV-004 | ai_agent excluded from governance | Actor type check |
| INV-005 | All events carry constitutional rules referenced | Envelope builder |
| INV-006 | Event log is source of truth | Projection rebuild from genesis |
| INV-007 | State machines enforce valid transitions | StateMachine traversal |
| INV-008 | Identity context required on all events | Envelope builder |
| INV-009 | Correlation IDs chain all events | Causation tracking |
| INV-010 | Build hash verified at boot | Boot attestation |

**Ground truth:** `packages/runtime/src/server/index.ts` line 107 — "10 invariants INV-001..010".

---

## Technology Stack

| Layer | Technology | Version | Verified |
|---|---|---|---|
| Runtime | Fastify v5 | 5.10.0 | ✅ 2026-07-25 |
| CORS | @fastify/cors | 10.1.0 | ✅ 2026-07-25 |
| Rate Limiting | @fastify/rate-limit | 11.1.0 | ✅ 2026-07-25 |
| WebSocket | @fastify/websocket | 11.3.0 | ✅ 2026-07-25 |
| Auth | jose (RS256 JWT) | 6.2.4 | ✅ 2026-07-25 |
| Event Store | pg (PostgreSQL) | 8.22.0 | ✅ 2026-07-25 |
| Validation | zod | 3.22.0 | ✅ 2026-07-25 |
| Messaging | kafkajs | 2.2.4 | ✅ 2026-07-25 |
| Cache/Streams | ioredis | 5.0.0 | ✅ 2026-07-25 |
| Testing | vitest | 2.1.9 | ✅ 2026-07-25 |
| TypeScript | typescript | 5.0.0 | ✅ 2026-07-25 |
| DB (production) | PostgreSQL | 16+ | ✅ docker-compose |

---

## Trust Model

```
Source of Truth: YAML Constitution
    ↓ (deterministic compilation)
Verification: Content-addressed build hash (SHA-256)
    ↓ (verified at boot)
Execution: Registry-driven kernel (zero handwritten logic)
    ↓ (immutable storage)
Audit Trail: PostgreSQL with UPDATE/DELETE triggers
    ↓ (content-addressed)
Proof: Boot attestation chain (build_hash → boot_hash)
```

**Trust assumptions:**
1. YAML corpus is controlled by institution (git-committed, reviewed)
2. Compiler is deterministic (byte-identical reproducibility, R1-R10)
3. PostgreSQL is administered by institution (immutable triggers, encrypted backups)
4. RS256 keys are managed by institution (secrets manager, 90-day rotation)
5. Infrastructure is institution-controlled (network segmentation, TLS termination)

**Ground truth:** `docs/architecture/README.md` — architecture documentation.
**Ground truth:** `docs/formal-verification/tla-coverage.md` — formal verification of invariants.

---

## Release History

| Version | Milestone | Verified |
|---|---|---|
| v0.2.0 | Compiler + basic runtime | ✅ |
| v0.3.0 | CommandBus → StateMachine → EventStore | ✅ |
| v0.4.0 | Atomic commit + 101-command coverage | ✅ |
| v0.5.0 | Saga layer + shared VEL parser | ✅ |
| v0.6.0 | Constitutional Kernel — handlers.ts deleted | ✅ |
| v0.7.0 | Production Infrastructure — PostgreSQL, RS256, rate limiting | ✅ |
| v0.8.0 | Identity (W3C DID/VC) + TLA+ formal verification | ✅ |
| v0.6.0 | Security + Compliance — threat model, SOC2, GDPR | ✅ |
| v1.0.0 | External audit complete — **TARGET** | ⏳ |

**Current state:** v1.0.0 FROZEN (constitutional spec), Runtime v0.6.0, Compiler v0.6.0.
**Build hash:** b7d8221b0d7359a7733791d00cf32622df7b707ff4171c0c1b541d91d7568492

---

## What an Auditor Sees

1. **No handwritten financial logic** — all behavior from YAML constitution
2. **Content-addressed artifacts** — any change changes the build hash
3. **Immutable audit trail** — PostgreSQL triggers prevent tampering
4. **Asymmetric authentication** — RS256 JWT, no shared secrets
5. **Capability-based authorization** — 111 scoped capability definitions
6. **Tested at every layer** — 16/16 integration tests, 13/13 demo, 0 purity violations
7. **Formally verified** — TLA+ invariants covering state machine correctness
8. **Clean supply chain** — 0 HIGH/0 CRITICAL in production dependencies
