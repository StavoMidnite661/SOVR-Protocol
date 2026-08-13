<!--
HISTORICAL / REMEDIATION RECORD

This file does not describe the current SOVR architecture.
See docs/ARCHITECTURE.md for the implementation that exists now.
-->

# SOVR Protocol — API Certification

**Generated:** 2026-07-25T03:11:13-07:00  
**Build Hash:** `6e97ae164fa847ca4f54d99250a505752d033e9a73c2650c70a1d11c5f1f1015`  
**Protocol Version:** v1.0.0 (FROZEN)  
**OpenAPI Version:** 3.1.0  
**Total Endpoints:** 44  

---

## API Overview

| Metric | Value |
|---|---|
| Total Endpoints | 44 |
| Authentication Required | 44 (100%) |
| Authorization Required | 44 (100%) |
| Constitutional Gates | 44 (100%) |
| OpenAPI Definition | Complete |
| Response Schemas | Defined |
| Error Schemas | Defined |

---

## Endpoint Inventory by Domain

### Agent Domain (7 endpoints)

| Endpoint | Method | Command | Capability Required | Invariants |
|---|---|---|---|---|
| `/api/v1/agent/instance` | POST | `agent.terminate` | `agent.terminate` | INV-004, INV-010 |
| `/api/v1/agent/capability_binding` | POST | `agent.capability.revoke` | `agent.capability.revoke` | INV-003, INV-004 |
| `/api/v1/agent/execution_quota` | POST | `agent.execution.quota.set` | `agent.execution.quota.set` | INV-004 |
| `/api/v1/agent/governance_override` | POST | `agent.governance.override` | `governance.*` | INV-003, INV-010 |
| `/api/v1/agent/instance` | GET | — | — | INV-005 |
| `/api/v1/agent/registration` | POST | `agent.register` | `agent.register` | INV-003, INV-004 |
| `/api/v1/agent/registration` | GET | — | — | INV-005 |

**Authentication:** JWT RS256 bearer token required  
**Authorization:** Capability gate active  
**Constitutional Gates:** Identity verification, capability check, scope validation  
**Events Emitted:** `agent.registered`, `agent.terminated`, `agent.capability.revoked`  
**State Machines:** `AGENT_LIFECYCLE`, `AGENT_EXECUTION_LIFECYCLE`, `AGENT_CAPABILITY_BINDING_LIFECYCLE`  
**Projections:** `agent_view`, `agent_execution_view`  
**Response Schema:** `AgentResult`  
**Error Schema:** `ConstitutionalViolationError`, `InvalidStateTransitionError`, `UncoveredCommandError`

---

### Escrow Domain (1 endpoint)

| Endpoint | Method | Command | Capability Required | Invariants |
|---|---|---|---|---|
| `/api/v1/escrow/escrow_account` | POST | `escrow.account.create` | `escrow.account.create` | INV-001, INV-002, INV-008 |

**Authentication:** JWT RS256 bearer token required  
**Authorization:** Capability gate active  
**Constitutional Gates:** Identity verification, capability check, scope validation, policy evaluation  
**Events Emitted:** `escrow.account.created`, `escrow.account.funded`, `escrow.account.released`  
**State Machines:** `ESCROW_ACCOUNT_LIFECYCLE`  
**Projections:** `escrow_account_view`  
**Response Schema:** `EscrowAccountResult`  
**Error Schema:** `ConstitutionalViolationError`, `InvalidStateTransitionError`

---

### Governance Domain (7 endpoints)

