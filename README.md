# SOVR Protocol

> A spec-first, compiled financial protocol.
>
> Versioned YAML source of truth · deterministic compilation · generated artifacts · reference runtime

---

## What SOVR is

SOVR is a **compiled, spec-first financial protocol** with a TypeScript reference compiler and runtime.

Its protocol corpus defines financial domains, commands, events, authority rules, state machines, sagas, accounting constraints, integration boundaries, and generated-interface contracts as versioned YAML. The compiler turns that corpus into a canonical intermediate representation (IR), generated artifacts, and a content-addressed build manifest.

SOVR is not a blockchain, a smart-contract platform, or a payments processor. It is a protocol and implementation foundation from which compliant financial systems can be built and audited.

> **Current implementation boundary:** the YAML corpus is authoritative for the protocol, but the reference runtime does not yet interpret all compiled artifacts. It contains handwritten execution code for the currently runnable command, event, projection, and adapter paths.

## Core premise

Financial systems commonly split their source of truth across requirements documents, application code, middleware, API definitions, and operational audit logs. SOVR is designed to put the protocol-level definitions of those concerns into one governed corpus:

```text
YAML protocol corpus
        │
        ▼
SOVR compiler ──► canonical IR ──► generated artifacts + build manifest
        │
        ▼
Reference runtime ──► append-only event log ──► derived projections
```

The current compiler can deterministically compile the corpus. Full enforcement of the intended rule—"a protocol behavior not in the spec cannot execute"—requires the remaining runtime-interpreter and generated-artifact wiring work described below.

---

## Protocol corpus

The authoritative entry point is [`00_protocol-manifest.yaml`](./00_protocol-manifest.yaml). It declares the protocol identity, dependency layers, nine canonical domains, and the intended compiled-runtime enforcement model.

The root protocol specifications include:

| File | Defines |
|---|---|
| `00_protocol-manifest.yaml` | Protocol identity, layers, domain map, and compilation model |
| `01_constitution.yaml` | Ten constitutional invariants and enforcement requirements |
| `02_domain-model.yaml` | Entities and value/domain vocabulary |
| `03_command-catalog.yaml` | Commands, payload requirements, authority requirements, and resulting events |
| `04_event-catalog.yaml` | Event catalog and event-envelope contract |
| `05_state-machines.yaml` | State-machine states, transitions, and declarative guards |
| `08_security-capabilities.yaml` | Capability definitions and scope patterns |
| `09_saga-orchestration.yaml` | Multi-domain saga definitions and compensations |
| `11_governance-amendments.yaml` | Governance amendment definitions |
| `12_domain-contracts.yaml` | Cross-domain and boundary contracts |
| `13_compiler-adr.yaml` | Compiler architectural decisions |
| `projection-engine.yaml` | Projection/read-model specification |
| `hybrid-boundary.yaml` | External and hybrid-system boundary specification |
| `compiler.yaml` | Compiler input/output and pipeline contract |
| `acceptance-tests.yaml` | Protocol acceptance-test specification |

Domain-specific YAML documents under [`domains/`](./domains/) provide additional detail for the nine canonical domains: **vault, ledger, treasury, payment, identity, policy, intent, agent, and governance**.

---

## Compiler

- **Compiler package:** [`packages/compiler`](./packages/compiler)
- **Compiler version:** `0.2.0-kernel-working`
- **Protocol version:** `1.0.0`
- **Hash algorithm:** SHA-256

### What works today

The runnable compiler:

1. Discovers a closed, ordered YAML input set.
2. Loads and parses YAML.
3. Performs partial cross-reference and semantic validation.
4. Builds a typed graph IR of domains, entities, commands, events, capabilities, and state machines.
5. Invokes deterministic generators.
6. Writes generated files, canonical IR, and a compiler manifest.
7. Repeats compilation to verify the same build hash for the same inputs and environment.

### Canonical IR

