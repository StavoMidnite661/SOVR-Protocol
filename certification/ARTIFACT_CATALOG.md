# SOVR Protocol — Artifact Catalog

**Generated:** 2026-07-25T03:11:13-07:00  
**Build Hash:** `d27fdbe60290ba976f684bb7d0096b911195776d975bb1da8bdd6c56d835e512`  
**Protocol Version:** v1.0.0 (FROZEN)  

---

## Artifact Inventory

### Compiler Output Artifacts

| # | Artifact | Path | Type | Generated | Constitutional |
|---|---|---|---|---|---|
| 1 | TypeScript Types | `generated/src/types/{domain}/{domain}.types.ts` | Source | Yes | Yes |
| 2 | Command Classes | `generated/src/commands/{domain}/{domain}.commands.ts` | Source | Yes | Yes |
| 3 | Event Classes | `generated/src/events/{domain}/{domain}.events.ts` | Source | Yes | Yes |
| 4 | OpenAPI 3.1 Spec | `generated/openapi.yaml` | Config | Yes | No |
| 5 | Prisma Schema | `generated/prisma/schema.prisma` | Config | Yes | No |
| 6 | Kafka Topic Config | `generated/config/kafka/topics.yaml` | Config | Yes | No |
| 7 | Redis Stream Config | `generated/config/redis/streams.yaml` | Config | Yes | No |
| 8 | Capability Engine Skeleton | `generated/src/security/capability-engine.ts` | Source | Yes | Yes |
| 9 | Policy Engine Skeleton | `generated/src/policy/engine.ts` | Source | Yes | Yes |
| 10 | Execution Context Skeleton | `generated/src/execution/execution-context.ts` | Source | Yes | Yes |
| 11 | Guardrail Bus Skeleton | `generated/src/execution/guardrail-bus.ts` | Source | Yes | Yes |
| 12 | VEL Evaluator Skeleton | `generated/src/policy/vel-evaluator.ts` | Source | Yes | Yes |
| 13 | Agent Sandbox Skeleton | `generated/src/sdk/agent-sandbox.ts` | Source | Yes | Yes |
| 14 | TLA+ Models | `generated/verification/tla/{name}.tla` | Verification | Yes | Yes |
| 15 | Protocol Topology | `generated/protocol-topology.json` | Config | Yes | No |
| 16 | Topology Docs | `generated/docs/topology.md` | Documentation | Yes | No |
| C1 | Compiler Manifest | `generated/compiler-manifest.yaml` | Manifest | Yes | Yes |
| C2 | Canonical IR | `generated/sovr-ir.json` | Manifest | Yes | Yes |
| C3 | Registry Package | `generated/registries/*.json` | Manifest | Yes | Yes |
| C4 | Compiler Certification | `generated/compiler-certification.json` | Certification | Yes | Yes |

**Total:** 20 output artifacts (16 numbered + 4 certification)

### Registry Artifacts

| Registry | Path | Records | Purpose |
|---|---|---|---|
| Boot Registry | `generated/registries/boot.registry.json` | 8 | Boot runlevels |
| Capabilities Registry | `generated/registries/capabilities.registry.json` | 111 | Capability definitions |
| Commands Registry | `generated/registries/commands.registry.json` | 105 | Command definitions |
| Contracts Registry | `generated/registries/contracts.registry.json` | 10 | Domain contracts |
| Envelopes Registry | `generated/registries/envelopes.registry.json` | 1 | Event envelope schema |
| Events Registry | `generated/registries/events.registry.json` | 259 | Event definitions |
| Execution Plans Registry | `generated/registries/execution-plans.registry.json` | 43 | Execution plans |
| Machines Registry | `generated/registries/machines.registry.json` | 43 | State machine definitions |
| Projections Registry | `generated/registries/projections.registry.json` | 16 | Projection definitions |
| Schemas Registry | `generated/registries/schemas.registry.json` | 48 | Entity schemas |
| Validation Registry | `generated/registries/validation.registry.json` | 105 | Validation rules |

**Total:** 11 registry files

### Constitutional Specification Artifacts

| Layer | File | Path | Purpose |
|---|---|---|---|
| L0 | Protocol Manifest | `00_protocol-manifest.yaml` | Entry point, layers, domains |
| L0 | Constitution | `01_constitution.yaml` | Supreme law, 10 invariants |
| L1 | Domain Model | `02_domain-model.yaml` | 48 entities, 10 domains |
| L1 | Command Catalog | `03_command-catalog.yaml` | 105 commands |
| L1 | Event Catalog | `04_event-catalog.yaml` | 259 events |
| L2 | State Machines | `05_state-machines.yaml` | 43 state machines |
| L3 | Security Capabilities | `08_security-capabilities.yaml` | 111 capabilities |
| L2 | Saga Orchestration | `09_saga-orchestration.yaml` | Saga definitions |
| L5 | Domain Contracts | `12_domain-contracts.yaml` | Cross-domain contracts |
| L7 | Compiler ADR | `13_compiler-adr.yaml` | 12 ADRs |
| - | Compiler Spec | `compiler.yaml` | Compiler specification |
| - | Hybrid Boundary | `hybrid-boundary.yaml` | External boundaries |
| - | Projection Engine | `projection-engine.yaml` | 15 read models |
| - | Acceptance Tests | `acceptance-tests.yaml` | 60 acceptance tests |
| - | Governance Amendments | `11_governance-amendments.yaml` | Amendment process |

**Total:** 15 constitutional specification files

### Domain Artifacts

