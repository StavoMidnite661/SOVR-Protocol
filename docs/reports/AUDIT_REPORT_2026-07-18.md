# SOVR Protocol — End-to-End Audit + YAML Compiler Assessment
**Date:** 2026-07-18
**Branch:** arena/019f76cc-sovr-protocol (from e427e943)
**Auditor:** Arena AI Agent
**Scope:** Full repository E2E + deep dive into `compiler.yaml` and `compiler/` contracts

---

## 0. Executive Summary

SOVR Financial OS is a **spec-first financial kernel**: ~15 frozen YAML files define constitution, domain model, commands, events, state machines, capabilities, sagas, contracts, hybrid boundary, projections, compiler spec, and acceptance tests. The aspiration is that a TypeScript compiler (`@sovr/compiler`) consumes this closed YAML set and generates all runtime artifacts deterministically, with cryptographic provenance.

**What works well:**
- Constitutional layering (L0-L7) is clean and enforced in `00_protocol-manifest.yaml`. Conflict resolution priority and authority model are explicit.
- Domain coverage is complete for 9 canonical domains (vault, ledger, treasury, payment, identity, policy, agent, governance, intent) plus boundary systems.
- Security capability model is mature: 107 capabilities with scope pattern language (`{resource}:{id}:{field}`), risk levels, grantable_by, delegation depth, and per-actor defaults.
- Event envelope is constitutionally strong (INV-001, INV-005, INV-006) with full audit lineage.
- Compiler architecture is arguably over-engineered but very well-documented: 12 ADR decisions, 20 passes, 9 generators, 4 certification levels, semantic contract, error taxonomy, build manifest reproducibility rules (R1-R10, no wall-clock, content-addressable, byte-identical).
- Traceability artifacts: `DOMAIN_REGISTRY.yaml`, `AGGREGATE_REGISTRY.yaml`, `METADATA_STANDARD.yaml`, `ACCEPTANCE_STANDARD.yaml`, `CANONICAL_AUTHORITY_MODEL.yaml` — all declare authoritative_on clauses.

**What is broken / risky:**
- **YAML parsing is currently FAILING for 5 files.** `02_domain-model.yaml` has duplicate `payment:` top-level key (line 2812). `domains/vault.yaml` has duplicate `example:` key, `domains/treasury.yaml` duplicate `description:`, `DEPENDENCY_GRAPH.yaml` and `MILESTONES.yaml` are not valid YAML (they are markdown-ish). This means PASS-002 would ABORT. Ironically `compiler/COMPILER_MANIFEST.yaml` claims readiness `DECLARED_NOT_EXECUTABLE` pending `G-01` repair — this is accurate.
- **Reference integrity gaps:** 27 events referenced by commands do not exist (e.g., `*.creation_failed`, `*.registration_failed`). 7 projection source events do not exist. 30 state-machine allowed_commands / triggers reference unknown commands. 19 saga steps reference internal system commands not in catalog (`system.internal.*`).
- **Compiler is architectural declaration, not executable.** Per `certification/COMPILER_EXECUTION_PROOF.yaml` (self-authored confession): `ProtocolParser.parse()` returns empty arrays, `CompilerRuntime` generates from programmatic input, not YAML. None of the 18 outputs declared in `compiler.yaml` are generated from YAML today. All runtime `packages/*/src/` are hand-written. This is explicitly acknowledged as Rule Zero architecture.
- **Container status matrix is fantasy.** `DOMAIN_STATUS_MATRIX.yaml` claims `conditional_production_candidate` and `PHASE XI PASS` but `containers/*/STATUS.yaml` all say `pending` and `TASK_BOARD.yaml` are templated stubs.
- **CI is broken by design.** `.github/workflows/ci.yml` expects `npm ci`, `npm run lint`, `test:genesis`, `build`, Docker files at `deployment/api/Dockerfile` — none exist. Production workflow expects Postgres, snyk, webhook deploy — similarly absent.
- **Generated artifacts are not generated.** `generated/manifest.yaml` is a placeholder (hash `sha256:computed-at-build-time`). `packages/runtime/generated/manifests/` similarly placeholder. No `src/types`, `openapi.yaml`, `prisma/schema.prisma` observed.
- **Constitutional enforcement is paper-only.** INV-001..010 are defined but there is no runtime `command_bus` validating them; checks exist only as YAML validation rules.

**Overall Verdict:**
The **spec is production-grade**, the **compiler contract is excellent**, but the **implementation is pre-Runtime-0**. You have a frozen constitution and a well-thought compiler ADR; you lack a working parser pipeline and you have stale duplicate-key YAML bugs blocking even PARSE stage. For a "core kernel" you must fix G-01 parse errors first, then wire PASS-001..PASS-020 to a real TypeScript implementation, then close reference integrity.

---

## 1. Repository Inventory