[`generated/sovr-ir.json`](./generated/sovr-ir.json) is human-readable canonical JSON. It contains protocol metadata, typed nodes, and graph edges; it is not binary or Protobuf.

The IR hash is SHA-256 over canonical JSON of the IR nodes, edges, protocol version, and compiler version. The emitted IR file itself contains the IR metadata, nodes, and edges; diagnostics are recorded in the compiler manifest rather than in that file.

### Build hash

[`generated/compiler-manifest.yaml`](./generated/compiler-manifest.yaml) records a SHA-256 build hash computed from:

- sorted YAML input hashes;
- the IR hash;
- sorted generated-output hashes;
- compiler version;
- registry-version data; and
- generation order.

This makes the current compilation reproducible for the same source inputs and compiler behavior. It is not a substitute for runtime consensus, distributed determinism, or tamper-proof storage.

### Generated artifacts

A compile currently produces **62 generated artifact files**, plus `generated/sovr-ir.json` and `generated/compiler-manifest.yaml`.

| Output | Count | Purpose |
|---|---:|---|
| `generated/src/types/{domain}/{domain}.types.ts` | 9 | TypeScript domain/entity types |
| `generated/src/commands/{domain}/{domain}.commands.ts` | 10 | Command classes and basic Zod schemas |
| `generated/src/events/{domain}/{domain}.events.ts` | 10 | Event classes |
| `generated/openapi.yaml` | 1 | OpenAPI 3.1 document from command IR nodes |
| `generated/prisma/schema.prisma` | 1 | Prisma schema from the domain model |
| `generated/config/kafka/topics.yaml` | 1 | Kafka topic configuration |
| `generated/config/redis/streams.yaml` | 1 | Redis stream configuration |
| Generated capability, policy, execution, guardrail, and VEL files | 5 | Execution-layer skeletons |
| `generated/src/sdk/agent-sandbox.ts` | 1 | Agent-sandbox skeleton |
| `generated/verification/tla/*.tla` | 21 | TLA+ files from declared state machines |
| `generated/protocol-topology.json`, `generated/docs/topology.md` | 2 | Machine- and human-readable topology |

The generated TypeScript artifacts are **not yet imported by the handwritten runtime service**. The generated OpenAPI artifact is compiler-generated, while the live Fastify route map is currently separately implemented in `packages/runtime/src/server/handlers.ts`.

### Compiler status and limitation

The repository declares a 20-pass compiler contract in [`compiler/PASS_REGISTRY.yaml`](./compiler/PASS_REGISTRY.yaml): from `PROTOCOL_DISCOVERY` through `COMPILER_REPORT`. There is no registered, dependency-ordered, certified `PASS-001`–`PASS-020` runner in the current implementation; the working compiler implements partial functional equivalents outside that pass framework.

**Fail-closed status: partial.** Invalid YAML throws and stops compilation. However, the compiler currently collects some `ERROR` diagnostics and continues to construct IR and generate artifacts. Full fail-closed handling remains unimplemented.

---

## Constitution and runtime enforcement

[`01_constitution.yaml`](./01_constitution.yaml) defines ten invariants, including event immutability, double-entry accounting, authority boundaries, audit-trail requirements, and command-execution gates.

The reference runtime enforces a subset through handwritten pre-execution gates and event-store behavior:

| Implemented behavior | Current location |
|---|---|
| Identity context and permitted actor-type checks | `CommandBus` pre-execution gate |
| Capability and scope checks | `CommandBus` plus `CapabilityEngine` |
| Limited policy logic | `CommandBus` pre-execution gate |
| Balanced double-entry rejection | `ledger.entry.post` check in `CommandBus` (`INV-002`) |
| AI-agent authority restrictions | `CommandBus` checks for selected authority-changing commands |
| In-process event immutability | `EventStore` append API and frozen envelopes |
| Projection rebuild from event history | `ProjectionEngine` |

For example, `ledger.entry.post` is rejected before event emission unless it has at least two postings and total debits equal total credits.

