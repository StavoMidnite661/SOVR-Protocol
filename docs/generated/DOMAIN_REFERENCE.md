# Domain Reference

> **Compiler-generated reference documentation**
> Generated at: 2026-08-11T13:54:07.400Z
> Source: domains/*.yaml

## Summary

| Metric | Count |
| --- | --- |
| Total Domains | 15 |

## Domains

| Domain | Version | Description | Invariants | Conflict Rank |
| --- | --- | --- | --- | --- |
| agent | 1.0.0 | The Optional Execution Authority. Manages AI agent lifecycle, capability binding, execution quotas, concurrency control, resource limits, delegation constraints, and mandatory audit envelopes. Agent never creates authority, never evaluates policy, never bypasses constitutional enforcement, and never operates without a valid intent and policy decision. | INV-004, INV-005, INV-007, INV-008, INV-010 | 7 |
| Certification | 1.0.0 | Evidence generation layer. JDE-compatible settlement evidence packages as first-class governance attestation artifacts. EvidencePackage entity has full state machine lifecycle. Stored in TB_LEDGER.SYSTEM code MEMORANDUM. Option B selected. IPFS/S3 publish is optional boundary adapter only. |  |  |
| Commercial | 1.0.0 | Commercial obligation layer. Origin of all value relationships. Sits above vault domain. References vault assets as obligated value. No new balance store. Root of constitutional chain of custody. |  |  |
| Escrow | 1.0.0 | Escrow custody and conditional release domain. Manages multi-party escrow accounts with condition-based fund release. |  |  |
| Gateway | 1.0.0 | Public verification and traversal layer. Read-model and API observation surface only. No balance impact. No TigerBeetle writes. Exposes full provenance chain for independent verification without SOVR permission. |  |  |
| governance | 1.0.0 | The Constitutional Oversight Domain. Manages constitutional amendments, policy governance, capability grants and revocations, emergency authority, agent oversight, audit review, escalation resolution, and regulatory compliance tracking. Governance is the highest authority in the system and is itself bound by the 10 constitutional invariants. | INV-003, INV-004, INV-005, INV-008, INV-009, INV-010 | 1 |
| identity | 1.0.0 | The Constitutional Execution Authority Domain. Authenticates all actors, issues structured authorization context that flows through the execution pipeline, manages credentials, trust anchors, delegation chains, sessions, and enforces impersonation prevention. Identity is the gate through which every command must pass before reaching Policy, Intent, or Ledger. | INV-003, INV-005, INV-008, INV-010 | 1 |
| intent | 1.0.0 | The Objective Normalization Authority. Receives actor objectives, normalizes ambiguity, validates against constitutional constraints, and converts validated intents into executable commands. Intent never mutates financial state, never skips policy evaluation, and never produces commands without valid authorization. The Intent domain is the sole owner of ambiguity resolution in SOVR. | INV-005, INV-006, INV-008 | 5 |
| ledger | 1.0.0 | The Financial Truth Domain. Maintains immutable, auditable, double-entry financial truth across all value movements. Records the accepted financial interpretation of events. | INV-001, INV-002, INV-005, INV-006, INV-009 | 4 |
| payment | 1.0.0 | The Execution Boundary Domain. Bridges the constitutional runtime to external financial systems through abstract rail adapters. Receives settlement instructions from Treasury, selects execution rails, orchestrates adapter lifecycle, and produces execution receipts. | INV-001, INV-003, INV-005, INV-007, INV-008, INV-009 | 2 |
| policy | 1.0.0 | The Execution Authority Domain. Evaluates all commands against active policy rules across seven dimensions: identity, capability, scope, context, treasury state, vault state, and governance rules. Produces deterministic PolicyDecision outputs. Policy never mutates state — it is a pure evaluation function. | INV-003, INV-004, INV-005, INV-008 | 1 |
| Representation | 1.0.0 | Settlement Value Unit output layer. SVU issuance occurs after payment completes settlement. Extends payment output layer. SVU is representation adapter only. Not money. Not currency. Not a deposit. Every SVU traces to certified evidence package. |  |  |
| Settlement | 1.0.0 | Settlement workflow layer. Extends treasury transfer workflow. Settlement events trigger treasury transfer commands. Does not replace treasury. Does not duplicate treasury transfer logic. |  |  |
| treasury | 1.0.0 | The Controlled Movement Authority. Manages value movement authorization, liquidity allocation, internal transfers, external transfer preparation, settlement coordination, and liquidity constraints. Treasury never creates value, never alters ledger truth, and never bypasses vault controls. | INV-002, INV-003, INV-005, INV-007, INV-008, INV-009, INV-010 | 5 |
| vault | 1.0.0 | The Value Authority Domain. Defines what SOVR recognizes as value, manages asset custody, tracks ownership, enforces reserve integrity, administers collateral, and controls value movement authorization. | INV-001, INV-002, INV-003, INV-005, INV-007, INV-008, INV-009 | 2 |