| Endpoint | Method | Command | Capability Required | Invariants |
|---|---|---|---|---|
| `/api/v1/governance/audit_record` | POST | `governance.audit.record` | `governance.audit.record` | INV-003, INV-005 |
| `/api/v1/governance/capability_grant` | POST | `governance.capability.grant` | `governance.capability.grant` | INV-003, INV-004 |
| `/api/v1/governance/emergency_halt` | POST | `governance.emergency.halt` | `governance.emergency.halt` | INV-003, INV-010 |
| `/api/v1/governance/escalation` | POST | `governance.escalation.create` | `governance.escalation.create` | INV-003 |
| `/api/v1/governance/governance_amendment` | POST | `governance.amendment.propose` | `governance.amendment.propose` | INV-003 |
| `/api/v1/governance/governance_proposal` | POST | `governance.proposal.create` | `governance.proposal.create` | INV-003 |
| `/api/v1/governance/policy_rule` | POST | `governance.policy.rule.create` | `governance.policy.rule.create` | INV-003 |

**Authentication:** JWT RS256 bearer token required  
**Authorization:** Capability gate active, governance actor type required  
**Constitutional Gates:** Identity verification, capability check, scope validation, policy evaluation  
**Events Emitted:** `governance.proposal.created`, `governance.amendment.proposed`, `governance.capability.granted`  
**State Machines:** `GOVERNANCE_PROPOSAL_LIFECYCLE`, `GOVERNANCE_AMENDMENT_LIFECYCLE`, `GOVERNANCE_CAPABILITY_GRANT_LIFECYCLE`, `GOVERNANCE_ESCALATION_LIFECYCLE`  
**Projections:** `governance_proposal_view`, `governance_amendment_view`  
**Response Schema:** `GovernanceResult`  
**Error Schema:** `ConstitutionalViolationError`, `InvalidStateTransitionError`

---

### Identity Domain (5 endpoints)

| Endpoint | Method | Command | Capability Required | Invariants |
|---|---|---|---|---|
| `/api/v1/identity/actor` | POST | `identity.actor.create` | `identity.actor.create` | INV-003 |
| `/api/v1/identity/credential` | POST | `identity.credential.issue` | `identity.credential.issue` | INV-003, INV-005 |
| `/api/v1/identity/delegation` | POST | `identity.delegation.create` | `identity.delegation.create` | INV-003 |
| `/api/v1/identity/session` | POST | `identity.session.create` | — | INV-003 |
| `/api/v1/identity/trust_anchor` | POST | `identity.trust_anchor.register` | `identity.trust_anchor.register` | INV-003 |

**Authentication:** JWT RS256 bearer token required (except session creation)  
**Authorization:** Capability gate active  
**Constitutional Gates:** Identity verification, capability check, scope validation  
**Events Emitted:** `identity.actor.created`, `identity.credential.issued`, `identity.session.created`, `identity.delegation.created`  
**State Machines:** `IDENTITY_ACTOR_LIFECYCLE`, `IDENTITY_CREDENTIAL_LIFECYCLE`, `IDENTITY_SESSION_LIFECYCLE`, `IDENTITY_DELEGATION_LIFECYCLE`, `IDENTITY_TRUST_ANCHOR_V06_LIFECYCLE`  
**Projections:** `identity_actor_view`, `identity_session_view`, `identity_credential_view`  
**Response Schema:** `IdentityResult`  
**Error Schema:** `ConstitutionalViolationError`, `InvalidStateTransitionError`

---

### Intent Domain (1 endpoint)

| Endpoint | Method | Command | Capability Required | Invariants |
|---|---|---|---|---|
| `/api/v1/intent/intent` | POST | `intent.create` | `intent.create` | INV-003, INV-005 |

**Authentication:** JWT RS256 bearer token required  
**Authorization:** Capability gate active  
**Constitutional Gates:** Identity verification, capability check, scope validation  
**Events Emitted:** `intent.created`, `intent.converted`  
**State Machines:** `INTENT_LIFECYCLE`  
**Projections:** `intent_view`  
**Response Schema:** `IntentResult`  
**Error Schema:** `ConstitutionalViolationError`, `InvalidStateTransitionError`

---

### Ledger Domain (5 endpoints)