The remaining intended constitutional coverage is **not fully implemented**. The current runtime is not a complete interpreter of constitutional rules, YAML state machines, or YAML sagas.

---

## State machines and sagas

### State machines

The protocol defines 21 state machines in [`05_state-machines.yaml`](./05_state-machines.yaml). A state machine contains the following declarative structure:

```yaml
domain: string
aggregate: string
initial_state: string
final_states: [string]
states:
  STATE_NAME:
    description: string
    allowed_commands: [string]
    entry_actions: [string]
    exit_actions: [string]
transitions:
  ORIGIN_to_DESTINATION:
    trigger: string
    condition: string
    emitted_events: [string]
    invalid: boolean
```

The `condition` field is declarative text. There is no formal guard-expression grammar or YAML state-machine interpreter in the current runtime. The compiler generates 21 TLA+ files from these definitions, but model checking is not run in CI.

### Sagas

[`09_saga-orchestration.yaml`](./09_saga-orchestration.yaml) specifies centrally orchestrated, multi-domain workflows. A saga defines an event/condition trigger, ordered steps, participant domains, commands, retries, timeouts, failure actions, and explicit compensation commands.

The principal compensation strategy is `SEQUENTIAL_REVERSE`; this is not a pure choreography model. Saga runtime interpretation is **not built**.

---

## Reference runtime

- **Runtime package:** [`packages/runtime`](./packages/runtime)
- **Runtime version:** `0.2.0-kernel-working`
- **HTTP server:** Fastify
- **Canonical runtime state:** local JSON event-log snapshot

### What it does today

The reference runtime can:

- issue and verify HMAC-signed development JWT sessions;
- accept catalog-backed commands through a `CommandBus`;
- enforce the currently implemented pre-execution checks;
- append event envelopes to a local event store;
- build and query 15 in-memory projections;
- expose REST endpoints and an event WebSocket stream;
- optionally publish events to Kafka and Redis when those integrations are explicitly enabled; and
- run a mock ACH adapter that emits rail events.

### What it does not do today

- Interpret YAML-defined state-machine transitions.
- Execute YAML-defined saga orchestration or compensation.
- Use generated TypeScript artifacts as the runtime execution implementation.
- Provide a production database, durable capability registry, or production identity registry.
- Enforce every constitutional invariant.
- Contact a financial institution or execute a real payment rail.
- Provide distributed multi-node execution or deterministic state convergence.

---

## Event log and projections

### Event log

The current event store persists a JSON snapshot at:

```text
generated/data/sovr-events.json
```

It is append-only **through the in-process `EventStore` API**: append operations freeze envelopes and the API exposes no supported mutation or deletion operation. It is not tamper-proof: filesystem-level access can modify the JSON snapshot, and persistence rewrites the complete snapshot file.

A runtime event emits these core fields:

```text
event_id, event_name, event_version, schema_version,
aggregate, aggregate_id, source_domain,
command_id, triggering_command, causation_id, correlation_id,
actor_id, identity_context, policy_decision_id, capability_id,
timestamp, payload, projection_effect, audit
```

`actor_chain` and `retention_metadata` are optional in the TypeScript interface and are populated by the append path. There is not yet an independent runtime schema validator for persisted events.

### Projections

The runtime holds 15 materialized, in-memory projections. On the normal `CommandBus` path, an event is appended and then dispatched to projections. At startup, `ProjectionEngine.rebuildFromGenesis()` rebuilds every projection from the event log.

The event log is the intended source of truth; projections are derived state. Events appended directly by the mock ACH adapter are persisted, but do not update projections until a rebuild/restart.

---

## Identity, assets, and capabilities

Identity is an execution-authority primitive for financial workflows, not a standalone DID/VC product. The protocol identity model covers actors, credentials, trust anchors, delegations, sessions, and authority context, but it is **not a standards-complete DID/VC implementation**.

