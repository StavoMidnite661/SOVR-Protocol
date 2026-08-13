<!--
HISTORICAL / REMEDIATION RECORD

This file does not describe the current SOVR architecture.
See docs/ARCHITECTURE.md for the implementation that exists now.
-->

# SOVR-GENESIS-000002-PHASE10B-PREPARATION-DIRECTIVE

## Phase 10B — Controlled Simulation Expansion Readiness & Runtime Certification

### Directive Classification

**Phase:** 10B Preparation
**Mode:** LOCAL DEVELOPMENT ONLY
**Production Traffic:** DISABLED
**Asset Movement:** DISABLED
**External Integrations:** DISABLED

**Objective:**

Do not expand simulation scenarios yet.

The objective of Phase 10B preparation is to prove that the newly validated compiler-authority execution model is stable under broader runtime conditions before introducing more complex economic, treasury, settlement, or payment simulations.

Phase 10A proved:

> The compiler can generate executable authority.

Phase 10A.1 proved:

> The compiler authority boundary cannot be bypassed silently.

Phase 10B preparation must now prove:

> The runtime can execute complex protocol behaviors while preserving authority, determinism, auditability, and state integrity.

---

# TASK 1 — Perform Authority Chain End-to-End Trace Audit

## Objective

Produce a complete execution trace from source definition to final event persistence.

For every existing simulation scenario:

```
SIM-001
SIM-002
SIM-003
```

produce:

```
Scenario YAML
      ↓
Compiler Input
      ↓
Compiler IR Node
      ↓
Generated Registry Entry
      ↓
Simulation Runner Input
      ↓
Kernel Executor Command Envelope
      ↓
Capability Validation
      ↓
Execution Gate Validation
      ↓
State Machine Validation
      ↓
Event Envelope
      ↓
Event Store Entry
      ↓
Projection Update
      ↓
Merkle Audit Result
```

## Deliverable

Create:

```
governance/audit/
PHASE10B_AUTHORITY_CHAIN_TRACE_CERTIFICATE.yaml
```

Required fields:

```yaml
phase: PHASE10B_PREPARATION

scenarios:
  SIM-001:
    compiler_source_verified: true
    runtime_authority_verified: true
    event_lineage_verified: true
    projection_verified: true
    merkle_verified: true

status: PASS
```

---

# TASK 2 — Freeze Simulation Registry ABI

## Objective

The generated simulation registry has now become an authority artifact.

Treat it like a protocol interface.

Create:

```
governance/simulation/
SIMULATION_REGISTRY_ABI_v1.yaml
```

Define:

```yaml
registry:
  version: v1

required_fields:
  - scenario_id
  - name
  - actors
  - commands
  - integrity_hash

command_requirements:
  command_name:
    required: true

  payload:
    required: true

integrity:
  algorithm: SHA256
  canonicalization: JSON
```

The runtime must reject registry files that violate this schema.

---

# TASK 3 — Add Registry Version Enforcement

Current:

```
generated/simulation/scenarios.registry.json
```

contains:

```json
{
 "abi_version":"v1"
}
```

The runtime must verify:

```
supported ABI versions:
[
 "v1"
]
```

Anything else:

Reject:

```
UNSUPPORTED_SIMULATION_REGISTRY_ABI
```

Add test:

```
registry-version.test.ts
```

Cases:

PASS:

```
abi_version=v1
```

FAIL:

```
abi_version=v2
```

FAIL:

missing abi_version

---

# TASK 4 — Add Scenario Lifecycle Validation

Currently the simulation validates execution authority.

Now validate lifecycle authority.

Every scenario must declare:

```yaml
lifecycle:
  initial_state:
  terminal_state:
```

The runner must verify:

1. Scenario starts from declared initial state
2. Commands transition through valid states
3. Scenario ends in declared terminal state

Example:

```
VAULT_CREATED
      |
      |
FUNDED
      |
      |
SETTLED
```

Invalid:

```
VAULT_CREATED
      |
      |
SETTLED
```

without funding transition.

Reject:

```
INVALID_STATE_TRANSITION
```

---

# TASK 5 — Event Lineage Certification

Phase 10A.1 validated command authority.

Now validate event authority.

For every simulation run:

Generate:

```
event_lineage_report.json
```

Example:

