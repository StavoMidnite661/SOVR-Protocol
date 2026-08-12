# SOVR Protocol — Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] — 2026-08-12 — AMD-0005 Protocol Materialization Repair

### Fixed (protocol corpus)
- **AMD-0005 command materialization defect closed.** The 8 Commercial
  Settlement Suite commands are re-parented into the authoritative
  `commands:` map of `03_command-catalog.yaml` and completed to the
  canonical command contract (aggregate, source_domain, issuer,
  authorization_requirements, validation_rules, required_payload,
  resulting_events, constitutional_gates).
- Defined the 5 lifecycle commands the commercial state machines already
  referenced (CancelObligation, DisputeSettlement, CancelSettlement,
  PublishPackage, ArchivePackage), derived from machine transitions,
  events, and aggregates.
- Event catalog: normalized the 9 AMD-0005 events to the canonical
  envelope; added the missing `escrow.account.cancellation_failed`
  and 18 lifecycle/failure events.
- State machines: the three AMD-0005 machines rewritten in the canonical
  executable schema; added the SettlementValueUnit lifecycle (SVU
  issuance/redemption).
- Capabilities: 13 commercial/settlement/certification/representation
  capabilities added.

### Changed (compiler enforcement)
- REF-002 (machine→command) and REF-003 (command→event) unresolved
  references are now compile ERRORS (fail-closed), not warnings.
- New silent-drop guard: command-shaped definitions outside the
  authoritative `commands:` map of the catalog are compile ERRORS.
  The AMD-0005 failure class is now a build failure, permanently.
- New REF-005 check: unresolved live-saga step commands are ERRORS;
  documentary saga-template references are reported as warnings.
- New REF-006/REF-007 cross-file authority audit: command definitions in
  per-domain files that are absent from the authoritative map (REF-006,
  warning) or mirror it (REF-007, warning) are now loud and counted in
  every manifest. Unconsumed hybrid-boundary definitions (7) and the
  divergent hybrid naming (saga templates vs hybrid-boundary) are the
  known next protocol-content reconciliation item.

### Build identity
- New build hash `7a3ed4ce…` (was `18c55c32…`): the corpus moved, so the
  identity moved — the determinism contract behaving as designed.
- Ground truth: 118 commands, 286 events, 47 machines, 126 capabilities,
  16 projections, 656 IR nodes — 0 unresolved references, 0 silent drops.
- Runtime proof: SIM-008 (10-command commercial settlement chain) and
  SIM-009 (cancel/dispute branches) execute ACCEPTED end-to-end through
  the kernel against the compiled registries; aggregate states verified
  from the event log per INV-001.

---

## [1.0.0] — PENDING RELEASE (Post-Audit)

### The Linux of Finance — First Constitutional Release

This release represents the completion of a constitutionally
compiled financial kernel. Every behavior in this release was
derived exclusively from the YAML constitutional corpus through
deterministic compiler generation.

### Constitutional Layer
- Protocol specification v1.0.0 FROZEN
- 244 YAML files validated
- Constitutional layers L0 through L7 complete
- 10 invariants (INV-001 through INV-010) — all enforced
- 10 domains, 105 commands, 259 events
- 43 state machines, 113 capabilities, 16 sagas, 48 entities

### AMD-0005 Extension (Commercial Settlement Suite)
- 5 extension domains added: commercial, settlement, certification, representation, gateway
- 4 new entities: CommercialObligation, SettlementRecord, EvidencePackage, SettlementValueUnit
- 8 new commands: CreateCommercialObligation, ValidateObligation, AuthorizeSettlement, ExecuteSettlement, GenerateEvidencePackage, SignAttestation, IssueSVU, RedeemSVU
- 9 new events: CommercialRecordCreated, ObligationValidated, SettlementAuthorized, SettlementExecuted, SettlementFinalized, EvidencePackageGenerated, AttestationSigned, SVUIssued, SVURedeemed
- 3 new state machines: CommercialObligation, SettlementRecord, EvidencePackage
- Additive extension — zero frozen files replaced
- All 10 original domains preserved intact
- All 4 TigerBeetle ledgers untouched
- All existing invariants preserved

### Compiler
- Version: v1.0.0
- Build hash: content-addressed, byte-identical (R1-R10 verified)
- 592 IR nodes, 459 IR edges
- TLA+ models: 43 generated
- Generated artifacts: 104
- Determinism: verified

### Runtime
- Fastify v5 server
- RS256 JWT asymmetric authentication
- PostgreSQL 18 immutable event store (tamper-evident triggers)
- Identity-sovereign rate limiting (@fastify/rate-limit v11)
- 8-runlevel boot with constitutional attestation