In the normal `CommandBus` path, a command requires identity context, capability, scope, and policy validation. Direct mock boundary endpoints do not uniformly pass through that path.

Assets are defined by the Vault domain. An asset references identities that represent its issuer, economic owner, custodian, and/or controller. Those relationships are described in the specification; the current runtime does not validate them against a durable identity registry.

Capability grants are in-memory in the reference runtime. They are not durable across restart and are not a production authorization system.

---

## External boundaries

The protocol declares boundaries for external payment, custody, blockchain, and oracle systems. The reference runtime registers 12 rail types, but only one adapter implementation exists:

| Rail | Status |
|---|---|
| ACH | Mock adapter; emits prepare/execute/confirm/compensate events but does not contact a financial institution |
| Other declared rails | [not built] |
| Oracle and hybrid boundaries | Specified; runtime integration is [not built] |

---

## Getting started

### Prerequisites

- Node.js **20 or later**
- npm

### Compile the protocol

```bash
git clone https://github.com/StavoMidnite661/SOVR-Protocol.git
cd SOVR-Protocol

cd packages/compiler
npm ci
npm run build
npm run compile
npm run verify
```

`npm run compile` writes generated artifacts to the repository-level `generated/` directory. `npm run verify` runs two compiler executions and compares their build hashes.

### Run the reference runtime

```bash
cd ../runtime
npm ci
npm run build
PORT=3001 npm run server
```

In another terminal:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/v1/manifest
```

### Run the tested demo flows

```bash
cd packages/runtime
npm test
```

The integration suite exercises session creation, capability grants, asset registration, event/projection queries, double-entry rejection, WebSocket event delivery, and mock ACH prepare/execute/confirm behavior. These are reference-runtime demonstrations, not real financial settlement.

---

## Current status

| Capability | Status |
|---|---|
| YAML corpus compilation | Implemented |
| Reproducible SHA-256 build hash | Implemented |
| Canonical JSON IR generation | Implemented |
| 62 generated artifacts + IR/manifest | Implemented |
| Registered `PASS-001`–`PASS-020` runner | [not built] |
| Full fail-closed compiler behavior | [not built] |
| Local append-only-by-API event log | Implemented |
| 15 in-memory projections | Implemented |
| Identity/capability/policy command gates | Partially implemented |
| Full constitutional invariant enforcement | [not built] |
| YAML state-machine interpreter | [not built] |
| YAML saga runtime | [not built] |
| Production durable state and authorization stores | [not built] |
| Real financial-rail integration | [not built] |
| Distributed deterministic execution | [aspirational] |

## Path to a production v1

The most consequential unresolved architecture is the authoritative execution realization for the compiled protocol: whether and how compiled YAML becomes binding runtime behavior through an interpreter, generated aggregates/workflows, or another execution model.

A production-capable system would require, at minimum:

1. A chosen and implemented spec-execution model for state machines, saga steps, guards, policies, and invariants.
2. A durable, concurrency-safe, recoverable event store and projection architecture.
3. Durable identities, credentials, capability grants, and key management.
4. Complete accounting, reserve, custody, idempotency, and reconciliation semantics.
5. Authenticated production rail adapters and operational/legal controls appropriate to the rail and jurisdiction.
6. Security hardening, monitoring, incident controls, and independent review.

SOVR must not be used to process real financial transactions in its current form.

---

## Contributing

The highest-leverage contribution areas are:

1. Implement the registered, dependency-ordered compiler pass runner.
2. Make compiler errors fail closed.
3. Choose and implement the authoritative YAML execution model.
4. Implement the state-machine and saga runtime.
5. Wire generated artifacts into runtime execution.
6. Expand constitutional enforcement and replace local/in-memory state with durable production components.

## License

No standalone license file is present in this repository. The previous project README labeled the project proprietary; confirm the intended license with the maintainers before use or redistribution.

---

**SOVR Protocol — spec-first, compiled, and under active development.**