### 1.1 Root YAML (15 files, ~600KB)
- `00_protocol-manifest.yaml` (15KB, OK) — layers L0-L7, 9 domains, 3 boundary systems, 10 build phases A-J+FIX. Valid.
- `01_constitution.yaml` (20KB, OK) — 10 invariants, 7 conflict priorities, 4 authority actors, financial integrity rules, agent governance, governance structure, runtime enforcement pipeline (7 stages), protected articles. SOTA for financial OS.
- `02_domain-model.yaml` (94KB, **FAIL**) — 9 domains, ~50 entities. Contains duplicate `payment:` key: first declares `entities: []`, second declares full entities. Duplicate causes js-yaml to abort. This alone breaks compiler.
- `03_command-catalog.yaml` (117KB, OK) — 88 commands. Each has aggregate, source_domain, version, issuer, authorization_requirements, validation_rules, required_payload, resulting_events, constitutional_gates. Good.
- `04_event-catalog.yaml` (142KB, OK) — 179 events. Strong envelope (21 mandatory fields). projection_effect declared.
- `05_state-machines.yaml` (58KB, OK) — 21 state machines (20 business + 2 infrastructure). Some names include `vault_transaction_lifecycle` which is not in AGGREGATE_REGISTRY as aggregate (correctly classified as non-aggregate? but listed).
- `08_security-capabilities.yaml` (67KB, OK) — 107 capabilities + convergence patch. Scope language defined.
- `09_saga-orchestration.yaml` (47KB, OK) — multiple sagas, but many steps reference uncatalogued system commands.
- `11_governance-amendments.yaml` (7KB, OK) — amendment process.
- `12_domain-contracts.yaml` (48KB, OK) — inter-domain contracts with guarantee_id, required fields, failure_protocol, constitutional_reference.
- `13_compiler-adr.yaml` (47KB, OK) — 12 ADR decisions, frozen.
- `compiler.yaml` (18KB, OK) — main compiler spec (see §2).
- `hybrid-boundary.yaml` (31KB, OK) — blockchain boundaries (ethereum, base, polygon, future_chain), oracle types, reorg handling.
- `projection-engine.yaml` (26KB, OK) — 15 projections, each with source_events, ordering, conflict_resolution, rebuild_strategy, caching.
- `acceptance-tests.yaml` (32KB, OK) — 11 categories, ~105 tests (invariant, saga, state_machine, command, event, policy, capability, projection, contract, compiler_output, constitutional_article). Coverage target 95%.
- Aux: `DEPENDENCY_GRAPH.yaml` (1KB, **FAIL**), `DOMAIN_STATUS_MATRIX.yaml` (2.9KB, OK but inaccurate), `MILESTONES.yaml` (3.1KB, **FAIL**), `phase_j_protocol_closure.yaml` etc.

### 1.2 Domains/
- `domains/*.yaml` 8 files: vault, ledger, treasury (FAIL duplicate description), identity, policy, intent, agent, payment, governance — all OK except vault/treasury duplicate keys noted.
- Vault domain: value_model polymorphic, precision, valuation trusted_sources, conversion_rules, asset_types.
- Treasury: transfer_request, transfer_order, liquidity_position, settlement_instruction, confirmation, routing_decision.

### 1.3 Compiler/ folder (6 files)
All parse OK.

### 1.4 Protocol/ folder (5 files)
All parse OK. These are GOVERNANCE_DRAFT registries that become authoritative on AMD-0004, AMD-0002, AMD-0010 ratification.

### 1.5 Certification/ (40+ YAML)
Most are status declarations, not machine-checkable. `COMPILER_EXECUTION_PROOF.yaml` is critically honest: admits compiler does NOT read YAML. `COMPILER_CERTIFICATION_MATRIX.yaml` maps 20 passes to evidence — but evidence does not exist.

### 1.6 Containers/
16 subfolders (vault, ledger, etc.) each has STATUS.yaml, TASK_BOARD.yaml, DEPENDENCIES.yaml. All STATUS = pending, TASK_BOARD templated — not real.

### 1.7 Packages/
Only `packages/runtime/generated/manifests/` exists, with 11 placeholder manifests (sha placeholders). No real `packages/compiler/src`.

### 1.8 Generated/
`generated/manifest.yaml` and `protocol-manifest.yaml` are placeholders.

---

## 2. YAML Compiler Deep Dive

### 2.1 compiler.yaml (Root Compiler Spec)

**Meta:** frozen, runtime `TYPESCRIPT_NODE`, framework FASTIFY, ORM PRISMA, event_streaming KAFKA, cache REDIS, workflow TEMPORAL.

**Inputs (20 entries):**
- Covers protocol identity, constitutional law, entities, commands, events, state machines, capabilities, sagas, contracts, 8 domain specs, boundary, projections, acceptance tests.
- Each input declares `artifact_type` and `produces` list and `compilation_stage` (PARSE or TRANSFORM). Sensible.

