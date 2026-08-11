# Event Reference

> **Compiler-generated reference documentation**
> Generated at: 2026-08-11T13:54:07.400Z
> Source: generated/registries/events.registry.json

## Summary

| Metric | Count |
| --- | --- |
| Total Events | 267 |
| ABI Version | v1 |

## Events

| Event | Domain | Amendment | TriggeredBy | Triggers | Description |
| --- | --- | --- | --- | --- | --- |
| agent.activated |  |  |  |  | An agent instance has been activated |
| agent.capability.bound |  |  |  |  | A capability has been bound to an agent |
| agent.capability.revoked |  |  |  |  | A capability has been revoked from an agent |
| agent.concurrency.limit_reached |  |  |  |  | An agent has reached its concurrency limit |
| agent.execution.completed |  |  |  |  | An agent execution has completed |
| agent.execution.escalated |  |  |  |  | An agent execution has been escalated |
| agent.execution.failed |  |  |  |  | An agent execution has failed |
| agent.execution.started |  |  |  |  | An agent execution has started |
| agent.governance.override.issued |  |  |  |  | A governance override has been issued for an agent |
| agent.quota.checked |  |  |  |  | Agent quota usage and concurrency limits checked |
| agent.quota.exceeded |  |  |  |  | An agent has exceeded its quota |
| agent.registration.approved |  |  |  |  | An agent registration has been approved |
| agent.registration.rejected |  |  |  |  | An agent registration has been rejected |
| agent.registration.submitted |  |  |  |  | An agent registration has been submitted |
| agent.suspended |  |  |  |  | An agent instance has been suspended |
| agent.terminated |  |  |  |  | An agent instance has been terminated |
| agent.termination_failed |  |  |  |  | Agent termination or suspension failed |
| AttestationSigned | certification | AMD-0005 | SignAttestation | SettlementFinalized | Attestor signed evidence package. Constitutional chain of custody verified. SVU issuance unlocked.  |
| CommercialRecordCreated | commercial | AMD-0005 | CreateCommercialObligation |  | Genesis event of the constitutional chain of custody. Commercial obligation formally recorded in SOVR. Nothing may precede this event in the provenance chain.  |
| escalation.notification.failed |  |  |  |  | Escalation notification delivery failed |
| escalation.notification.sent |  |  |  |  | Escalation notification dispatched |
| escalation.resolution.notification.sent |  |  |  |  | Escalation resolution notification dispatched |
| escrow.account.cancelled |  |  |  |  | Escrow account cancelled |
| escrow.account.created |  |  |  |  | Escrow account created |
| escrow.account.creation_failed |  |  |  |  | Escrow account creation failed |
| escrow.account.funded |  |  |  |  | Escrow account funded |
| escrow.account.funding_failed |  |  |  |  | Escrow account funding failed |
| escrow.account.release_failed |  |  |  |  | Escrow account release failed |
| escrow.account.released |  |  |  |  | Escrow account released |
| EvidencePackageGenerated | certification | AMD-0005 | GenerateEvidencePackage |  | JDE evidence package generated. 10 documents rendered. SHA-256 manifest computed. Awaiting attestor signature.  |
| governance.amendment.proposal_failed |  |  |  |  | Amendment proposal failed |
| governance.amendment.proposed |  |  |  |  | A constitutional amendment has been proposed |
| governance.amendment.ratification_failed |  |  |  |  | Amendment ratification failed |
| governance.amendment.ratified |  |  |  |  | A constitutional amendment has been ratified |
| governance.audit.queried |  |  |  |  | An audit query has been executed |
| governance.audit.query_failed |  |  |  |  | Audit query failed |
| governance.capability.grant_failed |  |  |  |  | Capability grant failed |
| governance.capability.granted |  |  |  |  | A capability has been granted to an actor |
| governance.capability.revoke_failed |  |  |  |  | Capability revoke failed |
| governance.capability.revoked |  |  |  |  | A capability has been revoked from an actor |
| governance.emergency_halt.failed |  |  |  |  | Emergency halt failed |
| governance.emergency_halt.issued |  |  |  |  | An emergency system halt has been issued |
| governance.emergency_halt.lift_failed |  |  |  |  | Emergency halt lift failed |
| governance.emergency_halt.lifted |  |  |  |  | An emergency system halt has been lifted |
| governance.escalation.expired |  |  |  |  | A governance escalation has expired without resolution |
| governance.escalation.resolution_failed |  |  |  |  | Escalation resolution failed |
| governance.escalation.resolved |  |  |  |  | A governance escalation has been resolved |
| governance.escalation.submission_failed |  |  |  |  | Escalation submission failed governance intake |
| governance.escalation.submitted |  |  |  |  | A governance escalation has been submitted |
| governance.oversight.review_failed |  |  |  |  | Oversight review failed |
| governance.oversight.reviewed |  |  |  |  | An oversight review has been completed |
| governance.policy_rule.activated.notification.sent |  |  |  |  | Notification sent to affected domains after policy rule activation |
| governance.policy_rule.review_failed |  |  |  |  | Policy rule review failed |
| governance.policy_rule.review_requested |  |  |  |  | Governance review has been requested for a policy rule |
| governance.proposal.approval_failed |  |  |  |  | Governance proposal approval failed |
| governance.proposal.approved |  |  |  |  | A governance proposal has been approved |
| governance.proposal.cancelled |  |  |  |  | A governance proposal has been cancelled |
| governance.proposal.expired |  |  |  |  | A governance proposal has expired without action |
| governance.proposal.implemented |  |  |  |  | A governance proposal has been implemented |
| governance.proposal.rejected |  |  |  |  | A governance proposal has been rejected |
| governance.proposal.rejection_failed |  |  |  |  | Governance proposal rejection failed |
| governance.proposal.submission_failed |  |  |  |  | Governance proposal submission failed |
| governance.proposal.submitted |  |  |  |  | A new governance proposal has been submitted |
| identity.actor.archived |  |  |  |  | Actor has been archived |
| identity.actor.registered |  |  |  |  | A new actor has been registered in the Identity subsystem |
| identity.actor.registration_failed |  |  |  |  | Actor registration failed |
| identity.actor.revocation_failed |  |  |  |  | Actor revocation failed |
| identity.actor.revoked |  |  |  |  | An actor has been revoked |
| identity.actor.suspended |  |  |  |  | An actor has been suspended |
| identity.actor.suspension_failed |  |  |  |  | Actor suspension failed |
| identity.actor.verification_failed |  |  |  |  | Actor verification failed |
| identity.actor.verified |  |  |  |  | An actor has been verified by an authority |
| identity.authentication.failed |  |  |  |  | An authentication attempt has failed |
| identity.authentication.succeeded |  |  |  |  | An authentication attempt has succeeded |
| identity.authority.allowed |  |  |  |  | Authority level allowed after evaluation |
| identity.authority.denied |  |  |  |  | Authority level denied during evaluation |
| identity.authority.determination.notification.sent |  |  |  |  | Notification sent regarding authority determination |
| identity.authority.flagged_unknown |  |  |  |  | Authority flagged as unknown for escalation |
| identity.authority.marked_unknown |  |  |  |  | Authority explicitly marked unknown |
| identity.authority.unknown |  |  |  |  | Authority level unknown for actor |
| identity.credential.expired |  |  |  |  | A credential has expired |
| identity.credential.issuance_failed |  |  |  |  | Credential issuance failed |
| identity.credential.issued |  |  |  |  | A credential has been issued to an actor |
| identity.credential.revocation_failed |  |  |  |  | Credential revocation failed |
| identity.credential.revoked |  |  |  |  | A credential has been revoked |
| identity.delegation.created |  |  |  |  | A delegation of authority has been created |
| identity.delegation.creation_failed |  |  |  |  | Delegation creation failed |
| identity.delegation.expired |  |  |  |  | A delegation of authority has expired |
| identity.delegation.limit_exceeded |  |  |  |  | A delegation chain depth limit has been exceeded |
| identity.delegation.revocation_failed |  |  |  |  | Delegation revocation failed |
| identity.delegation.revoked |  |  |  |  | A delegation of authority has been revoked |
| identity.delegation.verified |  |  |  |  | Identity delegation verified during check |
| identity.session.authentication_failed |  |  |  |  | An identity session authentication attempt failed |
| identity.session.created |  |  |  |  | A new session has been created for an authenticated actor |
| identity.session.creation_failed |  |  |  |  | Session creation failed |
| identity.session.expired |  |  |  |  | A session has expired |
| identity.session.terminated |  |  |  |  | A session has been terminated |
| identity.session.termination_failed |  |  |  |  | Session termination failed |
| identity.trust_anchor.registered |  |  |  |  | A trust anchor has been registered |
| identity.trust_anchor.registration_failed |  |  |  |  | Trust anchor registration failed |
| intent.archived |  |  |  |  | An intent has been archived |
| intent.cancelled |  |  |  |  | An intent has been cancelled |
| intent.converted_to_command |  |  |  |  | An intent has been converted to a command |
| intent.enriching.completed |  |  |  |  | Intent enrichment has been completed |
| intent.enriching.failed |  |  |  |  | Intent enrichment has failed |
| intent.enriching.started |  |  |  |  | Intent enrichment has started |
| intent.expired |  |  |  |  | An intent has expired |
| intent.failed |  |  |  |  | An intent has failed |
| intent.multi_step.completed |  |  |  |  | A multi-step intent has been completed |
| intent.multi_step.failed |  |  |  |  | A multi-step intent has failed |
| intent.multi_step.step_completed |  |  |  |  | A step within a multi-step intent has been completed |
| intent.received |  |  |  |  | A new intent has been received from an actor |
| intent.rejected |  |  |  |  | Intent rejected during intake or enrichment |
| intent.resumed |  |  |  |  | Intent evaluation resumed after escalation resolution |
| intent.submitted |  |  |  |  | Intent submitted by external client or agent |
| intent.validated |  |  |  |  | An intent has been validated and is ready for conversion |
| intent.validation_failed |  |  |  |  | Intent validation failed policy rules |
| intent.validation.completed |  |  |  |  | Intent validation has been completed |
| ledger.account.closed |  |  |  |  | A ledger account has been closed |
| ledger.account.created |  |  |  |  | A new account has been added to the chart of accounts |
| ledger.account.creation_failed |  |  |  |  | Account creation failed |
| ledger.account.freeze_failed |  |  |  |  | Ledger account freeze failed |
| ledger.account.frozen |  |  |  |  | An account has been frozen, preventing new postings |
| ledger.entry.corrected |  |  |  |  | A compensating correction entry has been posted |
| ledger.entry.correction_failed |  |  |  |  | Journal entry correction failed |
| ledger.entry.posted |  |  |  |  | A journal entry has been validated and posted to the ledger |
| ledger.entry.rejected |  |  |  |  | A journal entry failed validation and was rejected |
| ledger.entry.rejection_failed |  |  |  |  | Journal entry rejection failed |
| ledger.entry.reversal_failed |  |  |  |  | Journal entry reversal failed |
| ledger.entry.reversed |  |  |  |  | A journal entry has been reversed by a new entry with inverse postings |
| ledger.journal.created |  |  |  |  | A new journal has been created in the ledger |
| ledger.journal.creation_failed |  |  |  |  | Journal creation failed |
| ledger.period.close_failed |  |  |  |  | Accounting period close failed |
| ledger.period.closed |  |  |  |  | An accounting period has been fully closed |
| ledger.period.closing |  |  |  |  | An accounting period is being closed with closing entries |
| ledger.reconciliation.completed |  |  |  |  | A ledger reconciliation has been resolved |
| ledger.reconciliation.mismatch_detected |  |  |  |  | A discrepancy was found during ledger reconciliation |
| ledger.reconciliation.resolution_failed |  |  |  |  | Ledger reconciliation resolution failed |
| ledger.reconciliation.start_failed |  |  |  |  | Ledger reconciliation start failed |
| ledger.reconciliation.started |  |  |  |  | A ledger reconciliation process has been initiated |
| ObligationValidated | commercial | AMD-0005 | ValidateObligation |  | Commercial obligation confirmed valid and eligible for settlement processing.  |
| payment.compensation.completed |  |  |  |  | payment.compensation.completed |
| payment.compensation.start_failed |  |  |  |  | Payment compensation start failed |
| payment.compensation.started |  |  |  |  | payment.compensation.started |
| payment.compensation.timed_out |  |  |  |  | Payment compensation timed out |
| payment.execution.compensated |  |  |  |  | Payment execution compensated after saga failure |
| payment.execution.compensation_failed |  |  |  |  | Payment execution compensation failed |
| payment.execution.completed |  |  |  |  | payment.execution.completed |
| payment.execution.confirmation_failed |  |  |  |  | Payment execution confirmation failed |
| payment.execution.failed |  |  |  |  | payment.execution.failed |
| payment.execution.planned |  |  |  |  | payment.execution.planned |
| payment.execution.planning_failed |  |  |  |  | Payment execution plan generation failed |
| payment.execution.settled |  |  |  |  | A payment execution has been settled |
| payment.execution.start_failed |  |  |  |  | Payment execution start failed |
| payment.execution.started |  |  |  |  | payment.execution.started |
| payment.rail.confirmation_timed_out |  |  |  |  | Rail confirmation phase timed out for a payment request |
| payment.rail.confirmed |  |  |  |  | payment.rail.confirmed |
| payment.rail.confirming |  |  |  |  | A payment request is being confirmed on a rail |
| payment.rail.executed |  |  |  |  | payment.rail.executed |
| payment.rail.executing |  |  |  |  | A payment request is executing on a rail |
| payment.rail.execution_timed_out |  |  |  |  | Rail execution phase timed out for a payment request |
| payment.rail.failed |  |  |  |  | payment.rail.failed |
| payment.rail.prepare_timed_out |  |  |  |  | Rail preparation phase timed out for a payment request |
| payment.rail.prepared |  |  |  |  | payment.rail.prepared |
| payment.rail.preparing |  |  |  |  | A payment request is being prepared on a rail |
| payment.rail.validated |  |  |  |  | A payment request has been validated on a rail |
| payment.rail.validating |  |  |  |  | A payment request is being validated on a rail |
| payment.rail.validation_timed_out |  |  |  |  | Rail validation phase timed out for a payment request |
| payment.receipt.issuance_failed |  |  |  |  | Payment receipt issuance failed |
| payment.receipt.issued |  |  |  |  | payment.receipt.issued |
| payment.reconciliation.completed |  |  |  |  | payment.reconciliation.completed |
| payment.reconciliation.completion_failed |  |  |  |  | Payment reconciliation completion failed |
| payment.reconciliation.discrepancy |  |  |  |  | payment.reconciliation.discrepancy |
| payment.reconciliation.start_failed |  |  |  |  | Payment reconciliation start failed |
| payment.reconciliation.started |  |  |  |  | payment.reconciliation.started |
| payment.reconciliation.timed_out |  |  |  |  | Payment reconciliation timed out |
| payment.request.cancellation_failed |  |  |  |  | Payment request cancellation failed |
| payment.request.cancelled |  |  |  |  | payment.request.cancelled |
| payment.request.created |  |  |  |  | payment.request.created |
| payment.request.creation_failed |  |  |  |  | Payment request creation failed |
| payment.settlement.completed |  |  |  |  | A payment settlement has completed |
| payment.settlement.confirmed |  |  |  |  | A payment settlement has been confirmed |
| payment.settlement.failed |  |  |  |  | A payment settlement failed |
| policy.compliance.requirement.registered |  |  |  |  | A compliance requirement has been registered |
| policy.compliance.violation.detected |  |  |  |  | A compliance violation has been detected during evaluation |
| policy.escalation.cancel |  |  |  |  | Policy escalation cancelled |
| policy.escalation.created |  |  |  |  | A policy escalation has been created |
| policy.escalation.expired |  |  |  |  | Policy escalation window expired without resolution |
| policy.escalation.resolved |  |  |  |  | A policy escalation has been resolved |
| policy.evaluation.active_operation_blocked |  |  |  |  | Operation blocked by active policy evaluation rule |
| policy.evaluation.completed |  |  |  |  | A policy evaluation has been completed with a decision |
| policy.evaluation.deferred |  |  |  |  | A policy evaluation has been deferred to a later time |
| policy.evaluation.denied |  |  |  |  | A policy evaluation has resulted in a denial |
| policy.evaluation.escalated |  |  |  |  | A policy evaluation has been escalated for human review |
| policy.rule.activated |  |  |  |  | A policy rule has been activated |
| policy.rule.activation_failed |  |  |  |  | Policy rule activation failed verification |
| policy.rule.created |  |  |  |  | A new policy rule has been created |
| policy.rule.creation_failed |  |  |  |  | Policy rule creation failed validation |
| policy.rule.deactivated |  |  |  |  | A policy rule has been deactivated |
| policy.rule.updated |  |  |  |  | A policy rule has been updated to a new version |
| saga.compensated |  |  |  |  | A saga instance has been fully compensated |
| saga.compensating |  |  |  |  | A saga instance is in the compensating phase |
| saga.completed |  |  |  |  | A saga instance has completed successfully |
| saga.failed |  |  |  |  | A saga instance has failed |
| saga.started |  |  |  |  | A saga instance has started |
| SettlementAuthorized | settlement | AMD-0005 | AuthorizeSettlement | treasury.InitiateTransfer | Settlement formally authorized. Treasury transfer workflow initiated. Ledger posting imminent.  |
| SettlementExecuted | settlement | AMD-0005 | ExecuteSettlement | GenerateEvidencePackage | Settlement workflow completed. TigerBeetle transfer posted. Evidence generation triggered.  |
| SettlementFinalized | settlement | AMD-0005 | SignAttestation | IssueSVU (conditional on representation domain) | Settlement confirmed finalized. Evidence package signed. SVU issuance now permitted if required.  |
| SVUIssued | representation | AMD-0005 | IssueSVU |  | Settlement Value Units issued with full provenance. Every field traces back through the complete chain.  |
| SVURedeemed | representation | AMD-0005 | RedeemSVU |  | SVU redeemed against settlement obligation. Full audit trail preserved. Tokens burned.  |
| system.health.degraded |  |  |  |  | System health has degraded |
| system.health.halted |  |  |  |  | System health has halted |
| system.health.restored |  |  |  |  | System health has been restored |
| system.health.unknown |  |  |  |  | System health state is unknown |
| treasury.liquidity.warning |  |  |  |  | Liquidity has fallen below a configured threshold |
| treasury.settlement.confirmed |  |  |  |  | Settlement has been confirmed for a transfer |
| treasury.transfer.authorized |  |  |  |  | A transfer has passed identity, capability, and policy gates |
| treasury.transfer.compensation_required |  |  |  |  | A compensation saga has been initiated for a failed transfer |
| treasury.transfer.executing |  |  |  |  | Transfer execution has begun on the payment rail |
| treasury.transfer.expired |  |  |  |  | A transfer has expired without completing |
| treasury.transfer.failed |  |  |  |  | A transfer has failed during execution or settlement |
| treasury.transfer.rejected |  |  |  |  | A transfer has been rejected |
| treasury.transfer.requested |  |  |  |  | A new treasury transfer has been requested |
| treasury.transfer.reserved |  |  |  |  | Vault reservation has been locked for a transfer |
| treasury.transfer.settled |  |  |  |  | A transfer has been confirmed as settled |
| vault.asset.impaired |  |  |  |  | An asset has been marked as impaired due to value decline |
| vault.asset.registered |  |  |  |  | A new asset has been registered in the Vault |
| vault.asset.registration_failed |  |  |  |  | Asset registration failed |
| vault.asset.rejected |  |  |  |  | An asset has been rejected during verification |
| vault.asset.rejection_failed |  |  |  |  | Asset rejection failed |
| vault.asset.verification_failed |  |  |  |  | Vault asset verification or ownership transfer failed |
| vault.asset.verified |  |  |  |  | An asset has been verified to exist and be correct |
| vault.asset.write_down |  |  |  |  | An asset has been permanently written down |
| vault.collateral.added |  |  |  |  | An asset has been pledged as collateral |
| vault.collateral.addition_failed |  |  |  |  | Collateral addition failed |
| vault.collateral.liquidation_initiated |  |  |  |  | Collateral liquidation has begun after unresolved margin call |
| vault.collateral.margin_call |  |  |  |  | A margin call has been triggered on a collateral position |
| vault.collateral.release_failed |  |  |  |  | Collateral release failed |
| vault.collateral.released |  |  |  |  | Collateral has been released |
| vault.collateral.revaluation_failed |  |  |  |  | Collateral revaluation failed |
| vault.collateral.revalued |  |  |  |  | Collateral valuation has been updated due to market change |
| vault.collateral.valued |  |  |  |  | Collateral has been initially valued |
| vault.custody.attested |  |  |  |  | Custody has been attested (proof of asset existence) |
| vault.custody.proof_expired |  |  |  |  | A custody attestation has expired |
| vault.ownership.transferred |  |  |  |  | Ownership of an asset has been transferred |
| vault.reconciliation.completed |  |  |  |  | A vault reconciliation has completed successfully |
| vault.reconciliation.discrepancy_found |  |  |  |  | A discrepancy was found during reconciliation |
| vault.reconciliation.failed |  |  |  |  | Vault reconciliation failed |
| vault.reconciliation.started |  |  |  |  | A vault reconciliation has been initiated |
| vault.reserve.created |  |  |  |  | A value reservation has been created |
| vault.reserve.creation_failed |  |  |  |  | Reservation creation failed |
| vault.reserve.expired |  |  |  |  | A reservation has expired without being consumed |
| vault.reserve.lock_failed |  |  |  |  | Reservation lock failed |
| vault.reserve.locked |  |  |  |  | A reservation has been locked, committing the value |
| vault.reserve.release_failed |  |  |  |  | Reservation release failed |
| vault.reserve.released |  |  |  |  | A reservation has been released, returning value to available pool |
| vault.transaction.closed |  |  |  |  | Transaction lifecycle closed and settled |
| vault.transaction.created |  |  |  |  | Transaction created in vault |
| vault.transaction.disbursed |  |  |  |  | Transaction funds disbursed to target |
| vault.transaction.failed |  |  |  |  | Transaction cancelled or failed during lifecycle |
| vault.transaction.funded |  |  |  |  | Transaction funded via reservation lock |
| vault.transaction.funding_pending |  |  |  |  | Transaction funding pending reservation |
| vault.transaction.funding_requested |  |  |  |  | Transaction funding requested |
| vault.transaction.release_authorized |  |  |  |  | Transaction release authorized |
| vault.transaction.release_pending |  |  |  |  | Transaction release authorization pending |
| vault.valuation.update_failed |  |  |  |  | Valuation update failed |
| vault.valuation.updated |  |  |  |  | An asset valuation has been updated |