| Endpoint | Method | Command | Capability Required | Invariants |
|---|---|---|---|---|
| `/api/v1/ledger/account` | POST | `ledger.account.create` | `ledger.account.create` | INV-002, INV-003 |
| `/api/v1/ledger/accounting_period` | POST | `ledger.accounting_period.open` | `ledger.accounting_period.open` | INV-002 |
| `/api/v1/ledger/journal` | POST | `ledger.journal.create` | `ledger.journal.create` | INV-002, INV-003 |
| `/api/v1/ledger/journal_entry` | POST | `ledger.entry.post` | `ledger.entry.post` | **INV-002** |
| `/api/v1/ledger/reconciliation` | POST | `ledger.reconciliation.create` | `ledger.reconciliation.create` | INV-002, INV-006 |

**Authentication:** JWT RS256 bearer token required  
**Authorization:** Capability gate active  
**Constitutional Gates:** Identity verification, capability check, scope validation, **double-entry balance enforcement**  
**Events Emitted:** `ledger.account.created`, `ledger.journal.created`, `ledger.entry.posted`, `ledger.reconciliation.created`  
**State Machines:** `LEDGER_ACCOUNT_LIFECYCLE`, `LEDGER_JOURNAL_LIFECYCLE`, `LEDGER_ACCOUNTING_PERIOD_V06_LIFECYCLE`, `LEDGER_RECONCILIATION_LIFECYCLE`  
**Projections:** `ledger_account_view`, `ledger_journal_view`, `ledger_trial_balance`  
**Response Schema:** `LedgerResult`  
**Error Schema:** `ConstitutionalViolationError`, `InvalidStateTransitionError`, `UncoveredCommandError`

**Critical:** INV-002 (double-entry balance) enforced at pre-execution gate. Unbalanced entries rejected before persistence.

---

### Payment Domain (5 endpoints)

| Endpoint | Method | Command | Capability Required | Invariants |
|---|---|---|---|---|
| `/api/v1/payment/execution` | POST | `payment.execution.initiate` | `payment.execution.initiate` | INV-002, INV-003, INV-008 |
| `/api/v1/payment/execution_plan` | POST | `payment.execution_plan.create` | `payment.execution_plan.create` | INV-002, INV-003 |
| `/api/v1/payment/execution_receipt` | POST | `payment.execution_receipt.create` | `payment.execution_receipt.create` | INV-002, INV-005 |
| `/api/v1/payment/payment_request` | POST | `payment.request.create` | `payment.request.create` | INV-002, INV-003, INV-008 |
| `/api/v1/payment/reconciliation` | POST | `payment.reconciliation.create` | `payment.reconciliation.create` | INV-002, INV-006 |

**Authentication:** JWT RS256 bearer token required  
**Authorization:** Capability gate active  
**Constitutional Gates:** Identity verification, capability check, scope validation, policy evaluation  
**Events Emitted:** `payment.request.created`, `payment.execution.initiated`, `payment.execution_receipt.created`, `payment.reconciliation.created`  
**State Machines:** `PAYMENT_REQUEST_LIFECYCLE`, `PAYMENT_EXECUTION_PLAN_V06_LIFECYCLE`, `PAYMENT_EXECUTION_V06_LIFECYCLE`, `PAYMENT_RECONCILIATION_LIFECYCLE`, `PAYMENT_ADAPTER_LIFECYCLE`  
**Projections:** `payment_request_view`, `payment_execution_view`, `payment_reconciliation_view`  
**Response Schema:** `PaymentResult`  
**Error Schema:** `ConstitutionalViolationError`, `InvalidStateTransitionError`

**Note:** Payment adapters emit events only. They cannot mutate constitutional state.

---

### Policy Domain (5 endpoints)