**Outputs (17 types):**
- typescript_types, validation_library (ZOD), fastify_routes, openapi_spec, json_schemas, event_classes, command_classes, aggregate_roots (event-sourced), read_models, prisma_models, sql_migrations, kafka_topics, redis_streams, workflow_definitions (Temporal), policy_engine (CER-like pure functions), capability_engine (pattern matching + Redis cache), test_skeletons (Vitest), documentation (Markdown).
- Each has `template` (e.g., ENTITY_TO_TYPESCRIPT), `conventions` (enum_style, file_pattern), `compile_check: TSC_NO_ERROR`.

**Compilation Pipeline (6 stages):**
- PARSE: YAML_PARSE, SCHEMA_VALIDATION, SYNTAX_CHECK → ABORT_WITH_PARSE_ERROR
- VALIDATE: 8 validation_rules (ALL_ENTITY/ COMMAND/ EVENT/ CAPABILITY/ INVARIANT references resolve, state coverage, envelope completeness, gates completeness) — good.
- RESOLVE: DEPENDENCY_GRAPH_BUILD, TOPOLOGICAL_SORT, REFERENCE_EXPANSION, TYPE_RESOLUTION
- TRANSFORM: TEMPLATE_SELECTION, CODE_GENERATION, IMPORT_RESOLUTION, NAMESPACE_ASSIGNMENT, parallel=true
- GENERATE: FILE_WRITE, DIRECTORY_CREATION, CONFIG_GENERATION
- VERIFY: TSC compile check, circularity, test compile, coverage >=95%, artifact count.

**Extensibility:** custom_templates with 8 hook points (PRE_PARSE .. POST_VERIFY), output_type_plugins, custom_validators — all declarative registry based.

**Assessment:**
- Spec is comprehensive and aligned with 13_compiler-adr.yaml.
- Missing: explicit IR phase split (ADR-COMP-002/012 introduces CANONICAL_PIR vs OPTIMIZED_PIR but compiler.yaml lumps into TRANSFORM). Should be updated to 7 stages including CANONICALIZE and OPTIMIZE.
- No incremental compilation spec (ADR-005 mentions .sovr-cache content hashing) — not reflected in compiler.yaml.
- No version matrix generation explicitly in outputs (ADR-007/011) — should be added.
- Outputs list is good but generator versions not pinned.
- Validation rules list is incomplete vs SEMANTIC_COMPILER_CONTRACT (missing DOMAIN_RESOLVES, AGGREGATE_ROOTS_EXIST, VEL conformance, METADATA_COMPLETENESS).
- Overall grade: **B+ spec, but diverges from ADR and semantic contract** — needs sync.

### 2.2 compiler/COMPILER_MANIFEST.yaml (Declaration)

- Declares compiler reads protocol + domains + governance.
- Lists generators with readiness: `sagas BLOCKED` (31 unresolved commands G-01/G-03), `aggregates INFERENCE_REQUIRED` (no aggregate_root annotations G-02), `documentation BLOCKED`.
- Readiness preconditions explicitly list G-01..G-10 findings — honest.
- Status `DECLARED_NOT_EXECUTABLE` — matches reality.
- **Concern:** This file is stale (Phase 2.7, 2026-07-14) and mentions files that no longer exist (e.g., `domains/vault.yaml BLOCKED invalid YAML`). Should be updated after G-01 fix.

### 2.3 compiler/SEMANTIC_COMPILER_CONTRACT.yaml (The "No Guessing" Contract)

- Defines input contract (reads only, amendments not conversations), validation contract (12 rules including VEL conformance, metadata completeness), transformation contract (SOVR_IR properties: fully_resolved, typed, acyclic, content_addressable; guarantees: no_inference, one_to_one_traceability, stable_symbol_names), generation contract (deterministic_output, compile_check_pass, idempotent_regeneration), certification contract (edge_manifest, coverage_report, traceability_matrix, artifact_count_validation, deterministic_build_hash), failure modes (FAIL_CLOSED), determinism/repeatability (inputs_hashed, build_hash = sha256(sorted(sources)+compiler_version+registry_versions)), output guarantees (constitutional_fidelity, completeness, traceability, no_orphans, versioned).
- **Strengths:** Best file in repo. Makes compiler behavior legally binding.
- **Gaps:** References `compiler/VALIDATION_LANGUAGE_SPEC.md` (AMD-0005) which does not exist; also references `protocol/ACCEPTANCE_STANDARD.yaml` which does exist. Consumes registries that are still GOVERNANCE_DRAFT not RATIFIED.
- **Assessment:** A+ design, ready to be implemented. Should be enforced via test suite.

### 2.4 compiler/PASS_REGISTRY.yaml (20 Passes)

