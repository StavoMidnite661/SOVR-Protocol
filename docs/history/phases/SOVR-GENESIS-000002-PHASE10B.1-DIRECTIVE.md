<!--
HISTORICAL / REMEDIATION RECORD

This file does not describe the current SOVR architecture.
See docs/ARCHITECTURE.md for the implementation that exists now.
-->

# SOVR-GENESIS-000002-PHASE10B.1-DIRECTIVE

# Phase 10B.1 — Runtime Authority Boundary Remediation & Certification Hardening

**Repository:** `StavoMidnite661/SOVR-Protocol`

**Protocol Version:** v1.0.0 FROZEN

**Implementation Version:** v0.6.0

**Environment:** LOCAL DEVELOPMENT ONLY

**Production Traffic:** DISABLED

**Asset Movement:** DISABLED

**External Integrations:** DISABLED

---

# 1. Mission Statement

Phase 10B preparation identified a critical architectural inconsistency.

Phase 10A established:

```
YAML Source
      ↓
Compiler
      ↓
Generated Authority Registry
      ↓
Runtime Execution
```

Phase 10A.1 verified:

```
Generated Authority Cannot Be Silently Modified
```

However, Phase 10B preparation discovered:

```
Runtime Command Path
        ↓
Raw YAML Loading
        ↓
Manual Interpretation
        ↓
Execution
```

This creates a second authority path.

This violates the governing principle:

> Runtime behavior must originate from compiler-generated authority artifacts.

Phase 10B.1 exists exclusively to remove this inconsistency.

No new simulations.
No new domains.
No external integrations.

This phase is architectural hardening only.

---

# 2. Phase 10B.1 Completion Objective

At completion:

The following statement must be provable:

> "The SOVR runtime has exactly one authority source: compiler-generated artifacts."

The runtime must no longer interpret:

* command definitions
* event definitions
* capability definitions
* policy definitions
* state transition definitions

directly from YAML.

---

# TASK 1 — CommandBus Authority Migration

## Objective

Remove raw YAML authority loading from:

```
packages/runtime/src/server/commandBus.ts
```

Current violation:

```typescript
yaml.load(
 fs.readFileSync(
   "03_command-catalog.yaml"
 )
)
```

This must be eliminated.

---

## Required Architecture

Before:

```
CommandBus

      ↓

03_command-catalog.yaml

      ↓

Runtime Behavior
```

After:

```
CommandBus

      ↓

generated/registries/commands.registry.json

      ↓

Kernel Executor

      ↓

Runtime Behavior
```

---

## Implementation Requirements

Create:

```
packages/runtime/src/authority/
```

with:

```
authority-loader.ts

command-authority.ts

event-authority.ts

constitution-authority.ts
```

---

## Authority Loader Interface

Implement:

```typescript
interface AuthorityRegistryLoader {

 loadCommands(): CommandRegistry

 loadEvents(): EventRegistry

 loadConstitution(): ConstitutionRegistry

}
```

---

## Prohibited

Runtime must not contain:

```
yaml.parse
yaml.load
readFileSync(*.yaml)
03_command-catalog.yaml
04_event-catalog.yaml
01_constitution.yaml
```

outside:

```
packages/compiler/**
```

---

# TASK 2 — Compiler Artifact Integrity Expansion

Currently:

Simulation registry has:

```json
integrity_hash
```

Expand this model.

Every authority artifact must contain:

```yaml
integrity:
 algorithm: SHA256
 hash:
 generated_by:
   compiler_version:
 timestamp:
```

Required artifacts:

```
commands.registry.json

events.registry.json

machines.registry.json

constitution.registry.json

capabilities.registry.json
```

---

Create:

```
packages/runtime/src/authority/integrity-validator.ts
```

Responsibilities:

1. Load registry
2. Remove integrity metadata
3. Canonicalize JSON
4. Compute SHA256
5. Compare
6. Reject mismatch

Failure:

```
AUTHORITY_ARTIFACT_INTEGRITY_FAILURE
```

---

# TASK 3 — Authority Boundary Audit Expansion

Current audit excludes:

```
packages/runtime/src/server/
```

This is invalid.

Expand audit scope:

```
packages/runtime/src/**
```

Search forbidden patterns:

```
yaml.load
yaml.parse
readFileSync
command_name ===
switch(command)
event_type ===
manual policy evaluation
```

Allowed:

```
packages/compiler/**
```

---

Create:

```
governance/audit/

PHASE10B_RUNTIME_AUTHORITY_BOUNDARY_CERTIFICATE.yaml
```

Required:

```yaml
authority_sources:

 compiler_generated_artifacts:
   verified:true

 runtime_yaml_execution:
   detected:false

 manual_command_dispatch:
   detected:false

status:
 VERIFIED
```

---

# TASK 4 — Lifecycle Validation Rewrite

Current problem:

Lifecycle validation checks declarations, not actual transitions.