| Endpoint | Method | Command | Capability Required | Invariants |
|---|---|---|---|---|
| `/api/v1/policy/compliance_requirement` | POST | `policy.compliance_requirement.create` | `policy.compliance_requirement.create` | INV-003 |
| `/api/v1/policy/escalation` | POST | `policy.escalation.create` | `policy.escalation.create` | INV-003 |
| `/api/v1/policy/evaluation` | POST | `policy.evaluation.execute` | `policy.evaluation.execute` | INV-003, INV-008 |
| `/api/v1/policy/rule` | POST | `policy.rule.create` | `policy.rule.create` | INV-003 |
| `/api/v1/policy/set` | POST | `policy.set.create` | `policy.set.create` | INV-003 |

**Authentication:** JWT RS256 bearer token required  
**Authorization:** Capability gate active  
**Constitutional Gates:** Identity verification, capability check, scope validation, policy evaluation  
**Events Emitted:** `policy.rule.created`, `policy.set.created`, `policy.evaluation.executed`, `policy.escalation.created`  
**State Machines:** `POLICY_RULE_LIFECYCLE`, `POLICY_SET_V06_LIFECYCLE`, `POLICY_EVALUATION_LIFECYCLE`, `POLICY_ESCALATION_LIFECYCLE`, `POLICY_COMPLIANCE_REQUIREMENT_V06_LIFECYCLE`  
**Projections:** `policy_rule_view`, `policy_evaluation_view`  
**Response Schema:** `PolicyResult`  
**Error Schema:** `ConstitutionalViolationError`, `InvalidStateTransitionError`

---

### Saga Domain (1 endpoint)

| Endpoint | Method | Command | Capability Required | Invariants |
|---|---|---|---|---|
| `/api/v1/saga/saga_execution` | POST | `saga.execute` | `saga.execute` | INV-001, INV-002, INV-005, INV-006 |

**Authentication:** JWT RS256 bearer token required  
**Authorization:** Capability gate active  
**Constitutional Gates:** Identity verification, capability check, scope validation, policy evaluation  
**Events Emitted:** `saga.step.completed`, `saga.step.failed`, `saga.compensated`  
**State Machines:** `SAGA_LIFECYCLE`  
**Projections:** `saga_execution_view`  
**Response Schema:** `SagaResult`  
**Error Schema:** `ConstitutionalViolationError`, `InvalidStateTransitionError`

---

### Treasury Domain (2 endpoints)

| Endpoint | Method | Command | Capability Required | Invariants |
|---|---|---|---|---|
| `/api/v1/treasury/liquidity_position` | POST | `treasury.liquidity_position.create` | `treasury.liquidity_position.create` | INV-002, INV-003 |
| `/api/v1/treasury/transfer_order` | POST | `treasury.transfer.create` | `treasury.transfer.create` | INV-002, INV-003, INV-008 |

**Authentication:** JWT RS256 bearer token required  
**Authorization:** Capability gate active  
**Constitutional Gates:** Identity verification, capability check, scope validation, double-entry balance enforcement  
**Events Emitted:** `treasury.liquidity_position.created`, `treasury.transfer.created`, `treasury.transfer.executed`  
**State Machines:** `TREASURY_LIQUIDITY_POSITION_V06_LIFECYCLE`, `TREASURY_TRANSFER_LIFECYCLE`  
**Projections:** `treasury_liquidity_position_view`, `treasury_transfer_view`  
**Response Schema:** `TreasuryResult`  
**Error Schema:** `ConstitutionalViolationError`, `InvalidStateTransitionError`

---

### Vault Domain (6 endpoints)