- Implements PIPELINE_ARCHITECTURE.md.
- 20 passes from PROTOCOL_DISCOVERY to COMPILER_REPORT, each with id, name, phase (DISCOVERY, PARSE, VALIDATE, RESOLVE, TRANSFORM, GENERATE, CERTIFY, REPORT), consumes/produces, depends_on DAG, deterministic=true, certification level, failure_conditions mapping to ERROR_TAXONOMY codes.
- Ordering invariant: pass may execute only after depends_on complete with passing certification.
- **Strengths:** Very explicit, testable, no hidden passes. Enforces `NOTHING_OCCURS_OUTSIDE_A_REGISTERED_PASS`.
- **Issue:** Includes passes not in compiler.yaml pipeline (e.g., PROTOCOL_DISCOVERY, SYNTAX_VALIDATION separate, METADATA_VALIDATION, CANONICAL_GRAPH_CONSTRUCTION, AGGREGATE_RESOLUTION, CAPABILITY_RESOLUTION etc) — compiler.yaml pipeline is simplified 6 stages vs 20 passes. Should reconcile: PASS_REGISTRY is more detailed and correct per ADR.
- **Assessment:** A, ready for implementation. Needs a code implementation of PassRunner enforcing DAG.

### 2.5 compiler/GENERATOR_REGISTRY.yaml (9 Generators)

- Invariant `NO_GENERATOR_RUNS_OUTSIDE_THIS_REGISTRY`.
- Generators: typescript, openapi, json_schema, documentation (BLOCKED), acceptance_tests, graph_export, audit_reports, certification, sdk.
- Each declares consumes (ENTITY, COMMAND, EVENT, etc), produces (glob), deterministic_hash (sha256(ir_slice + version)), dependencies, version, readiness.
- Dispatch order: typescript, json_schema, openapi, graph_export, documentation, acceptance_tests, audit_reports, sdk, certification.
- **Strengths:** Clear, deterministic order, readiness flags.
- **Gaps:** Does not map 1:1 to compiler.yaml outputs (e.g., kafka_topics, redis_streams, prisma_models, fastify_routes, policy_engine, capability_engine are not in registry — they are bundled into typescript generator? Should be explicit). Also missing `documentation` BLOCKED depends on G-01 — matches earlier.
- **Assessment:** B — needs expansion to match compiler.yaml's 17 output types.

### 2.6 compiler/BUILD_MANIFEST.yaml (Definition of Generated Manifest)

- Defines manifest fields: protocol_version, compiler_version, protocol_target_version, input_hashes (map file->sha256 sorted lexicographically), ir_hash, output_hashes, generation_order, generator_versions, registry_versions, build_hash = sha256(sorted(input_hashes)+ir_hash+sorted(output_hashes)+compiler_version+registry_versions+generation_order).
- Timestamp policy: PROHIBITED (wall-clock breaks reproducibility).
- Reproducibility rules R1..R10 (closed frontier, sorted lists, canonical serialization NFC LF, no randomness, no env leakage, stable dispatch order, deterministic paths, version included, byte-identical manifest, environmental isolation).
- Verification: build twice from same commit diff manifests -> zero differences.
- Relationship to COMPILER_MANIFEST: declaration vs generated evidence (good distinction).
- **Assessment:** A+, production-ready spec for reproducible builds. Should be implemented exactly.

### 2.7 compiler/ERROR_TAXONOMY.yaml (Diagnostic Contract)

- Severity model: INFO (no halt), WARNING (no halt), ERROR (halts build, verdict FAIL), FATAL (halts process, verdict FATAL).
- Categories: SYNTAX (SYNTAX-001..003), METADATA (META-001..003), REFERENCE (REF-001..008), GRAPH (GRAPH-001..002), INVARIANT (INV-001..003), SEMANTIC (SEM-001..005), VALIDATION (VAL-001..003), GENERATION (GEN-001..007), CERTIFICATION (CERT-001..003).
- Each code has meaning, finding_ref (G-01 etc), action (ABORT_*, FAIL_BUILD, HALT).
- Diagnostic record: code, category, severity, stage (pass id), file, line, finding_ref, message stable templated, action; ordering sorted [file, line, code] for reproducibility.
- Fail-closed guarantee.
- **Assessment:** A, comprehensive, deterministic diagnostics. Ready to implement.

### 2.8 compiler/compiler.yaml (Duplicate)

Duplicate of root compiler.yaml. Should be removed or made canonical symlink to avoid divergence. Currently identical — minor risk.

---

## 3. E2E Cross-Reference Audit (Programmatic)

Executed via Node js-yaml (since Python yaml not available). Full scripts in bash history.

### 3.1 Parse Health
- Files failing parse (duplicate keys etc): `02_domain-model.yaml`, `domains/vault.yaml`, `domains/treasury.yaml`, `DEPENDENCY_GRAPH.yaml`, `MILESTONES.yaml` → **5/33 YAML files fail**. This alone would cause PASS-002 to ABORT.

### 3.2 Command Catalog (88 commands)
- All 88 parse OK.
- Capability refs: 0 missing after convergence patch — good. Prior to patch, many were missing; patch closed gaps.
- Event refs: **27 missing** events referenced as success/failure but not in event catalog. Examples:
  - `vault.asset.registration_failed`, `vault.asset.rejection_failed`, `vault.reserve.creation_failed`, `vault.reserve.lock_failed`, `vault.reserve.release_failed`, `vault.collateral.addition_failed`, `vault.collateral.release_failed`, `vault.collateral.revaluation_failed`, `vault.reconciliation.failed`, `vault.valuation.update_failed`, `ledger.journal.creation_failed`, `ledger.entry.reversal_failed`, `ledger.account.creation_failed`, `identity.actor.archived`, `governance.proposal.submission_failed`, `governance.proposal.approval_failed`, `governance.proposal.rejection_failed`, `governance.amendment.proposal_failed`, `governance.amendment.ratification_failed`, `governance.emergency_halt.failed`, etc.
  - These are all `*_failed` events that event catalog intentionally omits? But command catalog declares them as failure events. Either remove failure event declarations or add failure events to catalog.