### Invariant Enforcement (All 10)
- INV-001: Event immutability (PostgreSQL triggers)
- INV-002: Double-entry integrity (GuardrailBus)
- INV-003: Authority boundary (AuthorityBoundaryEnforcer)
- INV-004: Capability boundary (CapabilityBoundaryEnforcer)
- INV-005: Audit trail completeness (AuditTrailEnforcer)
- INV-006: State machine sovereignty (StateSovereigntyEnforcer)
- INV-007: Event ordering integrity (EventOrderingEnforcer)
- INV-008: Command execution gates (ExecutionGateEnforcer)
- INV-009: Saga compensation completeness (SagaCompensationEnforcer)
- INV-010: Constitutional supremacy (ConstitutionalSupremacyEnforcer)

### Security
- npm audit (prod): 0 HIGH / 0 CRITICAL
- Threat model: 5 categories, 15 threats documented
- SOC2 control mapping: 6 controls
- GDPR pseudonymization implemented
- SOVR-SEC-001: REMEDIATED (FinancialRateLimiter → JWT actor_id)
- Pre-audit self-test: 14/14 PASS

### Secrets Management (XXVI)
- Vault + AWS Secrets Manager providers
- SecretBootstrap at boot (SECRETS_BOOT runlevel)
- TTL cache with audit-only access pattern
- system.secret.accessed emitted on every access
- RailDriverRegistry secrets wiring complete

### Capability Persistence
- CapabilityEngine: event-rebuild at boot (CAPABILITY_RESTORE runlevel)
- CapabilityGrantStore: PostgreSQL-backed (tamper-evident)
- Grant and revoke operations durable across restarts
- Rebuild verified via acceptance test (AUDIT-005)

### Acceptance Tests
- 60 tests across 14 suites
- All 10 INVs covered with dedicated suites
- Constitutional proof scenarios included
- State machine rejection verified
- Saga compensation lifecycle verified
- Escrow lifecycle verified

### Compliance and Documentation
- SOC2 Type II control mapping
- GDPR pseudonymization documentation
- Operational Runbook (P1-P4, DR, key rotation)
- Institution deployment package (5 documents)
- Audit package (4 documents in docs/audit/)
- Threat model and pentest surface map
- Security hardening complete

### Certification
- Enterprise scorecard: B+ (75.25/100)
- Deployment targets: AWS, Azure, GCP
- Kubernetes + Helm + Terraform: complete
- Due diligence package: ready

### Constitutional Proof (XV3-ESCROW-PROOF)
- Escrow domain added via YAML only
- Compiler generated all artifacts
- Runtime executed escrow commands
- Zero runtime TypeScript written
- Purity audit: PASS — 0 violations
- This proof is reproducible at any time from the corpus

### Known Limitations (v1.x Roadmap)
- External rail connections (ACH, FedNow, Fedwire): v1.1.0
- TigerBeetle financial database: v1.1.0
- Multi-node distributed execution: v1.x
- Full 105-command YAML routing: v1.x
- Production saga orchestration: v1.x
- Standards-complete DID/VC: v1.x

---

## [0.9.0] — 2026-07-25 (Security + Compliance Hardening)

### Added
- Directive XXV: 30/30 acceptance tests (restart-resilient constitutional stack)
- Full 12-rail integration (TigerBeetle + boundary adapters)
- DID/VC identity service + PostgreSQL event store
- Capability persistence + projection engine

### Fixed
- AuthorityBoundaryEnforcer scope matching + actor/grant IDs
- Registry.manifest.json regeneration
- SOVR_DEV_AUTO_GRANT=false + test gate flags

## [0.8.0] — Identity + Formal Verification

- W3C DID/VC (did:sovr:{uuid})
- TLA+ model checking in CI
- Multi-node ADR

## [0.7.0] — Production Infrastructure

- PostgreSQL durable + tamper-evident
- RS256 asymmetric JWT
- Rate limiting + circuit breakers
- Docker Compose dev stack
- Demo: 13/13 in 28 seconds

## [0.6.0] — Constitutional Kernel

- KernelExecutor — zero domain knowledge
- handlers.ts deleted
- Purity: 0 violations

## [0.5.0] — Saga Layer

- Saga layer + shared VEL parser

## [0.4.0] — Guard AST + State Registry

- Atomic commit + 101-command coverage
- Guard AST + StateRegistry rebuild

## [0.3.0] — CommandBus Pipeline

- CommandBus → StateMachine → EventStore

## [0.2.0] — Compiler + Basic Runtime

- Compiler + basic runtime
