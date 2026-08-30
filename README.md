<div align="center">

# SOVR Protocol

### The Linux of Finance — a spec-first, constitutionally governed financial protocol kernel

```text
YAML is the protocol source of truth.
The compiler is the only materialization path.
Generated registries are compiled authority.
The runtime loads registries. It does not parse YAML.
```

[![CI](https://github.com/StavoMidnite661/SOVR-Protocol/actions/workflows/ci.yml/badge.svg)](https://github.com/StavoMidnite661/SOVR-Protocol/actions/workflows/ci.yml)
[![Production CI](https://github.com/StavoMidnite661/SOVR-Protocol/actions/workflows/ci-production.yml/badge.svg)](https://github.com/StavoMidnite661/SOVR-Protocol/actions/workflows/ci-production.yml)
[![Formal Verification](https://github.com/StavoMidnite661/SOVR-Protocol/actions/workflows/formal-verify.yml/badge.svg)](https://github.com/StavoMidnite661/SOVR-Protocol/actions/workflows/formal-verify.yml)
[![Runtime](https://img.shields.io/badge/runtime-0.6.0-2e7d32)](https://github.com/StavoMidnite661/SOVR-Protocol)
[![Protocol Spec](https://img.shields.io/badge/protocol-1.0.0-6f42c1?labelColor=333)](00_protocol-manifest.yaml)
[![Registry ABI](https://img.shields.io/badge/registry%20ABI-v1-9a6700)](generated/registries/registry.manifest.json)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-3c873a)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-Proprietary-d43f3a)](#license)

</div>

---

**SOVR Financial OS** is a programmable, reserve-backed, trust-governed financial
infrastructure layer combining vault-based custody, programmable credit rails,
tokenized value representation, real-time payment orchestration, AI-driven
financial agents, policy-controlled execution, and auditable financial state
machines.

The entire protocol — commands, events, state machines, capabilities,
projections, sagas, constitutional invariants — is specified as a **frozen YAML
corpus**. A deterministic, fail-closed **compiler** turns that corpus into
canonical IR and a set of signed, content-hashed **registries**. The **runtime**
kernel boots from those registries and executes *only* what was compiled —
nothing is hand-wired, nothing is interpreted at execution time, and nothing
silently disappears.

---

## Table of Contents

- [Table of Contents](#table-of-contents)
- [The Four Rules of Authority](#the-four-rules-of-authority)
- [Architecture](#architecture)
- [Live Compiled Authority](#live-compiled-authority)
- [Key Features](#key-features)
- [Repository Layout](#repository-layout)
- [The Protocol Corpus](#the-protocol-corpus)
- [The Compiler](#the-compiler)
- [The Runtime](#the-runtime)
- [API Surface](#api-surface)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Testing & Certification](#testing--certification)
- [Formal Verification (TLA+)](#formal-verification-tla)
- [CI / CD](#ci--cd)
- [Deployment](#deployment)
- [Governance & Amendments](#governance--amendments)
- [Versioning](#versioning)
- [Documentation Map](#documentation-map)
- [Contributing](#contributing)
- [Historical Material](#historical-material)
- [License](#license)

---

## The Four Rules of Authority

| # | Rule | Consequence |
|---|------|-------------|
| 1 | **YAML is the protocol source of truth.** | Humans edit YAML. If it is not in the corpus, it is not protocol. |
| 2 | **The compiler is the only materialization path.** | Fail-closed, deterministic. No silent drops. After any YAML change, recompile. |
| 3 | **Generated registries are compiled authority.** | Never hand-edit `generated/registries/*` or any compiler output. |
| 4 | **The runtime loads registries — it does not parse YAML.** | Execution-time authority is the integrity-checked registry, loaded through the authority-loader. |

Documentation is written **from** the implementation (YAML + compiler +
registries). Documentation does not drive the architecture.

---

## Architecture

```text
YAML protocol corpus
      ↓
discovery / parsing
      ↓
compiler passes
      ↓
canonical IR  (generated/sovr-ir.json)
      ↓
generated registries / artifacts
      ↓
authority-loader  (integrity-checked)
      ↓
runtime kernel
      ↓
event store / state machines / projections
      ↓
ledger adapters / external systems
```

### Authority model

| Layer | Role | Rule |
| --- | --- | --- |
| YAML corpus | Protocol source of truth | If it is not in the corpus, it is not protocol. |
| Compiler | Only materialization path | Fail-closed. No silent drops. Deterministic (rules R1–R10). |
| Canonical IR | `generated/sovr-ir.json` | Content-addressed intermediate form (663 nodes, 516 edges). |
| Generated registries | Compiled authority | Never hand-edit. Hashed per file + whole-build. |
| Runtime | Executes compiled authority | Loads registries via `authority-loader`. Never parses or reinterprets YAML. |

### Kernel execution flow

Every command that reaches the runtime passes through the same fail-closed
pipeline:

1. **Accept** a command — it must exist in the compiled, authoritative command
   catalog (118 commands).
2. **Gate** — identity, capability, and constitutional checks
   (fail-closed; unauthorized commands are rejected, not downgraded).
3. **Execute** the compiled state machine — transitions are *event-triggered*
   only (REF-008). Prose or command-name triggers do not exist in the compiled
   output.
4. **Append** resulting events to the event store (invariant INV-001).
5. **Project** — materialize read models from the projection registry
   (registry-driven, including compiled targets such as `vault_asset_view`).

### Ledger & rail adapters

The runtime ships adapters under `packages/runtime/src/adapters/` for the
payment rails and value backends the protocol orchestrates:

| Adapter | Purpose |
| --- | --- |
| `tigerbeetle` | TigerBeetle double-entry financial database (genesis, shadow execution, replay) |
| `ach` | ACH transfers (mock sandbox bank in dev; Dwolla credentials in prod) |
| `fednow` | FedNow instant payments |
| `wire` | Fedwire / wire transfers |
| `rtp` | RTP (Real-Time Payments) |
| `sepa` | SEPA transfers (IBAN-based) |
| `swift` | SWIFT messaging |
| `card` | Card networks (Marqeta) |
| `blockchain` / `stablecoin` | EVM chains, USDC via Circle |
| `oracle` | Price oracle (internal or external) |
| `private-ledger`, `base` | Internal ledger & adapter base classes |

Adapters are **execution boundaries**, not protocol sources of truth — the
protocol is defined entirely by the corpus.

---

## Live Compiled Authority

The following figures are read from the checked-in compiled artifacts
(`generated/registries/registry.manifest.json`,
`generated/compiler-certification.json`, `generated/sovr-ir.json`). Do not
trust prose counts in prose — recompile and read the manifests.

| Artifact | Count |
| --- | --- |
| Commands (authoritative catalog) | **118** |
| Events | **292** |
| State machines | **47** |
| Capabilities | **127** |
| Projections | **57** |
| Schemas | 410 |
| Validation plans | 118 |
| Economic registry entries | 170 |
| Reserve registry entries | 28 |
| Settlement registry entries | 23 |
| Canonical IR | **663 nodes, 516 edges** |

| Identity | Value |
| --- | --- |
| Build hash (whole compile) | `d1829636f3c630b476766ef2cd80f426857cc1044476fe1192aff54de724812a` |
| Canonical IR hash | `16c3f8b8a6352d35acc5f449b1a00251763341a6ec1ea12e680ded6a23381d6e` |
| Constitution lock hash (R3: NFC, LF) | `34dfbdc2de193f54f87bb873039603bb5a5502a8448ef6151133f54c77a54ed3` |
| Registry ABI | `v1` |
| Compiler version | `0.6.0` |
| Runtime version | `0.6.0` |
| Protocol spec version | `1.0.0` (**frozen / constitutional**) |

**Determinism proof (live):** `compiler-certification.json` records two
independent compilations of the same corpus — 173 artifacts compared,
**0 differences**, identical build hash. The compile is wall-clock-free
(`generatedWithoutWallClock: true`).

**Enforced now (fail-closed in validator / IR builder):**

- Commands must live in the authoritative `commands:` map of
  `03_command-catalog.yaml` — definitions outside that map fail the build
  (AMD-0005 class).
- **REF-006** — domain-file command definitions absent from the authoritative
  map are reported by the authority audit.
- **REF-008** — every state-machine transition `trigger` must resolve to a
  catalog event. Prose / command-name triggers fail the build. `emitted_events`
  must resolve likewise.
- Unresolved machine→command and command→event references are **errors**, not
  warnings.

---

## Key Features

-  **Constitutional layering (L0–L7).** A frozen constitution with a
  content lock hash; constitutional compliance is a compile-stage gate, and
  violations are runtime violations.
- 🔒 **Fail-closed execution.** Identity gates, a capability engine, and
  constitutional checks reject rather than degrade. `SOVR_DEV_AUTO_GRANT=true`
  is a development-only escape hatch; production must run `false`
  (INV-003/004).
- 🖥️ **Deterministic compilation.** Same corpus ⇒ byte-identical artifacts,
  proven by double-compile certification on every build.
- 🧾 **Full audit lineage.** Every command carries a correlation id with a
  reconstructable audit trail (`GET /api/v1/audit/:correlation_id`).
- ⏱️ **Reserve-backed economic model.** Economic, reserve, and settlement
  registries (170 / 28 / 23 entries) with lineage verification and proof
  suites.
-  **Saga orchestration.** Compiled execution plans with confirm/compensate
  semantics per payment rail (`/api/v1/payment/rail/:railType/prepare|execute|confirm|compensate`).
- 🤖 **AI financial agents with policy guardrails.** Agent domain with intent
  engine, planner, executor, memory, and a policy interface — every action
  still passes the same gates as any other command.
- 📡 **Event-sourced core.** JSON-file or PostgreSQL event store, optional
  Kafka topic fan-out (`sovr.{domain}.{aggregate}.{event}`) and Redis stream
  mirroring (`sovr:stream:{domain}:{aggregate}`).
- 🔐 **RS256 JWT identity.** Asymmetric, ≥2048-bit RSA credential/session
  endpoints; DID and credential verification endpoints.
- 🧪 **23 simulation suites + live-server integration.** Registry integrity,
  capability boundaries, unauthorized-command rejection, replay stress,
  projection reconstruction, economic validators, settlement proofs.
- 📐 **TLA+ formal verification.** Generated TLA+ specs for the critical
  state machines, model-checked with TLC.
-  **Deployable everywhere.** Docker, docker-compose (dev/production), Helm,
  Kubernetes manifests, Terraform (GCP/Azure), and an enterprise
  compose + haproxy/nginx bundle.

---

## Repository Layout

```text
SOVR-Protocol/
├── 00_protocol-manifest.yaml        # Protocol entry point (L0, FROZEN)
├── 01_constitution.yaml             # Supreme law (L0, LOCKED, hash-pinned)
├── 02_domain-model.yaml             # Aggregates, domains, entities
├── 03_command-catalog.yaml          # Authoritative command map (118)
├── 04_event-catalog.yaml            # Event catalog (292)
├── 05_state-machines.yaml           # State machines (47), event-bound triggers
├── 08_security-capabilities.yaml    # Capabilities (127)
├── 09_saga-orchestration.yaml       # Saga / execution-plan definitions
├── 11_governance-amendments.yaml    # Ratified amendments (AMD-…)
├── 12_domain-contracts.yaml         # Cross-domain contracts
├── 13_compiler-adr.yaml             # Compiler architectural decisions
├── compiler.yaml                    # Compiler configuration
├── hybrid-boundary.yaml             # Hybrid (managed/unmanaged) boundary
├── projection-engine.yaml           # Projection engine specification
├── acceptance-tests.yaml            # Protocol acceptance criteria
├── phase_j_protocol_closure.yaml    # Phase J closure criteria
├── VERSION_AUTHORITY.yaml           # Single source of truth for all versions
│
├── domains/                         # Per-domain corpus files (15 domains)
├── compiler/                        # Compiler metadata (pass/generator/error registries…)
├── protocol/                        # Cross-cutting protocol standards
│                                    #   (acceptance, aggregates, boot sequence,
│                                    #    authority model, domain registry…)
├── containers/                      # Container-scoped status/spec dirs
│                                    #   (kernel, ledger, vault, payment, …)
├── governance/                      # Amendments, backlog, simulation scenarios,
│                                    #   evidence, releases
├── knowledge/                       # Ontology, identity registry, evidence &
│                                    #   trace graphs, provenance standards
│
├── packages/
│   ├── shared/                      # @sovr/shared
│   ├── compiler/                    # @sovr/compiler — deterministic compiler
│   └── runtime/                     # @sovr/runtime — kernel, adapters, projections
│
├── generated/                       # ⚠️ COMPILED OUTPUT — DO NOT EDIT
│   ├── sovr-ir.json                 # Canonical IR (663 nodes / 516 edges)
│   ├── registries/                  # 16 hashed registry files + manifest
│   ├── compiler-manifest.yaml       # Build identity
│   ├── compiler-certification.json  # Determinism proof + input hashes
│   ├── openapi.json                 # Compiled API spec
│   ├── prisma/  typescript/  src/   # Generated persistence / types / code
│   ├── simulation/                  # Compiled simulation corpora
│   ├── verification/tla/            # TLA+ specs for critical machines
│   └── protocol-topology.json       # Compiled dependency topology
│
├── scripts/                         # setup, demo, certify, audit, keygen, …
├── deployment/                      # Dockerfile + compose (dev / production)
├── deploy/                          # enterprise compose, Helm, k8s, Terraform
├── migrations/  snapshots/  audit/  # Persistence migrations & audit artifacts
├── docs/                            # Current-architecture docs + generated refs
│   ├── ARCHITECTURE.md              # Implementation truth (read this first)
│   ├── DEVELOPMENT.md               # Operating & extending guide
│   ├── DOCUMENTATION.md             # Documentation policy
│   ├── generated/                   # Compiler-emitted reference (not counts authority)
│   └── history/                     # Forensic / remediation records (HISTORICAL)
│
├── .github/workflows/               # ci.yml, ci-production.yml, formal-verify.yml
├── example-frontend/                # Reference frontend
├── sovr-board.html                  # Operational board page
├── .env.example                     # Full production environment template
├── CHANGELOG.md                     # Keep a Changelog — phase narratives
└── package.json                     # npm workspaces root (Node ≥ 20, ESM)
```

---

## The Protocol Corpus

The corpus is the *only* thing humans edit. Files are organized into four
dependency layers (L0–L7); a file in layer N may only reference files in
layers 0..N.

### Root protocol inputs (all compiled)

| File | Status | Role |
| --- | --- | --- |
| `00_protocol-manifest.yaml` | **FROZEN (L0)** | Protocol identity, dependency graph, domain map, validation pipeline. Entry point. |
| `01_constitution.yaml` | **FROZEN (L0)** | Supreme law: invariants, gates, constitutional compliance rules. Hash-locked. |
| `02_domain-model.yaml` | FROZEN | Aggregates, entities, domain model. |
| `03_command-catalog.yaml` | FROZEN | The **authoritative command map** — the only place commands may exist. |
| `04_event-catalog.yaml` | FROZEN | Event definitions; every machine trigger must resolve here. |
| `05_state-machines.yaml` | FROZEN | 47 state machines with event-bound transitions. |
| `08_security-capabilities.yaml` | FROZEN | Capability model (127 capabilities). |
| `09_saga-orchestration.yaml` | FROZEN | Saga orchestration / execution plans. |
| `11_governance-amendments.yaml` | FROZEN | Ratified amendments (e.g. AMD-0005 commercial commands). |
| `12_domain-contracts.yaml` | FROZEN | Cross-domain contracts (2 compiled entries). |
| `13_compiler-adr.yaml` | FROZEN | Compiler architectural decision records. |
| `compiler.yaml` | — | Compiler configuration. |
| `hybrid-boundary.yaml` | — | Managed/unmanaged boundary rules. |
| `projection-engine.yaml` | — | Projection engine specification (registry-driven projections). |
| `acceptance-tests.yaml` | — | Protocol acceptance criteria. |
| `phase_j_protocol_closure.yaml` | — | Phase J closure criteria. |
| `VERSION_AUTHORITY.yaml` | AUTHORITATIVE | Single source of truth for version identity. |

### Domains (15)

`domains/` — each a first-class corpus file:

| Domain | Domain | Domain |
| --- | --- | --- |
| `agent` | `governance` | `representation` |
| `certification` | `identity` | `settlement` |
| `commercial` | `intent` | `treasury` |
| `escrow` | `ledger` | `vault` |
| `gateway` | `payment` | `policy` |

### Compiler metadata

`compiler/` — `BUILD_MANIFEST.yaml` (hashing rule R3: NFC Unicode, LF line
endings), `PASS_REGISTRY.yaml`, `GENERATOR_REGISTRY.yaml`,
`ERROR_TAXONOMY.yaml`, `SEMANTIC_COMPILER_CONTRACT.yaml`.

---

## The Compiler

**Package:** [`packages/compiler`](packages/compiler) — `@sovr/compiler` v0.6.0

### Pipeline

```text
discovery → parse → validate → resolve → transform → generate → certify → report
```

### CLI

```bash
node packages/compiler/dist/cli.js compile   # corpus → IR + registries + artifacts
node packages/compiler/dist/cli.js verify    # verify compiled output
node packages/compiler/dist/cli.js boot      # boot attestation
```

### Fail-closed guarantees

The compiler **refuses to emit** authority it cannot prove:

- **Authoritative command map** — a command defined anywhere outside the
  `commands:` map of `03_command-catalog.yaml` fails the build (AMD-0005 class).
- **REF-006** — domain-file command definitions absent from the authoritative
  map are surfaced by the authority audit.
- **REF-008** — machine transition triggers and `emitted_events` must resolve
  to catalog events; prose triggers fail the build.
- **No silent drops** — every corpus node either compiles to authority or
  produces a diagnostic.
- **Determinism R1–R10** — two independent compilations must produce
  byte-identical artifacts (proven in `compiler-certification.json`).

### What it generates

| Artifact | Description |
| --- | --- |
| `generated/sovr-ir.json` | Canonical content-addressed IR |
| `generated/registries/*.registry.json` | 16 registry files (boot, commands, events, machines, capabilities, projections, schemas, economic, reserve, settlement, validation, contracts, constitution, envelopes, execution-plans) + `registry.manifest.json` with per-file SHA-256 + whole-build hash |
| `generated/compiler-manifest.yaml` | Build identity |
| `generated/compiler-certification.json` | Determinism proof + per-input hashes |
| `generated/openapi.json` | Compiled OpenAPI document |
| `generated/prisma/` | Generated persistence schema |
| `generated/typescript/` + `generated/src/` | Generated type/code surface |
| `generated/simulation/` | Compiled simulation corpora |
| `generated/verification/tla/` | TLA+ specs for critical state machines |
| `generated/protocol-topology.json` | Compiled dependency topology |

`generated/COMPILER_RUNTIME_COVERAGE.yaml` reports coverage of corpus →
generated behavior (currently 118/118 commands, 47/47 machines, 0 runtime
bridges — 100% generated behavior).

---

## The Runtime

**Package:** [`packages/runtime`](packages/runtime) — `@sovr/runtime` v0.6.0

### Boot

The runtime process loads `generated/registries` through
[`packages/runtime/src/authority/authority-loader.ts`](packages/runtime/src/authority)
(`JsonRegistryLoader`). **Registry integrity is verified before the kernel
accepts any command.** The runtime never reads the YAML corpus at execution
time.

### Core subsystems

| Subsystem | Location | Notes |
| --- | --- | --- |
| Kernel / command bus | `src/server/commandBus.ts` | Catalog-command intake |
| Capability engine | `src/server/capabilityEngine.ts` | Fail-closed capability gates |
| Event store | `src/server/eventStore.ts` | JSON-file (dev) or PostgreSQL (`DATABASE_URL`) |
| Projection engine | `src/projection*/` | Registry-driven; hand-written models keep precedence, remaining compiled definitions run through `GenericEventProjection` |
| Identity | `src/identity/` | RS256 JWT sessions, DIDs, credentials |
| Audit | `src/audit/` (+ `audit/reconstruction/`) | Correlation-id reconstruction |
| Orchestration | `src/orchestration/` | Command router, event dispatcher, policy gateway, transaction coordinator, workflow engine |
| Economic | `src/economic/` | Reserve/settlement accounting, lineage |
| Execution gates | `src/execution/` (+ `GateEvaluators/`) | Compiled guardrail evaluation |
| Agents | `src/agent/` | Intent engine, planner, executor, memory, policy interface, audit |
| Simulation | `src/simulation/` | 23 test suites against compiled registries |
| Ledger | `src/ledger/tigerbeetle/` | TigerBeetle genesis, shadow execution, replay |
| Adapters | `src/adapters/*` | ACH, FedNow, Wire, RTP, SEPA, SWIFT, Card, EVM, Stablecoin, Oracle, Private ledger, Base |

### Optional publishers

| Publisher | Env toggle | Behavior |
| --- | --- | --- |
| Kafka | `SOVR_KAFKA_ENABLED=true` | Every event → topic `sovr.{domain}.{aggregate}.{event_name}` |
| Redis streams | `SOVR_REDIS_ENABLED=true` | Every event → `XADD sovr:stream:{domain}:{aggregate}` (capped by `SOVR_REDIS_STREAM_MAXLEN`) |

---

## API Surface

HTTP API served by the runtime (compiled OpenAPI at `GET /openapi.json`):

| Method & path | Purpose |
| --- | --- |
| `GET /health` · `GET /api/v1/health` | Liveness / final health |
| `GET /manifest` · `GET /api/v1/manifest` | Registry manifest |
| `GET /boot-attestation` · `GET /api/v1/boot-attestation` | Boot attestation |
| `POST /api/v1/:domain/:aggregate` | Submit a catalog command (the main entry point) |
| `GET /api/v1/:domain/:aggregate/:id` | Read an aggregate |
| `GET /api/v1/commands` | Authoritative command catalog |
| `GET /api/v1/topology` | Compiled protocol topology |
| `GET /api/v1/events` · `GET /api/v1/events/:event_id` | Event query |
| `GET /api/v1/events/stream` | Event stream |
| `GET /api/v1/streams` | Stream listing |
| `GET /api/v1/projections` · `GET /api/v1/projections/:name` | Projection registry / read model |
| `GET /api/v1/capabilities` · `GET /api/v1/capabilities/:actor_id` | Capability queries |
| `POST /api/v1/capabilities/grant` | Grant capability (governance) |
| `GET /api/v1/identity/did/:did` · `POST /api/v1/identity/did/verify` | DID resolution / verification |
| `GET /api/v1/identity/credential/:id` · `POST /api/v1/identity/credential/verify` | Credential handling |
| `POST /api/v1/identity/session` | JWT session issuance |
| `GET /api/v1/sagas` · `GET /api/v1/sagas/:sagaId` | Saga state |
| `POST /api/v1/:domain/saga` | Start saga for a domain command |
| `GET /api/v1/payment/rails` | Available rails |
| `POST /api/v1/payment/rail/:railType/prepare` | Saga stage: prepare |
| `POST /api/v1/payment/rail/:railType/execute` | Saga stage: execute |
| `POST /api/v1/payment/rail/:railType/confirm` | Saga stage: confirm |
| `POST /api/v1/payment/rail/:railType/compensate` | Saga stage: compensate (rollback) |
| `GET /api/v1/audit/:correlation_id` | Reconstructable audit trail |
| `GET /openapi.json` · `GET /openapi.yaml` · `GET /api/v1/openapi` | Compiled OpenAPI |

Example:

```bash
# Health
curl -s localhost:3001/health | jq

# Submit a command
curl -s -X POST localhost:3001/api/v1/treasury/transfer \
  -H 'Content-Type: application/json' \
  -d '{ "payload": { /* per catalog schema */ } }' | jq

# Reconstruct the audit trail
curl -s localhost:3001/api/v1/audit/<correlation_id> | jq
```

---

## Quick Start

### Prerequisites

- **Node.js ≥ 20**, **npm ≥ 10**
- Optional: PostgreSQL (event store), Kafka, Redis (publishers), TigerBeetle
  (ledger certification) — see [Configuration](#configuration)

### One-shot setup

```bash
bash scripts/setup.sh
```

This builds `@sovr/shared` → `@sovr/compiler` → `@sovr/runtime`, compiles the
YAML corpus, and runs the compiler verifier.

### Manual

```bash
npm install

npm run build       # compiler + runtime TypeScript
npm run compile     # YAML → canonical IR + registries + artifacts
npm run verify:simulation   # compile + simulation + integrity suites

# Run the kernel
PORT=3001 node packages/runtime/dist/server/index.js
```

Then:

```bash
curl -s localhost:3001/health
```

### Live demo

```bash
bash scripts/demo.sh
```

Starts the runtime (dev auto-grant), waits for health, and runs an end-to-end
constitutional-kernel exercise with pass/fail reporting.

> ⚠️ The demo uses `SOVR_DEV_AUTO_GRANT=true` for convenience. **Production
> must run `false`** — setting it true violates INV-003/004.

---

## Configuration

Everything is driven by environment variables. The full production template
is [`.env.example`](.env.example).

### Core

| Variable | Default | Notes |
| --- | --- | --- |
| `NODE_ENV` | `production` | |
| `PORT` | `3001` | |
| `HOST` | `0.0.0.0` | |
| `SOVR_LOG_LEVEL` | `info` | |

### Security (required in production)

| Variable | Notes |
| --- | --- |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | RS256 asymmetric signing, **≥ 2048-bit RSA**. Generate: `bash scripts/generate-jwt-keys.sh` |
| `SOVR_DEV_AUTO_GRANT` | **Must be `false` in production** (INV-003/004). Dev escape hatch only. |

### Event store & publishers (optional)

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | `postgres://…` — PostgreSQL event store; leave unset for the dev JSON file store |
| `SOVR_KAFKA_ENABLED`, `SOVR_KAFKA_BROKERS`, `SOVR_KAFKA_CLIENT_ID` | Kafka fan-out |
| `SOVR_REDIS_ENABLED`, `SOVR_REDIS_URL`, `SOVR_REDIS_STREAM_MAXLEN` | Redis stream mirroring |

### Rail drivers (Directive XXI)

| Variable(s) | Notes |
| --- | --- |
| `TIGERBEETLE_CLUSTER_ID`, `TIGERBEETLE_ADDRESSES`, `TIGERBEETLE_CONCURRENCY` | TigerBeetle cluster (multi-node: comma-separated) |
| `ACH_PROVIDER` (dwolla), `ACH_API_KEY`, `ACH_API_SECRET`, `ACH_COMPANY_ID/NAME`, `ACH_ENTRY_DESC`, `ACH_ODFI_ROUTING` | ACH rail |
| `FEDNOW_PARTICIPANT_ID`, `FEDNOW_BANK_URL`, `FEDNOW_API_KEY` | FedNow rail |
| `WIRE_BANK_URL`, `WIRE_API_KEY`, `WIRE_SENDER_ROUTING`, `WIRE_SENDER_ACCOUNT` | Fedwire rail |
| `RTP_BANK_URL`, `RTP_API_KEY`, `RTP_PARTICIPANT_ID` | RTP rail |
| `CARD_PROVIDER` (marqeta), `CARD_API_KEY`, `CARD_API_SECRET` | Card rail |
| `EVM_RPC_URL`, `EVM_PRIVATE_KEY`, `EVM_CHAIN_ID` | EVM blockchain rail |
| `CIRCLE_API_KEY`, `CIRCLE_WALLET_ID` | USDC stablecoin rail |
| `SWIFT_BANK_URL`, `SWIFT_API_KEY`, `SWIFT_BIC` | SWIFT rail |
| `SEPA_BANK_URL`, `SEPA_API_KEY`, `SEPA_SOURCE_IBAN` | SEPA rail |
| `ORACLE_PROVIDER`, `ORACLE_API_KEY` | Price oracle |
| `SOVR_ACH_ROUTING_NUMBER`, `SOVR_ACH_BANK_NAME`, `SOVR_ACH_LATENCY_MS` | Sandbox (mock) ACH boundary |

---

## Testing & Certification

### Root scripts (npm workspaces)

| Command | What it does |
| --- | --- |
| `npm test` | Genesis verification + runtime integration (default gate) |
| `npm run test:genesis` | Genesis spec verification (`verify-spec.mjs genesis`) |
| `npm run test:fault` / `npm run test:stress` | Fault & stress spec verification |
| `npm run verify:simulation` | Compile + simulation + registry-integrity / compiler-drift / unauthorized-command / capability-boundary / replay-stress / schema-validation suites |
| `npm run test:authority` | Registry version + projection replay |
| `npm run test:projection` | Projection reconstruction |
| `npm run test:economic` | Economic validator / registry / reserve accounting / lineage |
| `npm run test:settlement` · `test:settlement:proof` · `test:reserve` | Settlement state, proof, reserve accounting |
| `npm run test:replay` · `test:stress:phase10c` | Settlement replay, Phase-10C economic stress |
| `npm run test:tigerbeetle` · `test:ledger:adapter` · `test:replay:tigerbeetle` · `test:genesis:ceremony` · `test:genesis:readiness` | TigerBeetle ledger suites (require a configured ledger host — environmental) |
| `npm run protocol:runtime-audit` | Runtime authority audit |
| `npm run protocol:formal-verify` | TLA+ model checking (see below) |
| `npm run certify:production` | Production certification packet |
| `npm run certify:phase10b` … `phase10e` | Phase certification pipelines (compile → typecheck → targeted suites → audit) |
| `npm run audit:authority` · `audit:tigerbeetle` · `audit:phase10e` | Authority / ledger / phase audits |

Simulation scenarios live in
[`governance/simulation/scenarios/`](governance/simulation) (`SIM-001` …
`SIM-010`, including AMD-0005 commercial SIM-008/009 and the SIM-010
imbalance negative). Runtime simulation tests:
[`packages/runtime/src/simulation/__tests__/`](packages/runtime/src/simulation/__tests__)
(23 suites).

> **Note:** TigerBeetle suites are environmental (they need a configured
> ledger host) and are not required for protocol certification in the current
> baseline.

---

## Formal Verification (TLA+)

The compiler emits TLA+ specifications for the critical state machines under
[`generated/verification/tla/`](generated/verification/tla). Model checking:

```bash
npm run protocol:formal-verify
# equivalent to: bash scripts/formal-verify.sh
```

Requires Java + `tla2tools.jar` (TLC). Critical machines checked:

- `VAULT_ASSET_LIFECYCLE`
- `LEDGER_JOURNAL_LIFECYCLE`
- `TREASURY_TRANSFER_LIFECYCLE`

Reports land in `generated/verification/reports/`. CI runs this in
[`.github/workflows/formal-verify.yml`](.github/workflows/formal-verify.yml).

---

## CI / CD

| Workflow | Trigger | Jobs |
| --- | --- | --- |
| [`ci.yml`](.github/workflows/ci.yml) | push / PR to `main` | Lint & typecheck → test (genesis) → TypeScript build → Docker image builds |
| [`ci-production.yml`](.github/workflows/ci-production.yml) | production pipeline | Production certification gate |
| [`formal-verify.yml`](.github/workflows/formal-verify.yml) | TLA+ verification | TLC model checking of critical machines |

Node.js 20 throughout, npm-cached.

---

## Deployment

### Docker

```bash
# Development stack
docker compose -f deployment/docker-compose.dev.yml up

# Production stack
docker compose -f deployment/docker-compose.production.yml up
```

- [`deployment/Dockerfile`](deployment/Dockerfile) — runtime image
- [`deployment/docker-compose.yml`](deployment/docker-compose.yml) / `docker-compose.dev.yml` / `docker-compose.production.yml`

### Kubernetes & Helm

- [`deploy/helm/`](deploy/helm) — Helm chart with `values.yaml`
- [`deploy/kubernetes/sovr-api.yaml`](deploy/kubernetes/sovr-api.yaml) — K8s manifests

### Terraform

- [`deploy/terraform/`](deploy/terraform) — `main.tf` + `gcp.tf` / `azure.tf`

### Enterprise

- [`deploy/enterprise/`](deploy/enterprise) — production compose, `haproxy.cfg`,
  `nginx.conf`, `sovr-api.service` (systemd unit)

### Release tooling

- [`scripts/release-v1.0.0.sh`](scripts/release-v1.0.0.sh)
- [`scripts/build-package.mjs`](scripts/build-package.mjs) /
  [`scripts/attest-phase10e8.js`](scripts/attest-phase10e8.js) — ABI package
  builds & attestations
- [`scripts/tigerbeetle-init.sh`](scripts/tigerbeetle-init.sh) — ledger bootstrap
- [`scripts/generate-jwt-keys.sh`](scripts/generate-jwt-keys.sh) — JWT keypair

---

## Governance & Amendments

The protocol changes **only** through the amendment process:

- [`11_governance-amendments.yaml`](11_governance-amendments.yaml) — ratified
  amendments (`AMD-…`), e.g. **AMD-0005** (commercial commands in the
  authoritative map).
- [`governance/`](governance) — amendments, `ACTIVE_WORK.yaml`, `BACKLOG.yaml`,
  `PROJECT_MANIFEST.yaml`, constitutional finding registry, review board,
  impact reports, evidence, and release records.
- [`governance/simulation/`](governance/simulation) — simulation scenarios
  that amendments must pass before ratification.
- Constitutional changes require amendment of the L0 files and re-freeze of
  `01_constitution.yaml` (new lock hash) — the compiler verifies the hash at
  every build.

Protocol spec `1.0.0` is **frozen**: any change to it is a constitutional
amendment, not a routine edit.

---

## Versioning

Version identity is owned by a single file —
[`VERSION_AUTHORITY.yaml`](VERSION_AUTHORITY.yaml). No version identifier may
be hardcoded in runtime source.

| Axis | Current | Semantics |
| --- | --- | --- |
| **Protocol** | `1.0.0` (frozen) | Immutable once frozen; changes require constitutional amendment |
| **Compiler** | `0.6.0` | Tracks compiler releases (rebuild + manifest update) |
| **Runtime** | `0.6.0` | Tracks runtime package releases (rebuild + manifest update) |
| **Package ABI** | `v1` | Deployable package format; ABI changes don't force runtime changes |

Protocol version and compiler/runtime versions are deliberately independent
concepts — do not force them to be equal.

---

## Documentation Map

| Document | Authority |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | **Implementation truth** — architecture as built, live compiled counts |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Operating & extending the system |
| [`docs/DOCUMENTATION.md`](docs/DOCUMENTATION.md) | Documentation policy |
| [`docs/generated/`](docs/generated) | Compiler-emitted reference (commands, events, machines, capabilities, projections). **Presentation only — not counts authority. Do not hand-edit.** |
| [`docs/history/`](docs/history) | Forensic / remediation records, old audits, certification packets. Marked `HISTORICAL / REMEDIATION RECORD`. Not descriptions of the current architecture. |
| [`CHANGELOG.md`](CHANGELOG.md) | Phase narratives (Keep a Changelog + SemVer). Counts/hashes below the current baseline may be superseded — treat as history. |

**Rule:** when updating documentation, take counts *from the newly compiled
registries* — never from memory or from older docs.

---

## Contributing

### The workflow

1. **Edit YAML** — catalog, machines, events, capabilities, projections,
   amendments.
2. **Compile** — `npm run compile`. Fix fail-closed diagnostics
   (REF-006 / REF-008 / silent drops).
3. **Verify** — `npm run verify:simulation`, integration, and the relevant
   phase certification pipeline.
4. **Document** — update `docs/ARCHITECTURE.md` counts **from the new
   registries**.

### What you must not do

- ❌ Hand-edit `generated/**` (registries, IR, manifests, generated code).
- ❌ Add runtime YAML parsers — the runtime executes compiled authority only.
- ❌ Add command handlers that bypass the authoritative command map.
- ❌ Invent machine triggers that are not catalog events.
- ❌ Hardcode version strings in runtime source.
- ❌ Set `SOVR_DEV_AUTO_GRANT=true` in production.

### Environment

```
Node.js ≥ 20 · npm ≥ 10 · npm workspaces (packages/*) · ESM
```

---

## Historical Material

Phase reports, determinism forensics, old audits, and certification packets
live under [`docs/history/`](docs/history/README.md). They are marked:

```text
HISTORICAL / REMEDIATION RECORD
```

They document past defects and remediations (inert-authority defects,
prose-trigger elimination, projection convergence, determinism remediation…).
They are **not** descriptions of the current architecture — the current
architecture is [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) plus the
compiled registries.

---

## License

**Proprietary — all rights reserved.**

This is not open-source software. Use of this repository is governed by the
applicable license agreement with the copyright holder. No rights are granted
beyond what is explicitly licensed.

---

<div align="center">

### SOVR Financial OS — *the constitution of a financial operating system, compiled.*

</div>