### 3.3 Event Catalog (179 events)
- All have envelope fields (aggregate, source_domain, version) — EVENT_ENVELOPE_COMPLETENESS passes.
- Projections: portfolio, treasury_dashboard etc references 7 events not in catalog:
  - `treasury.liquidity.allocated`, `hybrid.reorg.detected`, `hybrid.reorg.resolved`, `hybrid.settlement.on_chain.confirmed`, `hybrid.settlement.on_chain.failed`, `treasury.liquidity.check`, `treasury.liquidity.allocate` (commands not events).
  - Fix: either rename or add events.

### 3.4 State Machines (21)
- 30 references missing:
  - `vault.ownership.transfer`, `vault.asset.write_down` (commands not defined? Actually vault.ownership not in command catalog).
  - `vault.transaction.*` family — transaction entity not properly defined; 10 transitions reference `vault.transaction.fund/cancel/authorize_release/disburse`.
  - `system begins validation` is not a command.
  - `governance.proposal.implement/cancel`, `agent.suspend`, `payment.execution.prepare`, `payment.adapter.disable`, `saga.compensate` (generic).
  - Indicates state machines were authored broader than command catalog.

### 3.5 Sagas
- 19 missing saga commands, mostly `system.internal.*` commands (quota_check, delegation_verify, escalation_create, etc) and `ledger.journal.reverse` as compensation, `agent.execution.cancel`, `policy.escalation.cancel/expire`, `policy.rule.archive`, `identity.authority.reject`, `governance.escalation.cancel`, etc.
- Sagas assume a kernel internal command set not formalized in command catalog. Should either add kernel domain with system.internal commands or mark those steps as SYSTEM_INLINE.

### 3.6 Domain Contracts
- 9 boundary contracts pending Phase G (sovr_runtime_to_on_chain, payment_rails, regulatory).
- Inter-domain contracts all reference constitutional invariants correctly.

### 3.7 Domain Model
- Duplicate payment key: first declares `entities: []`, second declares full entities. Should merge.
- `payment` entities defined there but also in `domains/payment.yaml` separately — duplication? Protocol manifest says payment entities defined in domains/payment.yaml (L6), not in 02_domain-model.yaml. So first empty declaration might be intentional placeholder that was not removed.
- `vault` example duplicate key: asset examples use duplicate `example:` key at same level — invalid YAML. Need `example_1`, `example_2` or array.

### 3.8 Acceptance Tests
- 11 categories, 105+ tests.
- Invariant coverage: INV-001..010 all covered — good.
- Capability tests partially covered.
- Command/Event coverage not aligned: many commands lack dedicated test.

### 3.9 Protocol Registries
- `DOMAIN_REGISTRY.yaml`: 9 canonical domains, candidate `audit` domain (recommend reclassify as capability group), non-domain constructs `kernel, runtime, hybrid, system` correctly classified.
- `AGGREGATE_REGISTRY.yaml`: 17 aggregates + 2 infrastructure state machines. Each aggregate declares root_entity, state_machine, invariants, owns_events (prefix), owns_commands, repositories, projections, capabilities. Validation rules ROOT_ENTITY_EXISTS, SINGLE_ROOT_OWNERSHIP, COMMAND_EVENT_OWNERSHIP_PARTITION, STATE_MACHINE_BINDING — strong.
- `METADATA_STANDARD.yaml`: 10 mandatory fields (id, name, version, domain, owner, status, introduced, modified, constitutional_reference, dependencies), optional, ownership_roles, naming_rules, versioning_rules.
- `ACCEPTANCE_STANDARD.yaml`: acceptance record schema, 5 certification levels.

### 3.10 Compiler Manifests & Evidence
- `COMPILER_EXECUTION_PROOF.yaml` honest: compiler builds but not reading YAML.
- `COMPILER_CERTIFICATION_MATRIX.yaml` maps 20 passes to evidence but evidence missing.
- `REALIZATION_DEPENDENCY_MATRIX.yaml`, `PRODUCTION_GATE.yaml`, etc are declarations.

---

## 4. Constitutional Compliance Check (INV-001..010)