| Domain | File | Commands | Events | Purpose |
|---|---|---|---|---|
| Agent | `domains/agent.yaml` | 8 | — | Agent lifecycle |
| Escrow | `domains/escrow.yaml` | 4 | 8 | Escrow accounts |
| Governance | `domains/governance.yaml` | 13 | — | Governance |
| Identity | `domains/identity.yaml` | 12 | — | DID/VC identity |
| Intent | `domains/intent.yaml` | 9 | — | Intent lifecycle |
| Ledger | `domains/ledger.yaml` | 9 | 14 | Double-entry ledger |
| Payment | `domains/payment.yaml` | 10 | — | Payment rails |
| Policy | `domains/policy.yaml` | 8 | — | Policy evaluation |
| Treasury | `domains/treasury.yaml` | 9 | 12 | Treasury transfers |
| Vault | `domains/vault.yaml` | 13 | 21 | Asset management |

**Total:** 10 domain files

### Runtime Artifacts

| Package | Files | LOC (approx) | Purpose |
|---|---|---|---|
| Compiler | 23 | 4,260 | Deterministic compilation |
| Runtime | 33 | 5,948 | Execution environment |
| Shared | 5 | 750 | VEL parser, utilities |
| Migrations | 2 | 100 | PostgreSQL schema |
| Tests | 21 | 2,000 | Integration tests |

**Total:** 84 runtime source files, ~13,058 LOC

### Certification Artifacts

| Category | Count | Location |
|---|---|---|
| Compiler Certification | 8 | `certification/COMPILER_*.yaml` |
| Constitutional Certification | 6 | `certification/CONSTITUTIONAL_*.yaml` |
| Runtime Certification | 5 | `certification/RUNTIME_*.yaml` |
| Event Certification | 5 | `certification/EVENT_*.yaml` |
| Domain Certification | 1 | `certification/VAULT_*.yaml` |
| Implementation Certification | 4 | `certification/*_COMPLETION_REPORT.yaml` |
| Other | 16 | Various |

**Total:** 45 certification artifacts

### Documentation Artifacts

| Category | Count | Location |
|---|---|---|
| Architecture | 8 | `docs/architecture/` |
| Compliance | 8 | `docs/compliance/` |
| Deployment | 5 | `docs/deployment/` |
| Security | 3 | `docs/security/` |
| Operations | 2 | `docs/operations/` |
| Formal Verification | 3 | `docs/formal-verification/` |
| Reports | 7 | `docs/reports/` |
| Roadmaps | 2 | `docs/roadmaps/` |
| Guides | 5 | `docs/guides/` |
| Other | 4 | Various |

**Total:** 47 documentation artifacts

### Infrastructure Artifacts

| Category | Count | Location |
|---|---|---|
| Docker Compose | 4 | `deployment/` |
| Kubernetes | 14 | `_archive/orphan-cleanup-20260716-173159/deployment/kubernetes/` |
| CI/CD | 3 | `.github/workflows/` |
| Container Metadata | 45 | `containers/` |

**Total:** 66 infrastructure artifacts

### Evidence Artifacts

| Category | Count | Location |
|---|---|---|
| Snapshot Manifests | 35 | `snapshots/v1.0.1-canonical/` |
| Audit Reports | 7 | `docs/reports/` |
| Boot Evidence | 3 | `generated/boot.*` |

**Total:** 45 evidence artifacts

---

## Artifact Dependencies

```
01_constitution.yaml
    ↓
02_domain-model.yaml
    ↓
03_command-catalog.yaml
    ↓
04_event-catalog.yaml
    ↓
05_state-machines.yaml
    ↓
08_security-capabilities.yaml
    ↓
09_saga-orchestration.yaml
    ↓
12_domain-contracts.yaml
    ↓
compiler.yaml
    ↓
[Compiler Pipeline]
    ↓
generated/sovr-ir.json (canonical IR)
    ↓
generated/compiler-manifest.yaml (build hash)
    ↓
generated/registries/*.json (registry package)
    ↓
packages/runtime/src (runtime execution)
    ↓
generated/boot-attestation.json (boot proof)
```

---

## Constitutional Layer → Artifact Mapping

| Layer | Constitutional Files | Generated Artifacts | Runtime Components |
|---|---|---|---|
| L0 | `00_protocol-manifest.yaml`, `01_constitution.yaml` | `boot.registry.json` | `assertion-registry.ts` |
| L1 | `02_domain-model.yaml`, `03_command-catalog.yaml` | `commands.registry.json`, `schemas.registry.json` | `commandBus.ts` |
| L2 | `04_event-catalog.yaml`, `05_state-machines.yaml`, `09_saga-orchestration.yaml` | `events.registry.json`, `machines.registry.json`, `execution-plans.registry.json` | `state-machine-interpreter.ts`, `saga-interpreter.ts` |
| L3 | `08_security-capabilities.yaml` | `capabilities.registry.json`, `validation.registry.json` | `capabilityEngine.ts`, `jwt.ts` |
| L4 | `projection-engine.yaml` | `projections.registry.json` | `projectionEngine.ts` |
| L5 | `12_domain-contracts.yaml` | `contracts.registry.json` | `boundary.ts` |
| L6 | `hybrid-boundary.yaml` | `envelopes.registry.json` | `achAdapter.ts` |
| L7 | `compiler.yaml`, `acceptance-tests.yaml`, `13_compiler-adr.yaml` | `compiler-manifest.yaml`, `compiler-certification.json` | `boot-renderer.ts` |

---

## Build Artifact Chain

```
YAML Constitution (15 files)
    ↓
Compiler Pipeline (20 passes)
    ↓
Canonical IR (592 nodes, 459 edges)
    ↓
Registry Package (11 JSON files)
    ↓
Runtime Boot (8 runlevels)
    ↓
Boot Attestation (SHA-256 chain)
    ↓
HTTP API (44 endpoints)
    ↓
Event Log (append-only)
    ↓
Projections (16 read models)
```

---

*Catalog generated from ground truth. All artifact paths verified against filesystem.*