Replace heuristic validation.

---

Current:

```
Scenario declares:

INITIALIZED → SETTLED


Runner checks:

terminal_state exists
```

This is insufficient.

---

Required:

```
Scenario

 ↓

StateMachineInterpreter

 ↓

Transition Validation

 ↓

Final State Verification
```

---

Simulation bootstrap already contains:

```
StateMachineInterpreter
```

Integrate it.

---

Required methods:

```typescript
validateInitialState()

validateTransition()

validateTerminalState()
```

---

Execution flow:

For every command:

Before:

```
current_state
```

Validate:

```
command allowed from current_state
```

Execute.

After:

```
new_state
```

Verify:

```
transition exists
```

---

Failure:

```
INVALID_STATE_TRANSITION
```

---

# TASK 5 — Projection Replay Certification

Objective:

Prove:

```
Events
 |
 v
Projection
 |
 v
State
```

is deterministic.

---

Create:

```
packages/runtime/src/simulation/__tests__/projection-replay.test.ts
```

---

Test:

1. Execute SIM-001
2. Capture projection hash

Example:

```
projection_hash_before
```

3. Destroy projection state

4. Replay events

5. Rebuild projection

6. Hash again

Expected:

```
projection_hash_before
==
projection_hash_after
```

---

Failure:

```
PROJECTION_REPLAY_MISMATCH
```

---

# TASK 6 — Event Lineage Persistence

Current:

Event lineage exists only:

```
SimulationResult memory
```

Required:

Persist:

```
generated/simulation/reports/
```

Example:

```
SIM-001-event-lineage.json
```

Format:

```json
{
scenario_id:"SIM-001",

events:[],

orphan_events:0,

broken_chains:0,

verified:true
}
```

---

Certification requires:

```
orphan_events = 0

broken_chains = 0
```

---

# TASK 7 — Registry ABI Enforcement

Create:

```
registry-version.test.ts
```

Tests:

## PASS

```json
{
abi_version:"v1"
}
```

---

## FAIL

```json
{
abi_version:"v2"
}
```

Expected:

```
UNSUPPORTED_SIMULATION_REGISTRY_ABI
```

---

## FAIL

Missing:

```json
abi_version
```

Expected:

```
MISSING_REGISTRY_ABI
```

---

# TASK 8 — Knowledge Layer Boundary Decision

The knowledge layer currently contains:

```
knowledge/*.yaml
```

Do not integrate into runtime yet.

Instead:

Create governance decision:

```
governance/architecture/

KNOWLEDGE_LAYER_RUNTIME_BOUNDARY_DECISION.yaml
```

Define:

```yaml
knowledge_layer:

role:
 compiler_input_only

runtime_access:
 false

authority:
 compiler_generated_artifacts_only

status:
 APPROVED
```

---

Reason:

The knowledge graph is a reasoning substrate, not an execution authority.

---

# TASK 9 — Update Certification Pipeline

Create:

```
npm run certify:phase10b.1
```

Execution:

```
npm run compile

npm run typecheck

npm run test:authority

npm run verify:simulation

npm run audit:authority
```

---

Output:

```
SOVR PHASE 10B.1 CERTIFICATION


Authority Boundary          PASS

Registry Integrity           PASS

CommandBus Migration         PASS

Lifecycle Enforcement        PASS

Projection Replay            PASS

Event Lineage                PASS

Runtime Audit                PASS


STATUS:
READY FOR PHASE 10B
```

---

# TASK 10 — Phase 10B.1 Completion Certificate

Create:

```
governance/releases/

SOVR-GENESIS-000002_PHASE10B.1_COMPLETION_CERTIFICATE.yaml
```

Required:

```yaml
phase:
 PHASE10B.1

authority_boundary:
 VERIFIED

yaml_runtime_execution:
 DISABLED

compiler_authority:
 VERIFIED

projection_integrity:
 VERIFIED

event_integrity:
 VERIFIED

determinism:
 VERIFIED

status:
 READY_FOR_PHASE10B
```

---

# Non-Negotiable Constraints

Do NOT:

* add SIM-004/005/006 yet
* modify frozen constitutional YAML
* add external databases
* activate payment rails
* deploy contracts
* create production credentials
* connect external APIs

---

# Final Acceptance Criteria

Phase 10B.1 is complete only when:

```
npm run certify:phase10b.1
```

returns:

```
PASS
```

and:

```
grep -R "yaml.load" packages/runtime/src
```

returns:

```
0 results
```

and:

```
grep -R "readFileSync.*yaml" packages/runtime/src
```

returns:

```
0 results
```

---

# Final Phase Objective

After this phase:

Phase 10A:

> Compiler can create authority.

Phase 10A.1:

> Authority cannot be silently bypassed.

Phase 10B.1:

> Runtime has only one authority source.

Then:

Phase 10B:

> Controlled economic simulations may begin.

---

**Directive Status: READY FOR EXECUTION**