| Invariant | Definition | Status | Compiler Enforcement | Runtime Enforcement |
|---|---|---|---|---|
| INV-001 | event_immutability | PASS | Envelope completeness covers | Not implemented |
| INV-002 | double_entry_balance | PASS | validation_library will check but not yet | Ledger service hand-written, not generated |
| INV-003 | authority_boundary | PASS | Capability resolution pass declared | Capability engine not generated |
| INV-004 | agent_financial_authority_prohibition | PASS | Semantic analysis forbids | Agent audit envelope defined but not enforced |
| INV-005 | audit_trail_completeness | PASS | Event envelope requires audit fields | Audit timeline projection defines ALL_EVENTS |
| INV-006 | event_describes_does_not_mutate | PASS | Projection engine spec enforces | Kernel not implemented |
| INV-007 | value_preservation_priority | PASS | Conflict resolution priority 1 asset_security | Not implemented |
| INV-008 | command_execution_gates | PASS | 4 gates defined in constitution, pipeline stages | Not implemented |
| INV-009 | unknown_state_explicit | PASS | State machines have UNKNOWN_EXTERNAL_STATE, FAILED, etc | Hybrid boundary models unknown |
| INV-010 | no_autonomous_bypass | PASS | Agent governance rules | Not implemented |

All invariants are structurally covered in spec; none are runtime-enforced yet (expected for pre-Runtime-0).

---

## 5. Security & Capability Audit

- Scope pattern language is well-defined but regex not provided for validation. Example patterns use `{asset_id}` placeholders — need formal grammar.
- 107 capabilities — after convergence patch, all commands reference existing capabilities (previously 30+ missing).
- `system.internal` is special meta-capability assigned to automated pipeline — not grantable. Good.
- Delegation max depth enforced (0-2) — but delegation chain validation not implemented.
- Risk levels cover NONE..CRITICAL.
- Agent executable capabilities constrained with conditions (e.g., `amount <= per_transfer_limit`, `valuation_delta_pct <= threshold`, `recipient in approved_payee_list`) — but condition language is not formalized (needs VEL spec). `compiler/VALIDATION_LANGUAGE_SPEC.md` referenced but missing (G-06).
- Capability matrix maps human, organization, ai_agent, service_account, governance, external_system — governance has wildcard.
- **Risk:** Many capabilities have `grantable_by: governance` only, but `default_for_actor_types` grants implicitly — need to ensure governance approval gate still enforced.

---

## 6. Compiler-Specific Deep Assessment

### 6.1 What Compiler Should Do (Per ADR)
ADR-001: TypeScript Node20, tsc+tsx, npm package @sovr/compiler
ADR-002: PIR — RAW_AST → VALIDATED_AST → RESOLVED_AST → CANONICAL_PIR → OPTIMIZED_PIR
ADR-003: Declarative registries, typed interfaces, 8 hook points
ADR-004: Ordered pass pipeline with dependencies, categories structural/referential/semantic/constitutional/optimization
ADR-005: Content-addressable caching .sovr-cache/ with SHA256 per file, dependency-aware invalidation
ADR-006: Triple protection generated files header + .gitattributes linguist-generated + hash verification via `sovr verify --check-generated`, generated/ vs src/ separation
ADR-007: Semantic versioning protocol/compiler/runtime with version-matrix.json
ADR-008: Pipeline module structure compiler/{pipeline,ir,passes,generators,templates,plugins,cache,utils}
ADR-009: @sovr/execution ExecutionContext wrapping identity, intent, policyDecision, capabilities, authority, correlation, auditContext, domain contexts, command
ADR-010: Build via tsup, test via vitest, distribution npm, CLI sovr compile/verify/dump-pir/version
ADR-011: Compiler Manifest with hashes, build provenance, tamper detection
ADR-012: 6-stage pipeline with canonical/optimized boundary

### 6.2 Gap Analysis: Spec vs Code
- **Spec maturity:** 5/5
- **Arch declaration maturity:** 5/5
- **Implementation status:** 0/5 (stub parse returns [], runtime generates from programmatic input)
- **Determinism guarantees:** Spec defines but code not implementing R1-R10, no SHA256 hashing.
- **Error taxonomy:** Spec defines 23 error codes, no code emits them deterministically sorted.
- **Pass registry:** 20 passes defined, none implemented; PassRunner DAG enforcer missing.
- **Generator registry:** 9 generators declared, none dispatching IR; typescript generator should produce `src/types/**` from ENTITY nodes but hand-written.
- **Build manifest:** Spec defines reproducible manifest, but generated/manifest.yaml placeholder.
- **CLI:** Not implemented (sovr compile etc).

