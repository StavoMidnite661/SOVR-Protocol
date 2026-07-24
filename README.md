# SOVR Financial OS

> **A spec-first, compiled financial protocol.**  
> One versioned YAML source of truth.  
> Constitutional enforcement. Deterministic compilation.  
> The kernel layer for programmable finance.

---

[![Protocol](https://img.shields.io/badge/Protocol-v1.0.0-blue)](https://img.shields.io/badge/Protocol-v1.0.0-blue)
[![Compiler](https://img.shields.io/badge/Compiler-v0.6.0-orange)](https://img.shields.io/badge/Compiler-v0.6.0-orange)
[![Runtime](https://img.shields.io/badge/Runtime-v0.6.0-orange)](https://img.shields.io/badge/Runtime-v0.6.0-orange)
[![Build](https://img.shields.io/badge/Build-Reproducible-green)](https://img.shields.io/badge/Build-Reproducible-green)
[![Node](https://img.shields.io/badge/Node-%3E%3D20-green)](https://img.shields.io/badge/Node-%3E%3D20-green)
[![License](https://img.shields.io/badge/License-Proprietary-red)](https://img.shields.io/badge/License-Proprietary-red)

---

## Table of Contents

- [What SOVR Is](#what-sovr-is)
- [Why Spec-First](#why-spec-first)
- [The Constitutional Kernel](#the-constitutional-kernel)
- [Architecture](#architecture)
- [Constitutional Layers](#constitutional-layers)
- [The Constitution](#the-constitution)
- [Domains](#domains)
- [Command Catalog](#command-catalog)
- [Event Catalog](#event-catalog)
- [State Machines](#state-machines)
- [Saga Orchestration](#saga-orchestration)
- [Security Model](#security-model)
- [The Compiler](#the-compiler)
- [The Runtime](#the-runtime)
- [Boot Sequence](#boot-sequence)
- [Projection Engine](#projection-engine)
- [External Boundaries](#external-boundaries)
- [Getting Started](#getting-started)
- [Current State vs Roadmap](#current-state-vs-roadmap)
- [Repository Structure](#repository-structure)
- [Audit Reports](#audit-reports)
- [Contributing](#contributing)
- [License](#license)

---

## What SOVR Is

SOVR is a **compiled, spec-first financial protocol** with a reference compiler and runtime.

Its central thesis:

> Financial commands, events, authority rules, state machines, accounting invariants, API contracts, and generated integration artifacts should all derive from one versioned, human-readable, machine-verifiable YAML source of truth.

The compiler consumes that source of truth and produces a canonical, content-addressed Intermediate Representation and a deterministic set of generated artifacts. The runtime executes against those artifacts under constitutional enforcement.

**SOVR is not a blockchain.**  
**SOVR is not a payments processor.**  
**SOVR is not a smart contract platform.**

SOVR is the **specification and execution kernel** — the layer from which compliant financial systems are deterministically built, audited, and reproduced.

The Linux kernel does not process payments. It provides the primitives from which payment systems are built. SOVR is the equivalent layer for finance.

---

## The Constitutional Kernel

SOVR is a **generic financial execution kernel**.

The runtime contains zero domain knowledge.  
No vault logic. No ledger logic. No treasury logic.  
No escrow logic. No payment logic.

Every financial behavior is derived exclusively from the constitutional YAML corpus through deterministic compiler generation.

### The Execution Model

```text
YAML Constitution
    │
    ▼
SOVR Compiler (deterministic, content-addressed)
    │
    ▼
Registry Package (sovr-runtime-v0.6.0-abi-v1.svr)
    │
    ├── commands.registry.json
    ├── machines.registry.json
    ├── validation.registry.json  ← JSON instruction trees
    ├── events.registry.json
    ├── capabilities.registry.json
    ├── execution-plans.registry.json
    ├── registry.manifest.json    ← ELF header equivalent
    └── compiler-certification.json
    │
    ▼
Generic Financial Kernel (KernelExecutor)
    │   Zero domain knowledge
    │   Loads registries once at boot
    │   Executes ExecutionPlan from registry
    │   O(1) registry lookups at execution time
    ▼
Infrastructure (PostgreSQL, Kafka, Redis, REST)
```

### Runtime ABI v1

```text
Compiler 0.6.x → Registry ABI v1
Compiler 0.7.x → Registry ABI v1 (non-breaking)
               → Registry ABI v2 (breaking changes)
```

Future runtimes in Rust, Go, or WASM load the same JSON registry files. The protocol is language-neutral by design.

### Adding A New Domain

```bash
# 1. Add YAML to corpus
# 2. Compile
node packages/compiler/dist/cli.js compile

# 3. Boot runtime — zero TypeScript changes
PORT=3001 node packages/runtime/dist/server/index.js

# 4. Execute commands in new domain immediately
```

### The Constitutional Proof

This is verified, not claimed.

The Escrow domain was added to YAML only. The compiler generated all executable artifacts. The kernel executed escrow commands without modification.

```text
escrow.account.create  → ACCEPTED  (INIT → CREATED)
escrow.account.release → REJECTED  (CREATED invalid — fail-closed)
escrow.account.fund    → ACCEPTED  (CREATED → FUNDED)
escrow.account.release → ACCEPTED  (FUNDED → RELEASED)

Purity audit:        PASS — 0 violations
Integration tests:   16/16 PASS
Boot self-test:      7/7 PASS
```

See: `certification/CONSTITUTIONAL_PROOF_XV3.yaml`

### Runtime Purity Enforcement

```bash
npm run protocol:runtime-audit
# → RUNTIME PURITY AUDIT: PASS — 0 violations
```

**Forbidden in runtime source:**
- `switch(commandName)`
- `switch(domain)`
- `if(command === "...")`
- Hardcoded aggregate names
- Domain-specific handlers
- Runtime IR parsing
- Runtime YAML parsing
- Hardcoded registry counts

### Verified Metrics (v0.6.0)

| Metric | Value | Verified |
|---|---|---|
| Protocol Specification | v1.0.0 FROZEN | ✅ |
| Compiler Version | 0.6.0 | ✅ |
| Runtime Version | 0.6.0 | ✅ |
| Registry ABI | v1 | ✅ |
| YAML files | 244/244 valid | ✅ |
| Commands | 105 | ✅ |
| Events | 259 | ✅ |
| State Machines | 43 | ✅ |
| Capabilities | 111 | ✅ |
| Projections | 16 | ✅ |
| IR nodes | 592 | ✅ |
| IR edges | 459 | ✅ |
| Generated artifacts | 104 | ✅ |
| TLA+ models | 43 | ✅ |
| Registry JSON files | 11 | ✅ |
| Boot runlevels | 8/8 HEALTHY | ✅ |
| Boot self-test | 7/7 PASS | ✅ |
| Integration tests | 16/16 PASS | ✅ |
| Purity violations | 0 | ✅ |
| Build hash | `b7d8221b0d7359a7733791d00cf32622df7b707ff4171c0c1b541d91d7568492` | ✅ |
| Byte-identical reproducibility | Verified | ✅ |
| Constitutional proof | XV3-ESCROW-PROOF | ✅ |
| Manual runtime bridges | 0 | ✅ |
| Generated behavior | 100% | ✅ |

---

## Why Spec-First

Most financial systems suffer the same structural problem:

| Layer | Where it lives | What happens when it drifts |
|---|---|---|
| Business rules | Documents | Behavior diverges from intent |
| API contracts | Handwritten code | Consumers break silently |
| Authorization rules | Middleware | Security gaps appear |
| State machines | Engineers' heads | Edge cases go unhandled |
| Audit trail | Log reconstruction | Compliance fails |

When any layer drifts from the others, the system becomes inconsistent, expensive to audit, and dangerous to change.

SOVR collapses all layers into a single compiled artifact:

```text
YAML Corpus
    │
    ▼
SOVR Compiler (deterministic, content-addressed)
    │
    ▼
Canonical IR (sovr-ir.json) + Build Hash (SHA-256)
    │
    ▼
Generated Artifacts (types, routes, schemas, TLA+, OpenAPI...)
    │
    ▼
Runtime (constitutional enforcement, 7-stage pipeline)
    │
    ▼
Append-Only Event Log (source of truth)
    │
    ▼
Projections (derived state — event log always wins)
```

If it is not in the spec, it does not compile.  
If it does not compile, it does not run.  
If it runs, it is auditable.

---

## Architecture

### Constitutional Layers (L0–L7)

SOVR organizes its specification into eight dependency layers. A file in layer N may only reference files in layers 0..N. This enforces a strict, acyclic dependency graph across the entire protocol.

```text
┌──────────────────────────────────────────────────────────┐
│  L7 — PRODUCTION     │ compiler.yaml, acceptance-tests  │
│  L6 — BOUNDARY       │ hybrid-boundary.yaml             │
│  L5 — INTEGRATION    │ 12_domain-contracts.yaml         │
│  L4 — INTERPRETATION │ projection-engine.yaml           │
│  L3 — AUTHORITY      │ 08_security-capabilities.yaml    │
│  L2 — EXECUTION      │ 05_state-machines.yaml           │
│                      │ 09_saga-orchestration.yaml       │
│  L1 — SHARED LANG    │ 02_domain-model.yaml             │
│                      │ 03_command-catalog.yaml          │
│                      │ 04_event-catalog.yaml            │
│  L0 — GOVERNANCE     │ 00_protocol-manifest.yaml        │
│                      │ 01_constitution.yaml             │
└──────────────────────────────────────────────────────────┘
```

| Layer | Name | Purpose |
|---|---|---|
| L0 | Protocol Governance | Immutable principles, authority model, emergency procedures |
| L1 | Shared Language | Entity definitions, command vocabulary, event vocabulary |
| L2 | Execution Control | State transitions, saga orchestration, failure behavior |
| L3 | Authority | Who can act, on what resources, under what scope |
| L4 | Interpretation | Derived read models, projection truth |
| L5 | Integration | Cross-domain coupling and boundary contracts |
| L6 | Boundary | External system interfaces, blockchain, oracles |
| L7 | Production | Compiler specification and acceptance test suite |

### Dependency Graph

```text
                   ┌──────────┐
                   │  kernel  │
                   └────┬─────┘
                        │
              ┌─────────┼──────────┐
              ▼         ▼          ▼
         ┌─────────┐ ┌──────┐ ┌────────┐
         │governance│ │vault │ │ ledger │
         └────┬────┘ └──┬───┘ └───┬────┘
              │          │         │
     ┌────────┼──────────┼─────────┼──────────┐
     ▼        ▼          ▼         ▼           ▼
┌────────┐┌────────┐┌─────────┐┌───────┐┌─────────┐
│identity││ policy ││treasury ││intent ││ runtime │
└────┬───┘└────┬───┘└────┬────┘└───┬───┘└─────────┘
     │         │          │         │
     ▼         ▼          ▼         ▼
┌────────┐┌─────────────────────────────────┐
│ agent  ││           payment               │
└────────┘└─────────────────────────────────┘
                    ▲        ▲        ▲
                    │        │        │
            ┌───────┴─┐┌──────────┐┌──────────────┐
            │compiler ││projection││certification │
            └─────────┘└──────────┘└──────────────┘
```

---

## The Constitution

`01_constitution.yaml` is the supreme law of SOVR. All domains, services, agents, and integrations operate within its boundaries. The ten immutable invariants cannot be amended through normal governance — they are the kernel.

### Immutable Invariants

| ID | Name | Rule | On Violation |
|---|---|---|---|
| INV-001 | Event Immutability | Every state change requires an immutable event | Halt system |
| INV-002 | Double-Entry Balance | No ledger mutation without balanced journal entry | Reject command |
| INV-003 | Authority Boundary | No actor may exceed granted authority | Reject + audit |
| INV-004 | Agent Financial Authority Prohibition | No agent may create, grant, or modify financial authority | Terminate agent |
| INV-005 | Audit Trail Completeness | Every financial action must produce an auditable event trail | Reject command |
| INV-006 | Events Describe, Don't Mutate | Events describe reality; projections interpret reality | Rebuild projection |
| INV-007 | Value Preservation Priority | Value preservation outranks execution speed | Reject optimization |
| INV-008 | Command Execution Gates | No command executes without identity + capability + scope + policy | Reject command |
| INV-009 | Unknown State Representation | Unknown financial states must be represented explicitly | Flag for governance |
| INV-010 | No Autonomous Bypass | No autonomous agent may bypass constitutional enforcement | Terminate agent |

### Runtime Enforcement Status

| Invariant | Specified | Runtime Enforced |
|---|---|---|
| INV-001 | ✅ | ✅ In-process event store enforcement |
| INV-002 | ✅ | ✅ Pre-execution gate — rejects unbalanced ledger entries |
| INV-003 | ✅ | 🔧 Partial — capability gate exists, full scope enforcement in progress |
| INV-004 | ✅ | 🔧 Partial — agent sandbox specified, full enforcement in progress |
| INV-005 | ✅ | 🔧 Partial — 18-field event envelope enforced, certification enforcement in progress |
| INV-006 | ✅ | ✅ Projections never authoritative — event log always wins |
| INV-007 | ✅ | 📋 Specified — runtime enforcement on roadmap |
| INV-008 | ✅ | 🔧 Partial — identity and capability gates active, full pipeline in progress |
| INV-009 | ✅ | 📋 Specified — runtime enforcement on roadmap |
| INV-010 | ✅ | 🔧 Partial — agent sandbox generated, full wiring in progress |

**Speed never outranks safety. Autonomy never outranks authority.**

### Conflict Resolution Priority

| Rank | Category |
|---|---|
| 1 | Invariant Preservation |
| 2 | Asset Security |
| 3 | Regulatory Compliance |
| 4 | Ledger Integrity |
| 5 | Transaction Completion |
| 6 | Operational Efficiency |
| 7 | Agent Autonomy |

### Authority Model

| Actor | Permitted | Forbidden |
|---|---|---|
| Human | Express intent, authorize, approve, govern, initiate transfer | Modify events, alter history, bypass policy |
| AI Agent | Analyze, recommend, execute approved workflows, query read models | Mint assets, alter history, bypass policy, grant capabilities |
| Governance | Amend constitution, modify policies, override agents, emergency halt | Modify immutable events, bypass double-entry |
| System | Enforce invariants, validate commands, rebuild projections | Originate financial commands, modify business state |

---

## Domains

SOVR defines **10 first-class financial domains** covering the complete operational surface of a financial operating system.

| Domain | Core Question | Commands | Events |
|---|---|---|---|
| Vault | Can value exist? | 13 | 21 |
| Ledger | How is truth recorded? | 9 | 14 |
| Treasury | Can value move? | 9 | 12 |
| Identity | Who is acting? | 12 | — |
| Policy | Is this action permitted? | 8 | — |
| Intent | What does the actor want? | 9 | — |
| Agent | Can intelligence request action? | 8 | — |
| Payment | Can execution leave the system? | 10 | — |
| Governance | Who oversees the system? | 13 | — |
| Escrow | Can value be conditionally held and released? | 4 | 8 |

**Total: 105 commands. 259 events. 48 entities.**

### Vault Domain

**Core Question: Can value exist?**

The Vault is the Value Authority Domain — it defines what SOVR recognizes as value.

| Entity | Description | Key States |
|---|---|---|
| asset | A unit of value recognized by SOVR | REGISTERED → VERIFIED → AVAILABLE → RESERVED → LOCKED → CONSUMED |
| reservation | A soft or hard lock on asset value | PENDING → ACTIVE → CONSUMED / EXPIRED / RELEASED |
| collateral_position | An asset pledged as security | PROPOSED → ACTIVE → MARGIN_CALL → LIQUIDATING → RELEASED |
| custody_attestation | Proof of asset existence at a custody location | Active, Expired |
| valuation | A trusted price assessment | oracle, internal_pricing, market_feed, manual |

### Ledger Domain

**Core Question: How is truth recorded?**

The Ledger is the Immutable Financial History Domain. It is the source of financial truth.

Every ledger mutation requires a balanced journal entry (INV-002 — the only invariant currently enforced at runtime).

Account types: `ASSET` `LIABILITY` `EQUITY` `REVENUE` `EXPENSE` `MEMORANDUM` `RESERVE` `COLLATERAL`

### Treasury Domain

**Core Question: Can value move?**

Transfer Lifecycle:

```text
REQUESTED → AUTHORIZED → RESERVED → EXECUTING →
PENDING_SETTLEMENT → SETTLED
```

Failure paths: `REJECTED` `EXPIRED` `FAILED` `COMPENSATION_REQUIRED` `UNKNOWN_EXTERNAL_STATE`

### Identity Domain

**Core Question: Who is acting?**

Identity in SOVR is an **execution authority primitive**, not a product.

Every command execution requires an identity context that determines permitted commands, active capabilities, applicable policy rules, and required constitutional checks.

Actor types: `human` `organization` `ai_agent` `service_account` `governance` `external_system`

Trust levels: `NONE` `LOW` `MEDIUM` `HIGH` `SOVEREIGN`

> **Current status:** Identity enforcement is a pre-execution gate. Identity is not a standards-complete DID/VC implementation. Identity records are not backed by a production persistent registry.

### Policy Domain

**Core Question: Is this action permitted?**

Evaluation strategies: `FIRST_MATCH` `ALL_MUST_PASS` `MAJORITY` `WEIGHTED_SCORE`

Decisions: `ALLOW` `DENY` `ESCALATE` `DEFER`

### Intent Domain

**Core Question: What does the actor want to do?**

Intent Lifecycle:

```text
RECEIVED → ENRICHING → VALIDATING → READY → CONVERTED_TO_COMMAND
```

### Agent Domain

**Core Question: Can intelligence request action?**

All agent execution passes through constitutional enforcement.

- Every agent action requires a traceable `intent_id`
- Agents emit audit envelopes for every action
- Approaching authority limits (90%) triggers mandatory escalation
- Agents may never create, grant, or modify financial authority (INV-004)

Agent types: `FINANCIAL_ANALYST` `TREASURY_OPERATOR` `COMPLIANCE_MONITOR` `RECONCILIATION` `REPORTING` `CUSTOM`

### Payment Domain

**Core Question: Can execution leave the system?**

12 external rails declared: `ACH` `FEDNOW` `WIRE` `RTP` `CARD` `BLOCKCHAIN` `INTERNAL_TRANSFER` `STABLECOIN` `SWIFT` `SEPA` `CASH_SETTLEMENT` `FUTURE_ADAPTER`

> **Current status:** Mock ACH adapter implemented.  
> 11 rails are boundary-defined in spec.  
> None contact a live financial institution in this version.

### Governance Domain

**Core Question: Who oversees the system?**

Covers amendment process, emergency halt, governance proposals, audit authority, and constitutional change controls.

### Escrow Domain

**Core Question: Can value be conditionally held and released?**

Escrow was added through the XV.3 Constitutional Proof using YAML-only changes. The generic kernel executed escrow commands without domain-specific runtime source changes.

---

## Command Catalog

**105 commands** across 10 domains.

Every command is defined with:

- Aggregate being operated on
- Issuer types and minimum required capability
- Authorization requirements (identity + capability + scope + policy)
- Validation rules with `on_failure` actions
- Required payload fields
- Resulting success and failure events
- Constitutional gates

Every command passes through the **7-stage pipeline**:

```text
Identity Verification
    │
    ▼
Capability Check
    │
    ▼
Scope Validation
    │
    ▼
Policy Evaluation
    │
    ▼
Constitutional Compliance
    │
    ▼
Execution
    │
    ▼
Event Publication
```

> **Current status:** Identity, capability, and selected constitutional checks are active pre-execution gates. Full 7-stage pipeline is specified and partially implemented. YAML-driven command routing is on the roadmap.

---

## Event Catalog

**259 events** across 10 domains plus kernel events.

Every event carries the mandatory **21-field event envelope**:

```text
event_id              — Unique event identifier
event_name            — Catalog event type name
event_version         — Event schema version
schema_version        — Protocol schema version
aggregate             — Aggregate type
aggregate_id          — Aggregate instance identifier
source_domain         — Originating protocol domain
command_id            — Triggering command identifier
triggering_command    — Command name
causation_id          — Causal event identifier
correlation_id        — Workflow correlation identifier
actor_id              — Executing actor identifier
identity_context      — Full identity authority context
policy_decision_id    — Policy evaluation record
capability_id         — Capability grant used
timestamp             — ISO 8601 event timestamp
payload               — Event-specific data
projection_effect     — Declared projection impact
audit.constitutional_rules_referenced
audit.enforcement_actions
audit.retention_class
```

Retention classes: `permanent` `regulatory_7y` `operational_90d` `session`

**Key principle (INV-006):**  
Events do not mutate reality. Events describe reality.  
Projections interpret reality.  
If a projection disagrees with the event log, **the event log wins.**

---

## State Machines

**43 state machines** covering all domain lifecycles, defined in `05_state-machines.yaml`.

Each machine specifies:

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
```

| Domain | State Machine | States | Final States |
|---|---|---|---|
| Vault | Asset Lifecycle | 10 | REJECTED, IMPAIRED |
| Vault | Reservation Lifecycle | 6 | EXPIRED, FAILED |
| Vault | Collateral Lifecycle | 6 | RELEASED, LIQUIDATED |
| Vault | Transaction Lifecycle | 9 | CLOSED, FAILED |
| Ledger | Journal Entry Lifecycle | 6 | REJECTED |
| Ledger | Account Lifecycle | 3 | FROZEN, CLOSED |
| Treasury | Transfer Lifecycle | 11 | SETTLED, REJECTED, EXPIRED |
| Identity | Actor Lifecycle | 6 | REVOKED, ARCHIVED |
| Identity | Credential Lifecycle | 5 | REVOKED, ROTATED |
| Identity | Session Lifecycle | 4 | EXPIRED, REVOKED, TERMINATED |
| Identity | Delegation Lifecycle | 4 | EXPIRED, REVOKED |
| Policy | Evaluation Lifecycle | 6 | ARCHIVED |
| Policy | Rule Lifecycle | 4 | ARCHIVED |
| Intent | Intent Lifecycle | 9 | ARCHIVED, FAILED, CANCELLED |
| Agent | Execution Lifecycle | 6 | TERMINATED |
| Agent | Agent Lifecycle | 4 | TERMINATED |
| Payment | Payment Request Lifecycle | 12 | SETTLED, REVERSED, CANCELLED |
| Payment | Adapter Lifecycle | 4 | DISABLED |
| Governance | Proposal Lifecycle | 7 | REJECTED, EXPIRED, CANCELLED |
| Kernel | Saga Lifecycle | 6 | COMPLETED, FAILED, COMPENSATED |
| Kernel | System Health Lifecycle | 4 | HALTED |

**43 TLA+ formal specification files** are generated from these definitions for model checking.

> **Current status:** State machines are fully specified, embedded into the compiled IR, and TLA+ files are generated. The runtime CommandBus now invokes the deterministic state-machine interpreter for catalog event-triggered transitions. Full coverage for every command and saga path remains a primary v1 objective.

---

## Saga Orchestration

SOVR sagas (`09_saga-orchestration.yaml`) define **multi-domain workflow orchestration** with:

- Ordered participant steps
- Notification sequences
- Timeout and retry policies
- Failure actions
- Explicit compensation commands

Compensation model: **`SEQUENTIAL_REVERSE`**

> **Current status:** Sagas are fully specified, embedded into the compiled IR, and the runtime `SagaInterpreter` can execute the `internal_transfer_saga` through live `CommandBus` steps with sequential-reverse compensation. Broader production payload mapping for every saga definition remains on the v1 roadmap.

---

## Security Model

### Capabilities

**111 capabilities** organized by domain:

- **Scope Pattern Language:** `{resource}:{id}:{field}` with wildcard support
- **Risk Levels:** `NONE` `LOW` `MEDIUM` `HIGH` `CRITICAL`
- **Grantable By:** `governance` `human` `system` `self`
- **Delegation Depth:** 0–2 levels maximum

```text
vault.asset:{asset_id}              # Specific asset
treasury.transfer:{actor_id}:*      # All transfers for actor
ledger.entry:*:account_id={acct_id} # All entries for account
governance:proposal:*               # All governance proposals
```

Special capabilities:

- `system.internal` — Meta-capability for automated pipeline (not grantable by any actor)
- `governance.*` — Wildcard for governance actors

> **Current status:** Capability model is fully specified. Pre-execution capability gate is active. Capability grants are not backed by a persistent registry in this version — in-memory only.

### Advanced Security Features

**1. Formal Model Verification (TLA+)**  
State machines compiled to model-checkable TLA+ modules. Proves absence of deadlocks and orphaned state transitions.  
Output: `generated/verification/tla/{name}.tla`

**2. Sandboxed VEL Evaluator**  
Policy constraints compiled to static ASTs processed by a deterministic, sandboxed, Turing-incomplete interpreter. Zero risk of prototype pollution or arbitrary code execution.  
Output: `generated/src/policy/vel-evaluator.ts`

**3. Constitutional Guardrail Command Bus**  
Intercepting bus that checks state mutations against INV-001 and INV-002 before committing.  
Output: `generated/src/execution/guardrail-bus.ts`

**4. Agent Governor Sandbox SDK**  
All agent execution passes through `AgentSandbox`. Tracks financial quotas, records LLM prompts via SHA-256 audit logs, triggers escalation at 90% threshold.  
Output: `generated/src/sdk/agent-sandbox.ts`

> **Current status:** All four security components are generated as skeletons. Full wiring into the runtime execution path is in progress.

### Known Security Boundaries

| Boundary | Current Status |
|---|---|
| Event log tamper resistance | In-process only — JSON file mutable at filesystem level |
| Capability grant durability | In-memory only — not persistent across restarts |
| Key management | Not implemented |
| Multi-party authorization | Specified — not implemented |
| Audit certification | Specified — runtime enforcement in progress |

**SOVR is a reference implementation.**  
It has not been security audited.  
It should not be used to process real financial transactions in its current state.

---

## The Compiler

The SOVR compiler (`@sovr/compiler v0.6.0`) is a deterministic, content-addressed build system for financial protocol specifications.

### Compilation Pipeline

```text
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  PARSE   │──▶│ VALIDATE │──▶│ RESOLVE  │──▶│TRANSFORM │──▶│ GENERATE │──▶│  VERIFY  │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
```

| Stage | Actions | On Error |
|---|---|---|
| PARSE | YAML parse, schema validation, syntax check | Abort |
| VALIDATE | Reference integrity, cross-file validation, duplicate detection | Abort |
| RESOLVE | Dependency graph, topological sort, type resolution | Abort |
| TRANSFORM | Template selection, code generation, namespace assignment | Abort |
| GENERATE | File write, directory creation, config generation | Abort |
| VERIFY | TypeScript compile check, circularity check, artifact count | Report |

### Pass Registry

20 compilation passes declared across 8 phases:

```text
DISCOVERY → PARSE → VALIDATE → RESOLVE →
TRANSFORM → GENERATE → CERTIFY → REPORT
```

Each pass has deterministic execution, DAG-enforced ordering via `depends_on`, a certification level, and error codes from the error taxonomy.

> **Current status:** The named pass runner (PASS-001 through PASS-020) is implemented in source with registry loading, DAG ordering, deterministic execution, and fail-closed ERROR/FATAL handling. Several pass bodies still delegate to the existing v0.2 compiler stages and require deeper certification hardening before v1.

### Output Artifacts

Every successful compilation produces generated protocol artifacts plus compiler outputs:

| # | Artifact | Output Pattern |
|---|---|---|
| 1 | TypeScript Types | `src/types/{domain}/{domain}.types.ts` |
| 2 | Command Classes | `src/commands/{domain}/{domain}.commands.ts` |
| 3 | Event Classes | `src/events/{domain}/{domain}.events.ts` |
| 4 | OpenAPI 3.1 Spec | `generated/openapi.yaml` |
| 5 | Prisma Schema | `generated/prisma/schema.prisma` |
| 6 | Kafka Topic Config | `generated/config/kafka/topics.yaml` |
| 7 | Redis Stream Config | `generated/config/redis/streams.yaml` |
| 8 | Capability Engine Skeleton | `src/security/capability-engine.ts` |
| 9 | Policy Engine Skeleton | `src/policy/engine.ts` |
| 10 | Execution Context Skeleton | `src/execution/execution-context.ts` |
| 11 | Guardrail Bus Skeleton | `src/execution/guardrail-bus.ts` |
| 12 | VEL Evaluator Skeleton | `src/policy/vel-evaluator.ts` |
| 13 | Agent Sandbox Skeleton | `src/sdk/agent-sandbox.ts` |
| 14 | TLA+ Models | `generated/verification/tla/{name}.tla` |
| 15 | Protocol Topology | `generated/protocol-topology.json` |
| 16 | Topology Docs | `generated/docs/topology.md` |
| C1 | Compiler Manifest | `generated/compiler-manifest.yaml` |
| C2 | Canonical IR | `generated/sovr-ir.json` |
| C3 | Registry Package | `dist/sovr-runtime-v0.6.0-abi-v1.svr` |
| C4 | Compiler Certification | `generated/compiler-certification.json` |

> **Important:** Generated TypeScript artifacts are currently output-only. They are not fully imported or executed by the reference runtime. Wiring generated artifacts into the runtime is a primary v1 objective.

### The Canonical IR

`generated/sovr-ir.json` — the canonical Intermediate Representation of the compiled protocol.

- Human-readable canonical JSON
- Contains: metadata, typed protocol nodes, graph edges, diagnostics
- IR hash: SHA-256 over canonical JSON of IR nodes, edges, protocol version, and compiler version
- Current metrics: **592 nodes, 459 edges**

### Reproducibility (R1–R10)

| Rule | Description |
|---|---|
| R1 | Closed frontier — only declared inputs are read |
| R2 | Sorted lists — all collections sorted for deterministic ordering |
| R3 | Canonical serialization — NFC Unicode, LF line endings |
| R4 | No randomness — no Math.random(), no UUID generation during compile |
| R5 | No environment leakage — no process.env, no hostname, no username |
| R6 | Stable dispatch order — generators run in registry-declared order |
| R7 | Deterministic paths — output paths derived from input, not timestamps |
| R8 | Version included — compiler version included in build hash |
| R9 | Byte-identical manifest — `build_hash = sha256(sorted(input_hashes) + ir_hash + sorted(output_hashes) + compiler_version + registry_versions)` |
| R10 | Environmental isolation — compile in clean environment |

**Verified build hash:** `b7d8221b0d7359a7733791d00cf32622df7b707ff4171c0c1b541d91d7568492`

Identical YAML inputs produce identical build hashes. This is verified. This is the unfakeable proof of protocol integrity.

---

## The Runtime

The SOVR reference runtime (`@sovr/runtime v0.6.0`) is the execution environment for compiled protocol specifications.

### What the Runtime Does Today

```text
✅ Accepts commands through typed CommandBus
✅ Enforces identity presence and type pre-execution
✅ Resolves capability grants and scope pre-execution
✅ Evaluates limited policy checks pre-execution
✅ Enforces INV-002 (double-entry balance) pre-execution
✅ Emits events to append-only in-process event store
✅ Rebuilds 16 projections from event log on startup
✅ Exposes HTTP API (Fastify) with generated OpenAPI contract
✅ Publishes events to Kafka and Redis (non-authoritative)
✅ Boots through 8-runlevel sequence with attestation
✅ Verifies build hash chain on startup
✅ Routes catalog commands through GuardrailBus before event persistence
✅ Uses compiled-IR state machine definitions for initial and event-triggered transitions
✅ Persists state-machine emitted events through EventFactory → EventStore
```

### What the Runtime Does Not Do Yet

```text
🔧 Execute complete YAML-driven routing for all 105 commands without compatibility fallbacks
🔧 Interpret saga orchestration from spec
🔧 Wire all generated TypeScript artifacts into execution
🔧 Connect to a production-durable event store
🔧 Enforce all 10 constitutional invariants at runtime
🔧 Harden individual PASS-001 through PASS-020 contracts beyond the initial runner
🔧 Extend fail-closed compilation coverage across every diagnostic path
📋 Connect to real financial rails
📋 Support multi-node distributed execution
📋 Implement standards-complete DID/VC identity
📋 Implement production key management
```

### Implementation Boundary

> The YAML corpus is authoritative for the protocol.  
> The reference runtime does not yet interpret all compiled artifacts. It contains handwritten execution code for the currently runnable command, event, projection, and adapter paths.  
>
> **The primary engineering objective is to close this gap:** Replace handwritten handlers with YAML-compiled, spec-driven execution.

### The Event Log

All financial state in SOVR derives from an append-only event log.

| Property | Value |
|---|---|
| Location | `generated/data/sovr-events.json` |
| Append enforcement | In-process API — `EventStore` exposes no mutation or deletion |
| Tamper resistance | In-process only — JSON file is mutable at filesystem level |
| Envelope fields | 21 (18 top-level + 3 audit subfields) |
| Schema validator | Not currently enforced at persistence layer |

### Projections

**16 materialized projections** derived from the event log.

- Materialized in memory on the write path after event append
- Rebuilt from genesis on startup
- Rebuildable on demand via `ProjectionEngine.rebuildFromGenesis()`
- Never authoritative — event log always wins (INV-006)

---

## Boot Sequence

SOVR implements an **8-runlevel boot sequence** modeled after Linux kernel initialization.

| Runlevel | Linux Analogy | SOVR Stage | What It Does |
|---|---|---|---|
| 0 | BIOS POST | FIRMWARE_POST | SHA-256 self-test, env isolation, Node ≥20 check |
| 1 | GRUB + Secure Boot | BOOTLOADER | Verify compiler-manifest build hash, tamper detection |
| 2 | Kernel decompress | KERNEL_INIT | Load 10 invariants, event envelope, authority model |
| 3 | Mount root fs | CORE_DOMAINS | Vault, Ledger, Treasury — topological order |
| 4 | Load LSM/SELinux | SECURITY_SUBSYSTEM | Identity, Policy, Intent, Agent |
| 5 | Load drivers | EXECUTION_BOUNDARY | Payment rails, Hybrid boundaries, Oracles |
| 6 | Mount /proc | INTERPRETATION | Projection engine — 16 read models rebuilt from genesis |
| 7 | systemd → graphical | USERLAND | Runtime SDK, OpenAPI endpoints, boot attestation |

**Frontend gate:** The frontend must not accept financial commands until Runlevel 7 returns `HEALTHY`.

### Boot Attestation

```text
boot_hash = sha256(
  build_hash +
  boot_log_hash +
  boot_timings_hash +
  final_health
)
```

Output files:

```text
generated/boot.log               ← Human-readable boot log
generated/boot-manifest.json     ← Stages, timings, events, health
generated/boot-attestation.json  ← boot_hash + verification instructions
```

The boot hash chain proves the kernel booted from the exact frozen YAML specification. `build_hash` in boot attestation must match `build_hash` in compiler manifest.

---

## External Boundaries

SOVR defines external system boundaries in `hybrid-boundary.yaml`.

| Rail / System | Declared | Implemented |
|---|---|---|
| ACH | ✅ | 🔧 Mock adapter — does not contact live institution |
| FedNow | ✅ | 📋 Not implemented |
| Wire | ✅ | 📋 Not implemented |
| RTP | ✅ | 📋 Not implemented |
| Card Networks | ✅ | 📋 Not implemented |
| Blockchain (ETH/Base/Polygon) | ✅ | 📋 Not implemented |
| Stablecoin | ✅ | 📋 Not implemented |
| SWIFT | ✅ | 📋 Not implemented |
| SEPA | ✅ | 📋 Not implemented |
| Price Oracles | ✅ | 📋 Not implemented |

**Key rule:** Boundary adapters emit events only. They cannot mutate constitutional state.

---

## Getting Started

### Prerequisites

```text
Node.js >= 20.0.0
npm >= 10.0.0
TypeScript >= 5.0.0
```

### Install

```bash
git clone https://github.com/StavoMidnite661/SOVR-Protocol.git
cd SOVR-Protocol
```

### Compile the Protocol

```bash
cd packages/compiler
npm install
npm run build
cd ../..

# Compile YAML → IR + artifacts + manifest
node packages/compiler/dist/cli.js compile

# Verify byte-identical reproducibility
node packages/compiler/dist/cli.js verify
# ✓ Reproducible build verified: b7d8221b...

# Boot kernel (8 runlevels + attestation)
node packages/compiler/dist/cli.js boot
```

### Run the Reference Runtime

```bash
cd packages/runtime
npm install
npm run build

# Boot Protocol API Service on :3001
PORT=3001 node dist/server/index.js
# → SYSTEM HEALTHY — 8 runlevels complete
# → 16 projections rebuilt from genesis
# → API at http://localhost:3001/api/v1
```

### Verify the Chain

```bash
# Health gate
curl http://localhost:3001/health

# Compiler manifest build hash
curl http://localhost:3001/api/v1/manifest | grep build_hash

# Boot attestation hash (must match manifest)
curl http://localhost:3001/api/v1/boot-attestation | grep build_hash
```

### Execute a Demo Flow

```bash
# 1. Create session
curl -X POST http://localhost:3001/api/v1/identity/session \
  -H "Content-Type: application/json" \
  -d '{"actor_id":"alice","actor_type":"human"}'
# → { jwt: "..." }

# 2. Grant capability
curl -X POST http://localhost:3001/api/v1/capability/grant \
  -H "Authorization: Bearer {jwt}" \
  -d '{"capability_id":"vault.asset.register","scope":"vault.asset:*"}'

# 3. Register asset (vault)
curl -X POST http://localhost:3001/api/v1/vault/asset \
  -H "Authorization: Bearer {jwt}" \
  -d '{"commandName":"asset.register","capability_id":"vault.asset.register"}'

# 4. Post ledger entry (INV-002 enforced — will reject if unbalanced)
curl -X POST http://localhost:3001/api/v1/ledger/entry \
  -H "Authorization: Bearer {jwt}" \
  -d '{"commandName":"ledger.entry.post"}'

# 5. Query event log (source of truth)
curl 'http://localhost:3001/api/v1/events?domain=vault'

# 6. Query projection (derived — event log wins per INV-006)
curl http://localhost:3001/api/v1/projections/vault_asset_view
```

### SDK Integration

```typescript
import { SOVRClient } from '@sovr/runtime/src/sdk/client.ts'

// Always wait for HEALTHY before accepting financial commands
const health = await fetch('http://localhost:3001/health').then(r => r.json())
if (health.final_health !== 'HEALTHY') {
  throw new Error('Kernel not healthy — cannot accept financial commands')
}

// Verify unfakeable build hash chain
const manifest = await fetch('http://localhost:3001/api/v1/manifest').then(r => r.json())
const attestation = await fetch('http://localhost:3001/api/v1/boot-attestation').then(r => r.json())
// manifest.build_hash === attestation.build_hash === b7d8221b...

const client = new SOVRClient({
  apiUrl: 'http://localhost:3001/api/v1',
  buildHash: manifest.build_hash
})
```

---

## Current State vs Roadmap

**Protocol Specification:** `v1.0.0` — Complete and frozen.  
**Compiler + Runtime:** `v0.6.0` — Reference implementation. Active development.

### What Works Today

| Capability | Status | Notes |
|---|---|---|
| YAML corpus compilation (244 files) | ✅ | 100% valid |
| Deterministic SHA-256 build hash | ✅ | Verified byte-identical |
| Canonical IR (592 nodes, 459 edges) | ✅ | Human-readable JSON |
| Generated artifacts | ✅ | Output types generated |
| TLA+ formal specs (21 machines) | ✅ | Generated — not yet model-checked |
| 8-runlevel boot sequence | ✅ | Cryptographic attestation chain |
| Append-only event log | ✅ | In-process enforcement |
| 16 materialized projections | ✅ | In-memory, rebuilt from genesis |
| HTTP API (Fastify + OpenAPI) | ✅ | 44 endpoint paths |
| Pre-execution identity gate | ✅ | Active |
| Pre-execution capability gate | ✅ | Active |
| INV-002 double-entry enforcement | ✅ | Active — GuardrailBus rejects unbalanced entries before persistence |
| GuardrailBus in CommandBus path | ✅ | Commands pass through `executeSecure()` before event persistence |
| Compiled-IR state machine execution | ✅ | `StateMachineInterpreter` reads full state/transition bodies from IR |
| EventFactory → EventStore persistence | ✅ | Transition-emitted events are appended with full event envelopes |
| Atomic state + event commit | ✅ | StateRegistry rolls back if EventStore batch append fails |
| Command lifecycle coverage report | ✅ | 97 machine-covered + 8 lifecycle-exempt + 0 uncovered |
| StateRegistry rebuild | ✅ | Rebuilt from event log before command API accepts requests |
| Guard condition AST evaluator | ✅ | Minimal Turing-incomplete VEL AST evaluator for comparisons, booleans, exists, IN |
| PASS-008 guard validation | ✅ | Compile-time parse validation for state-machine guards; invalid syntax fails closed |
| PostgreSQL event store interface | ✅ | Interface, adapter, idempotent migration, and DATABASE_URL boot selection added; JSON remains CI/dev default |
| Saga IR enrichment | ✅ | 16 saga definitions embedded with steps, compensation, timeouts |
| Saga live CommandBus execution | ✅ | `internal_transfer_saga` executes Vault + Ledger steps through CommandBus and compensates via Vault release on failure |
| Demo flow (session → capability → asset → ledger → event) | ✅ | End-to-end verified |
| Mock ACH adapter | ✅ | Does not contact live institution |

### In Progress

| Capability | Target | Notes |
|---|---|---|
| Pass runner certification hardening | v0.5.0 | Initial DAG runner exists; pass contracts need deeper certification |
| Full invariant enforcement (INV-001–010) | v0.5.0 | All 10 at runtime |
| Generated TypeScript type consumption | v0.6.0 | Generated domain types/routes used directly by runtime handlers |
| Strict lifecycle expansion | v1.0.0 | 8 lifecycle-exempt commands need first-class lifecycle machines or durable exemptions |
| Production saga command payload orchestration | v1.0.0 | Saga interpreter exists; live domain payload mapping needs hardening |

### Roadmap

| Milestone | Capability | Version |
|---|---|---|
| M4 | Atomic critical path + lifecycle coverage + registry rebuild + guard AST | v0.4.0 |
| M5 | Full pass certification + generated TypeScript consumption | v0.5.0 |
| M5 | Expand lifecycle machines for currently exempt commands | v0.5.0 |
| M5 | Saga runtime orchestration | v0.5.0 |
| M5 | Acceptance test suite (60 tests, 95% coverage) | v0.5.0 |
| M6 | Production-durable event store (PostgreSQL) | v0.6.0 |
| M6 | Standards-complete DID/VC identity | v0.6.0 |
| M7 | Real rail adapter (ACH) | v0.7.0 |
| M7 | Production key management | v0.7.0 |
| M8 | Distributed multi-node determinism | v0.8.0 |
| M8 | Formal verification integration (TLA+ model checking) | v0.8.0 |
| M9 | Security audit | v1.0.0 |
| M9 | Production deployment | v1.0.0 |

---

## Repository Structure

```text
SOVR-Protocol/
│
├── 📜 PROTOCOL SPECIFICATION (Root YAML — 15 files)
│   ├── 00_protocol-manifest.yaml     ← Entry point: layers, domains, build phases
│   ├── 01_constitution.yaml          ← Supreme law: 10 invariants, authority, enforcement
│   ├── 02_domain-model.yaml          ← 48 entities across 10 domains
│   ├── 03_command-catalog.yaml       ← 105 commands with validation rules
│   ├── 04_event-catalog.yaml         ← 259 events with full envelope
│   ├── 05_state-machines.yaml        ← 43 state machines
│   ├── 08_security-capabilities.yaml ← 111 capabilities + scope language
│   ├── 09_saga-orchestration.yaml    ← Saga definitions + compensation model
│   ├── 11_governance-amendments.yaml ← Amendment process
│   ├── 12_domain-contracts.yaml      ← Inter-domain coupling contracts
│   ├── 13_compiler-adr.yaml          ← 12 architectural decision records
│   ├── compiler.yaml                 ← Compiler specification
│   ├── hybrid-boundary.yaml          ← Blockchain + oracle boundaries
│   ├── projection-engine.yaml        ← 15 read model definitions
│   └── acceptance-tests.yaml         ← 60 acceptance tests
│
├── 📁 domains/                       ← Per-domain detailed specifications
│   ├── agent.yaml
│   ├── governance.yaml
│   ├── identity.yaml
│   ├── intent.yaml
│   ├── ledger.yaml
│   ├── payment.yaml
│   ├── policy.yaml
│   ├── treasury.yaml
│   └── vault.yaml
│
├── 📁 compiler/                      ← Compiler contracts and registries
│   ├── PASS_REGISTRY.yaml            ← 20 compilation passes (DAG-ordered)
│   ├── GENERATOR_REGISTRY.yaml       ← 9 code generators
│   ├── SEMANTIC_COMPILER_CONTRACT.yaml
│   ├── BUILD_MANIFEST.yaml           ← Reproducibility rules R1–R10
│   └── ERROR_TAXONOMY.yaml           ← Diagnostic codes
│
├── 📁 packages/
│   ├── compiler/                     ← @sovr/compiler v0.6.0
│   │   ├── src/
│   │   │   ├── boot/                 ← Boot sequence implementation
│   │   │   ├── generators/           ← Code generators
│   │   │   ├── ir/                   ← Intermediate representation
│   │   │   ├── pipeline/             ← Parse + validate pipeline
│   │   │   └── utils/                ← Hash, YAML loader
│   │   └── dist/                     ← Compiled JavaScript
│   │
│   └── runtime/                      ← @sovr/runtime v0.6.0
│       ├── src/
│       │   ├── adapters/             ← Boundary adapters (mock ACH active)
│       │   ├── execution/            ← Execution context and interpreters
│       │   ├── server/               ← Fastify HTTP server
│       │   └── sdk/                  ← SOVRClient SDK
│       └── generated/                ← Runtime generated manifests
│
├── 📁 generated/                     ← Compiler output artifacts
│   ├── sovr-ir.json                  ← Canonical IR (592 nodes, 459 edges)
│   ├── compiler-manifest.yaml        ← Build hash + artifact inventory
│   ├── boot.log                      ← Boot sequence log
│   ├── boot-attestation.json         ← Cryptographic boot proof
│   ├── boot-manifest.json            ← Boot stage timings and health
│   ├── openapi.yaml                  ← Generated API contract
│   ├── prisma/schema.prisma          ← Generated data model
│   ├── config/kafka/topics.yaml      ← Generated event topics
│   ├── config/redis/streams.yaml     ← Generated stream config
│   ├── verification/tla/             ← 43 TLA+ formal specifications
│   ├── src/                          ← Generated TypeScript (output-only)
│   └── data/sovr-events.json         ← Append-only event log
│
├── 📁 protocol/                      ← Governance draft registries
├── 📁 certification/                 ← Certification artifacts
├── 📁 docs/                          ← Human-facing documentation
├── 📁 containers/                    ← Domain container metadata
├── 📁 management/                    ← Project status and milestones
├── 📁 deployment/                    ← Docker compose configurations
├── 📁 example-frontend/              ← Example frontend integration
├── 📁 snapshots/                     ← Versioned canonical snapshots
├── 📁 .github/workflows/             ← CI/CD pipelines
└── 📄 .env.example                   ← Environment variable template
```

---

## Verified Metrics

| Metric | Value | Verified |
|---|---|---|
| YAML files parsing | 244/244 (100%) | ✅ |
| Protocol YAML inputs | 39 | ✅ |
| Commands | 105 | ✅ |
| Events | 259 | ✅ |
| State machines | 43 | ✅ |
| Constitutional invariants | 10 | ✅ |
| Capabilities | 111 | ✅ |
| Domains | 10 | ✅ |
| Entities | 48 | ✅ |
| IR nodes | 592 | ✅ |
| IR edges | 459 | ✅ |
| TLA+ models generated | 43 | ✅ |
| Registry JSON files | 11 | ✅ |
| Generated artifacts | 104 | ✅ |
| Projections | 16 | ✅ |
| OpenAPI paths | 44 | ✅ |
| Boot runlevels | 8/8 HEALTHY | ✅ |
| Boot self-test | 7/7 PASS | ✅ |
| Integration tests | 16/16 PASS | ✅ |
| Purity violations | 0 | ✅ |
| Manual runtime bridges | 0 | ✅ |
| Generated behavior | 100% | ✅ |
| Registry ABI | v1 | ✅ |
| Constitutional proof | XV3-ESCROW-PROOF | ✅ |
| Build hash | `b7d8221b0d7359a7733791d00cf32622df7b707ff4171c0c1b541d91d7568492` | ✅ |
| Byte-identical reproducibility | Verified | ✅ |
| Compiler diagnostics | 0 errors, 71 warnings | ✅ |

---

## Audit Reports

All audit reports are in `docs/reports/`, newest first:

| Report | Date | Status |
|---|---|---|
| `VERIFIED_CLAIMS_AUDIT_2026-07-23.md` | 2026-07-23 | **Authoritative** |
| `WALL_TO_WALL_AUDIT_2026-07-22.md` | 2026-07-22 | Superseded |
| `SOVR_FULL_AUDIT_2026-07-21.md` | 2026-07-21 | Superseded |
| `VERIFICATION_REPORT.md` | 2026-07-20 | Superseded |
| `COMPLETE_VERIFICATION_AUDIT.md` | 2026-07-19 | Superseded |
| `AUDIT_REPORT_2026-07-18.md` | 2026-07-18 | Superseded |

Canonical current state: `management/PROJECT_STATUS_2026-07-22.yaml`

---

## Contributing

SOVR uses a constitution-governed development model.

### Highest Priority Contributions

| Priority | Area | Description |
|---|---|---|
| 🔴 Critical | Pass Runner Hardening | Expand the initial PASS-001 through PASS-020 runner into fully certified pass contracts per `compiler/PASS_REGISTRY.yaml` |
| 🔴 Critical | State Machine Coverage | Extend CommandBus state-machine routing to all 105 commands and saga paths |
| 🔴 Critical | Fail-Closed Enforcement | Extend ERROR/FATAL halt behavior across every compiler diagnostic path and prevent partial artifact output |
| 🟡 High | Invariant Enforcement | Wire all 10 constitutional invariants into the runtime execution path |
| 🟡 High | Generated Artifact Wiring | Connect compiler-generated types, routes, and aggregates into runtime execution |
| 🟢 Medium | Acceptance Test Suite | Implement and verify 60 declared acceptance tests to 95% coverage |
| 🟢 Medium | Production Event Store | Replace JSON file with PostgreSQL-backed durable event store |

### Development Rules

1. All state changes must emit events (INV-001)
2. All financial mutations must balance (INV-002)
3. No actor may exceed granted authority (INV-003)
4. Agents may never modify financial authority (INV-004)
5. Every action must be auditable (INV-005)
6. If it is not in the spec, it does not get compiled
7. If it does not compile, it does not run

### Process

```bash
# 1. Fork the repository
# 2. Create a feature branch
# 3. Ensure all YAML specifications pass validation
node packages/compiler/dist/cli.js compile

# 4. Verify byte-identical build hash
node packages/compiler/dist/cli.js verify

# 5. Submit pull request with certification evidence
```

---

## License

Proprietary — All rights reserved.

---

## Protocol Version

| Component | Version | Status |
|---|---|---|
| Protocol Specification | `1.0.0` | Frozen |
| Compiler | `0.6.0` | Active development |
| Runtime | `0.6.0` | Active development |

---

> **SOVR Financial OS**  
> *Speed never outranks safety. Autonomy never outranks authority.*

[![Protocol FROZEN](https://img.shields.io/badge/Protocol-FROZEN-blue)](https://img.shields.io/badge/Protocol-FROZEN-blue)
[![Constitution](https://img.shields.io/badge/Constitution-v1.0.0-purple)](https://img.shields.io/badge/Constitution-v1.0.0-purple)
[![Domains](https://img.shields.io/badge/Domains-10-green)](https://img.shields.io/badge/Domains-10-green)
[![Commands](https://img.shields.io/badge/Commands-105-green)](https://img.shields.io/badge/Commands-105-green)
[![Events](https://img.shields.io/badge/Events-259-green)](https://img.shields.io/badge/Events-259-green)
[![Invariants](https://img.shields.io/badge/Invariants-10-red)](https://img.shields.io/badge/Invariants-10-red)
[![State Machines](https://img.shields.io/badge/State%20Machines-43-orange)](https://img.shields.io/badge/State%20Machines-43-orange)
[![Build](https://img.shields.io/badge/Build-Reproducible-brightgreen)](https://img.shields.io/badge/Build-Reproducible-brightgreen)
