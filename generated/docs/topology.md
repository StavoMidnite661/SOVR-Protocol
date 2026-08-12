### SOVR Financial OS — Protocol Topology Flowchart
```mermaid
flowchart TD
  %% Root Domains
  subgraph AGENT [AGENT Domain]
    capability_agent_activate(["CAPABILITY: activate"])
    capability_agent_capability_bind(["CAPABILITY: bind"])
    capability_agent_capability_revoke(["CAPABILITY: revoke"])
  end
  subgraph CERTIFICATION [CERTIFICATION Domain]
    capability_certification_package_archive(["CAPABILITY: archive"])
    capability_certification_package_generate(["CAPABILITY: generate"])
    capability_certification_package_publish(["CAPABILITY: publish"])
  end
  subgraph COMMERCIAL [COMMERCIAL Domain]
    capability_commercial_obligation_cancel(["CAPABILITY: cancel"])
    capability_commercial_obligation_create(["CAPABILITY: create"])
    capability_commercial_obligation_validate(["CAPABILITY: validate"])
  end
  subgraph ESCROW [ESCROW Domain]
    capability_escrow_account_cancel(["CAPABILITY: cancel"])
    capability_escrow_account_create(["CAPABILITY: create"])
    capability_escrow_account_fund(["CAPABILITY: fund"])
  end
  subgraph GOVERNANCE [GOVERNANCE Domain]
    capability_governance_amend_propose(["CAPABILITY: propose"])
    capability_governance_amend_ratify(["CAPABILITY: ratify"])
    capability_governance_audit_query(["CAPABILITY: query"])
  end
  subgraph HYBRID [HYBRID Domain]
    saga_cross_chain_settlement_saga(["SAGA: cross_chain_settlement_saga"])
  end
  subgraph IDENTITY [IDENTITY Domain]
    capability_identity_actor_archive(["CAPABILITY: archive"])
    capability_identity_actor_create(["CAPABILITY: create"])
    capability_identity_actor_read(["CAPABILITY: read"])
  end
  subgraph INTENT [INTENT Domain]
    capability_intent_archive(["CAPABILITY: archive"])
    capability_intent_cancel(["CAPABILITY: cancel"])
    capability_intent_convert(["CAPABILITY: convert"])
  end
  subgraph KERNEL [KERNEL Domain]
    event_saga_compensated(["EVENT: compensated"])
    event_saga_compensating(["EVENT: compensating"])
    event_saga_completed(["EVENT: completed"])
  end
  subgraph LEDGER [LEDGER Domain]
    capability_ledger_account_freeze(["CAPABILITY: freeze"])
    capability_ledger_account_manage(["CAPABILITY: manage"])
    capability_ledger_account_read(["CAPABILITY: read"])
  end
  subgraph PAYMENT [PAYMENT Domain]
    capability_payment_compensation_execute(["CAPABILITY: execute"])
    capability_payment_execution_compensate(["CAPABILITY: compensate"])
    capability_payment_execution_confirm(["CAPABILITY: confirm"])
  end
  subgraph POLICY [POLICY Domain]
    capability_policy_compliance_create(["CAPABILITY: create"])
    capability_policy_escalation_resolve(["CAPABILITY: resolve"])
    capability_policy_rule_activate(["CAPABILITY: activate"])
  end
  subgraph REPRESENTATION [REPRESENTATION Domain]
    capability_representation_svu_issue(["CAPABILITY: issue"])
    capability_representation_svu_redeem(["CAPABILITY: redeem"])
    command_IssueSVU(["COMMAND: IssueSVU"])
  end
  subgraph SETTLEMENT [SETTLEMENT Domain]
    capability_settlement_record_authorize(["CAPABILITY: authorize"])
    capability_settlement_record_cancel(["CAPABILITY: cancel"])
    capability_settlement_record_dispute(["CAPABILITY: dispute"])
  end
  subgraph TREASURY [TREASURY Domain]
    capability_treasury_liquidity_manage(["CAPABILITY: manage"])
    capability_treasury_liquidity_read(["CAPABILITY: read"])
    capability_treasury_settlement_confirm(["CAPABILITY: confirm"])
  end
  subgraph VAULT [VAULT Domain]
    capability_vault_asset_create(["CAPABILITY: create"])
    capability_vault_asset_impair(["CAPABILITY: impair"])
    capability_vault_asset_read(["CAPABILITY: read"])
  end
  command_agent_suspend -->|command_produces_event| event_agent_terminated
  command_agent_suspend -->|command_produces_event| event_agent_termination_failed
  command_ArchivePackage -->|command_produces_event| event_EvidencePackageArchivalFailed
  command_ArchivePackage -->|command_produces_event| event_EvidencePackageArchived
  command_AuthorizeSettlement -->|command_produces_event| event_SettlementAuthorizationFailed
  command_AuthorizeSettlement -->|command_produces_event| event_SettlementAuthorized
  command_CancelObligation -->|command_produces_event| event_ObligationCancellationFailed
  command_CancelObligation -->|command_produces_event| event_ObligationCancelled
  command_CancelSettlement -->|command_produces_event| event_SettlementCancellationFailed
  command_CancelSettlement -->|command_produces_event| event_SettlementCancelled
  command_CreateCommercialObligation -->|command_produces_event| event_CommercialRecordCreated
  command_CreateCommercialObligation -->|command_produces_event| event_CommercialRecordCreationFailed
  command_DisputeSettlement -->|command_produces_event| event_SettlementDisputed
  command_DisputeSettlement -->|command_produces_event| event_SettlementDisputeFailed
  command_escrow_account_cancel -->|command_produces_event| event_escrow_account_cancellation_failed
  command_escrow_account_cancel -->|command_produces_event| event_escrow_account_cancelled
  command_escrow_account_create -->|command_produces_event| event_escrow_account_created
  command_escrow_account_create -->|command_produces_event| event_escrow_account_creation_failed
  command_escrow_account_fund -->|command_produces_event| event_escrow_account_funded
  command_escrow_account_fund -->|command_produces_event| event_escrow_account_funding_failed
  command_escrow_account_release -->|command_produces_event| event_escrow_account_release_failed
  command_escrow_account_release -->|command_produces_event| event_escrow_account_released
  command_ExecuteSettlement -->|command_produces_event| event_SettlementExecuted
  command_ExecuteSettlement -->|command_produces_event| event_SettlementExecutionFailed
  command_GenerateEvidencePackage -->|command_produces_event| event_EvidencePackageGenerated
  command_GenerateEvidencePackage -->|command_produces_event| event_EvidencePackageGenerationFailed
  command_governance_amend_propose -->|command_produces_event| event_governance_amendment_proposal_failed
  command_governance_amend_propose -->|command_produces_event| event_governance_amendment_proposed
  command_governance_amend_ratify -->|command_produces_event| event_governance_amendment_ratification_failed
  command_governance_amend_ratify -->|command_produces_event| event_governance_amendment_ratified
```