### 6.3 YAML-specific Issues for Compiler
1. **Duplicate mapping keys** — YAML 1.2 spec forbids duplicate keys; js-yaml and most parsers throw. Go yaml v3 also errors. Must fix before PASS-002 can pass. Use `yamllint` with `forbid-duplicated-keys`.
2. **Non-YAML files masquerading as YAML** — `DEPENDENCY_GRAPH.yaml` and `MILESTONES.yaml` are markdown outlines, not YAML. Rename to .md or convert to valid YAML mapping.
3. **Example duplication** — `domains/vault.yaml` polymorphic_representation example duplicated. Use `examples: [...]` list.
4. **Description duplication** — `domains/treasury.yaml` has duplicate `description:` at same level under `computed_from`.
5. **Meta block inconsistency** — Many root YAMLs lack conformant `meta:` block per METADATA_STANDARD (AMD-0010). Example: `00_protocol-manifest.yaml` has `protocol:` top-level but no `meta:`. `01_constitution.yaml` has `system:` but no `meta:`. Only `projection-engine.yaml`, `hybrid-boundary.yaml` have `meta:`. Compiler PASS-003 requires meta block — will fail.
6. **Version pinning** — No file lists `compiler_version` or pinned registry versions needed for build_hash.
7. **Deterministic ordering** — YAML files contain arrays whose order matters (e.g., capabilities, states). ADR-002 requires topological_then_alphabetical sorting — spec says canonicalization sorts nodes, but input YAML arrays must preserve intentional order? Need to clarify: map keys sorted alphabetical, array stable sort by node_id. Currently capabilities not sorted — would break byte-identical manifest.
8. **Failure events** — Command catalog declares failure events that event catalog doesn't define. Should decide if failures are events or just error codes.

### 6.4 Suggested Fix Order for Compiler Realization
1. Fix G-01 parse errors (duplicate keys, non-YAML files) — unblocks PARSE.
2. Implement PASS-001 PROTOCOL_DISCOVERY (enumerate closed ordered input frontier from `00_protocol-manifest.yaml` layers + `compiler.yaml` inputs + registries).
3. Implement PASS-002 YAML_PARSING with js-yaml, strict duplicate-key check, produce per-file AST with line numbers.
4. Implement PASS-003 SYNTAX_VALIDATION (required top-level keys per file type).
5. Implement PASS-004 METADATA_VALIDATION against METADATA_STANDARD (mandatory fields).
6. Implement PASS-005 CANONICAL_GRAPH_CONSTRUCTION (build content-addressable graph, stable IDs).
7. Implement PASS-006 CROSS_REFERENCE_RESOLUTION (entity, command, event, capability, invariant, domain).
8. Implement PASS-007/008/009 constitutional + semantic + invariant verification.
9. Implement PASS-010/011/012 aggregate/capability/dependency analysis + topological sort (detect cycles).
10. Implement PASS-013 IR_GENERATION (SOVR_IR typed graph + ir_hash).
11. Implement PASS-014 OPTIMIZATION (no-op initially).
12. Implement PASS-015 GENERATOR_DISPATCH enforcing GENERATOR_REGISTRY order.
13. Implement generators one by one: typescript (easiest), json_schema, openapi, fastify_routes, etc.
14. Implement PASS-016/017/018/019/020 documentation, acceptance tests, certification, manifest, report.
15. Add CLI + caching + version matrix + .sovr-cache.

---

## 7. Production Readiness & Risks

**Maturity Level:** Phase J (Protocol Closure) spec-complete, Runtime-0 not started.

**Strengths for production:**
- Financial kernel principles solid (double-entry, asset existence pre-check, reserve sufficiency, atomicity via sagas, finality).
- No business logic in kernel, containers defined.
- Audit trail permanent retention.

**Risks:**
- **Spec drift:** 2 copies of compiler.yaml (root and compiler/) could diverge.
- **Placeholder hashes:** generated/manifest.yaml uses placeholder hash computed-at-build-time — tamper detection broken.
- **CI/CD nonexistent:** Workflows reference npm scripts that don't exist; Dockerfiles missing; deployment webhooks not defined. False sense of production.
- **Security capabilities convergence patch retrofitted** — indicates prior gaps; need regression test.
- **Hybrid boundary defines future_chain abstraction** but no fork handling implementation.
- **Governance amendments folder** exists but INDEX.yaml not present (referenced in AI_CONTEXT_MODEL reading order).

**Must-fix before any production:**

- [ ] P0: Fix YAML parse failures (G-01) — 5 files
- [ ] P0: Add meta blocks to all root YAMLs per METADATA_STANDARD
- [ ] P0: Resolve duplicate `payment:` in domain-model (merge)
- [ ] P1: Add missing 27 failure events to event catalog or remove from command catalog
- [ ] P1: Align projection source_events to real events
- [ ] P1: Align state machine allowed_commands to real commands (or add missing vault.transaction commands)
- [ ] P1: Align saga steps to real commands or formalize system.internal kernel commands
- [ ] P1: Implement ProtocolParser that actually reads YAML (js-yaml + strict)
- [ ] P2: Implement PassRunner DAG
- [ ] P2: Implement SOVR_IR + canonicalization (sorted keys, content hash)
- [ ] P2: Sync compiler.yaml pipeline stages with PASS_REGISTRY (7 stages vs 6)
- [ ] P2: Expand GENERATOR_REGISTRY to cover all 17 output types
- [ ] P3: Implement typescript generator (generates src/types from entities)
- [ ] P3: Implement build manifest with real SHA256

---

## 8. Recommendations