```json
{
 "scenario":"SIM-001",

 "events":[
 {
   "event_id":"...",
   "command_id":"...",
   "correlation_id":"...",
   "causation_id":"..."
 }
 ],

 "orphan_events":0,

 "broken_chains":0
}
```

Requirements:

```
orphan_events = 0

broken_chains = 0
```

Anything else fails certification.

---

# TASK 6 — Projection Consistency Validation

The simulation currently proves:

```
Command
 ↓
Event
```

Now prove:

```
Event
 ↓
Projection
 ↓
State
```

For each simulation:

Capture:

Before:

```json
{}
```

After:

```json
{
 vault_balance:"1000",
 treasury_state:"APPROVED"
}
```

Verify:

Projection state is reproducible from events only.

Procedure:

1. Execute simulation
2. Delete projection state
3. Replay events
4. Rebuild projection
5. Compare hashes

Expected:

```
projection_hash_before
=
projection_hash_after
```

Create:

```
projection-replay.test.ts
```

---

# TASK 7 — Remove Remaining Manual Authority Assumptions

Perform repository audit.

Search:

```
grep -R "if command_name"
grep -R "switch(command)"
grep -R "scenario."
grep -R "yaml."
```

Allowed:

Compiler layer:

```
packages/compiler/**
```

Not allowed:

Runtime:

```
packages/runtime/src/simulation/**
packages/runtime/src/execution/**
```

Create:

```
PHASE10B_RUNTIME_AUTHORITY_AUDIT.yaml
```

Containing:

```yaml
manual_command_logic_found:false
manual_yaml_execution:false
registry_dependency_verified:true
```

---

# TASK 8 — Establish Phase 10B Simulation Dataset

Do NOT create random scenarios.

Create scenarios based on existing protocol domains.

Required:

## SIM-004

### Vault Lifecycle

Flow:

```
vault.create
      ↓
vault.asset.register
      ↓
vault.transaction.fund
      ↓
vault.balance.verify
```

## SIM-005

### Treasury Approval Lifecycle

Flow:

```
treasury.transfer.request
      ↓
treasury.transfer.authorize
      ↓
treasury.transfer.execute
```

## SIM-006

### Accounting Integrity

Flow:

```
ledger.entry.create
      ↓
ledger.entry.post
      ↓
projection.rebuild
      ↓
audit.verify
```

All scenarios must:

* originate from YAML
* compile through compiler
* produce registry entry
* execute through KernelExecutor
* produce Merkle audit

---

# TASK 9 — Full Certification Command

Create:

```
npm run certify:phase10b
```

Execution:

```
npm run compile

npm run verify:simulation

npm run test:phase10b

npm run audit:authority

npm run certify:determinism
```

Final output:

```
SOVR PHASE 10B CERTIFICATION

Compiler Authority        PASS
Registry Integrity        PASS
Lifecycle Validation      PASS
Event Lineage             PASS
Projection Replay         PASS
Deterministic Execution   PASS
Authority Audit           PASS

STATUS: READY FOR CONTROLLED SIMULATION
```

---

# TASK 10 — Create Phase 10B Readiness Certificate

Create:

```
governance/releases/

SOVR-GENESIS-000002_PHASE10B_READINESS_CERTIFICATE.yaml
```

Must contain:

```yaml
phase: PHASE10B

compiler_authority:
 verified:true

runtime_authority:
 verified:true

event_integrity:
 verified:true

projection_integrity:
 verified:true

determinism:
 verified:true

production_enabled:false

status:
 READY_FOR_CONTROLLED_SIMULATION
```

---

# Important Constraint

Do NOT:

* connect payment rails
* enable ACH
* connect external databases
* deploy contracts
* activate tokens
* create production wallets
* introduce external actors

Phase 10B is not deployment.

Phase 10B is proving:

> "A governed protocol execution environment can simulate economic behavior deterministically while preserving constitutional authority."

---

## Completion Criteria

Phase 10B preparation is complete only when:

```
npm run certify:phase10b
```

returns:

```
PASS
```

with:

* compiler authority verified
* registry ABI frozen
* lifecycle enforcement active
* event lineage certified
* projection replay deterministic
* authority audit clean
* new scenarios compiled
* zero bypass paths discovered

---

This is the point where the agent should stop adding features and start proving the system's **execution trust boundary**. The biggest risk now is not missing functionality; it is accidentally creating a second hidden authority path while expanding capabilities.