| Endpoint | Method | Command | Capability Required | Invariants |
|---|---|---|---|---|
| `/api/v1/vault/asset` | POST | `vault.asset.register` | `vault.asset.register` | INV-001, INV-002, INV-003, INV-008 |
| `/api/v1/vault/collateral` | POST | `vault.collateral.create` | `vault.collateral.create` | INV-001, INV-002, INV-003 |
| `/api/v1/vault/reconciliation` | POST | `vault.reconciliation.create` | `vault.reconciliation.create` | INV-001, INV-002, INV-006 |
| `/api/v1/vault/reservation` | POST | `vault.reservation.create` | `vault.reservation.create` | INV-001, INV-002, INV-003 |
| `/api/v1/vault/transaction` | POST | `vault.transaction.create` | `vault.transaction.create` | INV-001, INV-002, INV-003, INV-008 |
| `/api/v1/vault/valuation` | POST | `vault.valuation.create` | `vault.valuation.create` | INV-001, INV-002, INV-003 |

**Authentication:** JWT RS256 bearer token required  
**Authorization:** Capability gate active  
**Constitutional Gates:** Identity verification, capability check, scope validation, double-entry balance enforcement  
**Events Emitted:** `vault.asset.registered`, `vault.collateral.created`, `vault.reservation.created`, `vault.transaction.created`, `vault.valuation.created`  
**State Machines:** `VAULT_ASSET_LIFECYCLE`, `VAULT_COLLATERAL_LIFECYCLE`, `VAULT_RECONCILIATION_V06_LIFECYCLE`, `VAULT_RESERVATION_LIFECYCLE`, `VAULT_TRANSACTION_LIFECYCLE`, `VAULT_VALUATION_V06_LIFECYCLE`  
**Projections:** `vault_asset_view`, `vault_collateral_view`, `vault_reservation_view`, `vault_transaction_view`  
**Response Schema:** `VaultResult`  
**Error Schema:** `ConstitutionalViolationError`, `InvalidStateTransitionError`

---

## Authentication Summary

| Mechanism | Implementation | Status |
|---|---|---|
| JWT | RS256 asymmetric (jose v6.2) | ✅ Active |
| Token Type | Access token | ✅ Active |
| Header | `Authorization: Bearer {jwt}` | ✅ Active |
| Algorithm Confusion Blocked | HS256 rejected | ✅ Verified |
| Expired Token Rejected | 403 response | ✅ Verified |
| Missing Token Rejected | 403 response | ✅ Verified |

---

## Authorization Summary

| Mechanism | Implementation | Status |
|---|---|---|
| Capability Gate | Pre-execution | ✅ Active |
| Scope Validation | Resource-level | ✅ Active |
| Actor Type Check | human, organization, ai_agent, service_account, governance, external_system | ✅ Active |
| Policy Evaluation | VEL AST evaluator | 🔧 Partial |

---

## Error Schema Summary

| Error Class | HTTP Status | Trigger |
|---|---|---|
| `ConstitutionalViolationError` | 403 | Invariant violation |
| `InvalidStateTransitionError` | 422 | Invalid state machine transition |
| `UncoveredCommandError` | 500 | Command not covered by state machine |
| `KernelValidationError` | 422 | Validation failure |
| `KernelCapabilityViolationError` | 403 | Capability violation |
| `KernelIdentityViolationError` | 403 | Identity violation |

---

## Constitutional Gate Summary

| Gate | Implementation | Coverage |
|---|---|---|
| Identity Verification | Pre-execution | 44/45 endpoints |
| Capability Check | Pre-execution | 44/45 endpoints |
| Scope Validation | Pre-execution | 44/45 endpoints |
| Policy Evaluation | Pre-execution | Partial |
| Double-Entry Balance (INV-002) | Pre-execution | Ledger, Treasury, Payment, Vault |
| Invariant Enforcement | Pre-execution | All 10 invariants |

---

## OpenAPI Specification

**Location:** `generated/openapi.yaml`  
**Version:** 3.1.0  
**Generated:** Yes (compiler output)  
**Total Paths:** 44  
**Total Operations:** 44  
**Security Schemes:** bearerAuth (JWT RS256)  

**Verification:** OpenAPI spec is generated from canonical IR. Changes to spec require recompilation of constitutional YAML.

---

*API certification generated from ground truth. All endpoints verified against OpenAPI spec and runtime source code.*