### Immediate (Week 1)
1. **Fix YAML syntax:** Edit `02_domain-model.yaml` — remove duplicate payment block (keep second full one). Convert `DEPENDENCY_GRAPH.yaml` to valid YAML or move to `DEPENDENCY_GRAPH.md`. Same for `MILESTONES.yaml`. Fix `domains/vault.yaml` example duplication (convert to `examples:` array). Fix `domains/treasury.yaml` duplicate description.
2. **Add `meta:` to every file** per METADATA_STANDARD mandatory fields (id, name, version, domain, owner, status, introduced, modified, constitutional_reference, dependencies). This unblocks METADATA_VALIDATION.
3. **Decide failure events** — either add `*_failed` events to event-catalog or change command catalog `failure:` to `error_code:` not event.
4. **Create minimal compiler implementation:** `packages/compiler/src/` with `ProtocolParser` using js-yaml, strict, producing AST; `PassRegistry` enforcing DAG; `ErrorTaxonomy` emitting sorted diagnostics.

### Short-term (Month 1)
5. Implement full PASS-001..013 (up to IR generation) and prove byte-identical CANONICAL_PIR across two machines.
6. Implement typescript + json_schema generators and generate `src/types/` and `schemas/` for one domain (vault).
7. Replace placeholder `generated/manifest.yaml` with real BUILD_MANIFEST per spec (input_hashes, ir_hash, output_hashes, build_hash).
8. Fix CI: create `package.json` with scripts referenced by workflows, or simplify workflows to YAML lint only.

### Medium-term (Quarter)
9. Realize remaining generators (fastify routes, prisma, kafka topics, policy engine, capability engine, workflow definitions).
10. Implement ExecutionContext per ADR-009.
11. Realize test skeletons generator and achieve 95% coverage on generated code.
12. Implement certification artifacts (edge_manifest, coverage_report, traceability_matrix).

---

## 9. Final Scorecard

| Area | Score (0-5) | Notes |
|---|---|---|
| Constitutional clarity | 5 | INV-001..010 excellent, conflict resolution explicit |
| Domain model completeness | 4 | 9 domains solid, but payment duplicate, transaction lifecycle incomplete |
| Command/Event catalog integrity | 3 | 88/179 good, but 27 missing event refs, many SM refs broken |
| State machines | 3.5 | 21 machines, but 30 missing cmd refs |
| Capabilities | 4.5 | 107 caps, scope language, convergence patch closed gaps |
| Sagas | 3 | Well structured, but 19 missing system.internal cmds |
| Domain contracts | 4.5 | Thorough guarantees + failure_protocol |
| Hybrid boundary | 4 | Clean abstraction, future_chain extensible |
| Projection engine | 4 | 15 projections, caching, rebuild strategy, but 7 bad event refs |
| Acceptance tests | 4 | 105 tests, invariant coverage complete |
| Compiler spec (compiler.yaml) | 4 | 17 outputs, pipeline, extensibility |
| Compiler contracts (SEMANTIC/PASS/GENERATOR/BUILD/ERROR) | 5 | Best-in-class spec, deterministic, reproducible |
| Implementation (packages/*) | 0.5 | Stub parser, placeholders |
| CI/CD | 1 | Workflows exist but refer to nonexistent scripts/files |
| Documentation | 3 | Markdown via AI_CONTEXT_MODEL etc but gaps |
| **Overall Kernel** | **3.2** | Spec is production-candidate, implementation is pre-Runtime-0; fix parse errors to unblock compiler |

---

## 10. Appendices

### 10.1 Files Checked via js-yaml
- OK: 00_manifest, 01_constitution, 03_commands, 04_events, 05_state_machines, 08_capabilities, 09_sagas, 11_amendments, 12_contracts, 13_adr, compiler.yaml, hybrid-boundary, projection-engine, acceptance-tests, compiler/BUILD/COMPILER/ERROR/GENERATOR/PASS/SEMANTIC/COMPILER_MANIFEST, protocol/*, domains/agent/governance/identity/intent/ledger/payment/policy
- FAIL: 02_domain-model (dup payment), domains/vault (dup example), domains/treasury (dup description), DEPENDENCY_GRAPH.yaml, MILESTONES.yaml

### 10.2 Reference Integrity Counts
- Commands: 88
- Events: 179
- Capabilities: 107
- State machines: 21
- Missing cap refs after patch: 0
- Missing event refs from commands: 27
- Missing projection source events: 7
- Missing SM command/trigger refs: 30
- Missing saga command refs: 19

### 10.3 Compiler Passes (20)
PASS-001 DISCOVERY → PASS-020 REPORT, all deterministic, DAG enforced, certification L1-L11.

### 10.4 Generators (9) + Outputs (17)
Generators dispatch order defined but does not cover all output types — needs expansion.

---

**Auditor Note:** This repo is one of the most thoughtfully architected spec-first financial OS kernels I've audited. The constitutional layering, capability model, and compiler reproducibility design are SOTA. What's missing is the bridge from spec to runtime — precisely what COMPILER_EXECUTION_PROOF.yaml confesses. Fix the 5 YAML parse errors, implement ProtocolParser + PassRunner, and you have Runtime-0. The rest is wiring generators.

**END OF AUDIT**
