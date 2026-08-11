# Capability Reference

> **Compiler-generated reference documentation**
> Generated at: 2026-08-11T13:54:07.400Z
> Source: generated/registries/capabilities.registry.json

## Summary

| Metric | Count |
| --- | --- |
| Total Capabilities | 113 |
| ABI Version | v1 |

## Capabilities

| Capability | Domain | Action | RiskLevel | ResourceType | Delegable | GovernanceApproval | Description |
| --- | --- | --- | --- | --- | --- | --- | --- |
| agent.activate | AGENT | UPDATE | HIGH | agent | No |  | Activate registered agents for operation |
| agent.capability.bind | AGENT | UPDATE | CRITICAL | agent_capability | No |  | Bind capabilities to agents |
| agent.capability.revoke | AGENT | DELETE | HIGH | agent_capability | No |  | Revoke capabilities from agents |
| agent.governance.override | AGENT | GOVERN | CRITICAL | agent | No |  | Issue governance override for agent operations |
| agent.quota.update | AGENT | UPDATE | HIGH | agent_quota | No |  | Update agent operational quotas and limits |
| agent.register | AGENT | CREATE | HIGH | agent | No |  | Register new AI agents in the system |
| agent.terminate | AGENT | DELETE | CRITICAL | agent | No |  | Permanently terminate agents from the system |
| escrow.account.cancel | escrow | cancel | HIGH | escrow_account | No |  | Cancel escrow accounts |
| escrow.account.create | escrow | create | HIGH | escrow_account | No |  | Create escrow accounts |
| escrow.account.fund | escrow | fund | HIGH | escrow_account | No |  | Fund escrow accounts |
| escrow.account.release | escrow | release | CRITICAL | escrow_account | No |  | Release escrow funds |
| governance.amend.propose | GOVERNANCE | CREATE | CRITICAL | amendment | No |  | Propose constitutional amendments |
| governance.amend.ratify | GOVERNANCE | GOVERN | CRITICAL | amendment | No |  | Ratify approved constitutional amendments |
| governance.audit.query | GOVERNANCE | READ | MEDIUM | audit_log | Yes |  | Query audit logs and compliance records |
| governance.capability.grant | GOVERNANCE | CREATE | CRITICAL | capability_grant | No |  | Grant capabilities to actors |
| governance.capability.revoke | GOVERNANCE | DELETE | CRITICAL | capability_grant | No |  | Revoke capabilities from actors |
| governance.emergency.halt | GOVERNANCE | GOVERN | CRITICAL | system | No |  | Emergency system halt — stops all operations |
| governance.escalation.resolve | GOVERNANCE | GOVERN | HIGH | escalation | No |  | Resolve governance escalations |
| governance.oversight.review | GOVERNANCE | AUDIT | HIGH | system_state | No |  | Review overall system state and health |
| governance.policy.review | GOVERNANCE | AUDIT | HIGH | policy_review | No |  | Review and audit policy compliance |
| governance.proposal.approve | GOVERNANCE | GOVERN | CRITICAL | proposal | No |  | Approve governance proposals |
| governance.proposal.create | GOVERNANCE | CREATE | HIGH | proposal | No |  | Create governance proposals for system changes |
| governance.proposal.reject | GOVERNANCE | GOVERN | HIGH | proposal | No |  | Reject governance proposals |
| identity.actor.archive | IDENTITY | UPDATE | HIGH | actor | No |  | Archive revoked or inactive actors |
| identity.actor.create | IDENTITY | CREATE | CRITICAL | actor | No |  | Register new actors in the system |
| identity.actor.read | IDENTITY | READ | LOW | actor | Yes |  | Query actor information and identity state |
| identity.actor.revoke | IDENTITY | DELETE | CRITICAL | actor | No |  | Permanently revoke actors from the system |
| identity.actor.suspend | IDENTITY | UPDATE | CRITICAL | actor | No |  | Suspend actors, preventing all operations |
| identity.actor.verify | IDENTITY | GOVERN | HIGH | actor | No |  | Verify actor identity and credentials |
| identity.credential.issue | IDENTITY | CREATE | HIGH | credential | No |  | Issue credentials to actors |
| identity.credential.revoke | IDENTITY | DELETE | HIGH | credential | No |  | Revoke credentials from actors |
| identity.delegation.create | IDENTITY | CREATE | MEDIUM | delegation | Yes |  | Create delegation relationships between actors |
| identity.delegation.revoke | IDENTITY | DELETE | MEDIUM | delegation | No |  | Revoke delegation relationships |
| identity.session.create | IDENTITY | CREATE | LOW | session | No |  | Create authentication sessions for actors |
| identity.session.terminate | IDENTITY | DELETE | MEDIUM | session | No |  | Terminate active authentication sessions |
| identity.trust_anchor.create | IDENTITY | CREATE | CRITICAL | trust_anchor | No |  | Register trust anchors in the identity subsystem |
| intent.archive | INTENT | UPDATE | LOW | intent | No |  | Archive completed or cancelled intents |
| intent.cancel | INTENT | DELETE | MEDIUM | intent | Yes |  | Cancel pending or in-progress intents |
| intent.convert | INTENT | EXECUTE | HIGH | intent | No |  | Convert validated intent to executable command |
| intent.enrich | INTENT | EXECUTE | LOW | intent | No |  | Enrich intent with resolved context and parameters |
| intent.multi_step.advance | INTENT | EXECUTE | MEDIUM | multi_step_intent | No |  | Advance multi-step intent to next stage |
| intent.multi_step.create | INTENT | CREATE | HIGH | multi_step_intent | Yes |  | Create multi-step intent orchestration plans |
| intent.read | INTENT | READ | LOW | intent | Yes |  | Query intent state and processing status |
| intent.submit | INTENT | CREATE | MEDIUM | intent | Yes |  | Submit intents to the intent processor |
| intent.validate | INTENT | EXECUTE | LOW | intent | No |  | Validate intent parameters and feasibility |
| ledger.account.freeze | LEDGER | GOVERN | HIGH | account | No |  | Freeze a ledger account |
| ledger.account.manage | LEDGER | CREATE | HIGH | account | No |  | Create and manage ledger accounts |
| ledger.account.read | LEDGER | READ | LOW | account | Yes |  | Query account balances and ledger account state |
| ledger.balance.query | LEDGER | READ | LOW | account_balance | Yes |  | Query account balance |
| ledger.entry.correct | LEDGER | EXECUTE | CRITICAL | ledger_entry | No |  | Apply corrections to ledger entries |
| ledger.entry.post | LEDGER | CREATE | CRITICAL | ledger_entry | No |  | Post balanced entries to the general ledger |
| ledger.entry.reverse | LEDGER | EXECUTE | CRITICAL | ledger_entry | No |  | Reverse a posted ledger entry |
| ledger.journal.compensate | LEDGER | EXECUTE | HIGH | journal_entry | No |  | Create a compensating journal entry |
| ledger.journal.create | LEDGER | CREATE | HIGH | journal_entry | Yes |  | Create journal entries in the ledger |
| ledger.journal.manage | LEDGER | UPDATE | HIGH | journal_entry | No |  | Manage journal lifecycle (close, archive) |
| ledger.journal.post | LEDGER | CREATE | CRITICAL | journal_entry | No |  | Post a balanced journal entry to the ledger |
| ledger.journal.read | LEDGER | READ | LOW | journal_entry | Yes |  | Query journal entries |
| ledger.journal.reverse | LEDGER | EXECUTE | CRITICAL | journal_entry | No |  | Reverse a posted journal entry |
| ledger.period.close | LEDGER | GOVERN | HIGH | accounting_period | No |  | Close an accounting period |
| ledger.period.manage | LEDGER | GOVERN | HIGH | accounting_period | No |  | Open and close accounting periods |
| ledger.reconcile | LEDGER | EXECUTE | MEDIUM | ledger | Yes |  | Reconcile ledger accounts against external sources |
| ledger.reconcile.initiate | LEDGER | EXECUTE | MEDIUM | ledger | Yes |  | Initiate ledger reconciliation process |
| payment.compensation.execute | PAYMENT | EXECUTE | CRITICAL | payment_compensation | No |  | Execute compensating reversals against external payment rails |
| payment.execution.compensate | PAYMENT | EXECUTE | HIGH | payment_execution | No |  | Compensate failed payment executions |
| payment.execution.confirm | PAYMENT | EXECUTE | HIGH | payment_execution | No |  | Confirm successful payment execution |
| payment.execution.execute | PAYMENT | EXECUTE | CRITICAL | payment_execution | No |  | Execute planned payments through payment rails |
| payment.execution.plan | PAYMENT | CREATE | MEDIUM | payment_execution | No |  | Plan payment execution routes and strategy |
| payment.initiate | PAYMENT | EXECUTE | CRITICAL | payment | Yes |  | Initiate external payments to external systems |
| payment.rail.execute | PAYMENT | EXECUTE | CRITICAL | payment_rail | No |  | Execute payment operations against external rails (prepare, execute, confirm) |
| payment.receipt.issue | PAYMENT | CREATE | LOW | payment_receipt | No |  | Issue payment receipts for settled payments |
| payment.reconcile | PAYMENT | EXECUTE | MEDIUM | payment | Yes |  | Reconcile external payments with internal records |
| payment.reconciliation.complete | PAYMENT | EXECUTE | MEDIUM | payment_reconciliation | Yes |  | Complete payment reconciliation with resolution |
| payment.reconciliation.initiate | PAYMENT | CREATE | MEDIUM | payment_reconciliation | Yes |  | Initiate payment reconciliation process |
| payment.request.cancel | PAYMENT | DELETE | MEDIUM | payment_request | Yes |  | Cancel pending payment requests |
| payment.request.create | PAYMENT | CREATE | HIGH | payment_request | Yes |  | Create payment requests |
| policy.compliance.create | POLICY | CREATE | HIGH | compliance_requirement | No |  | Register compliance requirements in the policy subsystem |
| policy.escalation.resolve | POLICY | GOVERN | HIGH | escalation | No |  | Resolve policy escalations and exceptions |
| policy.rule.activate | POLICY | UPDATE | HIGH | policy_rule | No |  | Activate a draft policy rule |
| policy.rule.create | POLICY | CREATE | HIGH | policy_rule | No |  | Create policy rules in the policy engine |
| policy.rule.deactivate | POLICY | UPDATE | HIGH | policy_rule | No |  | Deactivate an active policy rule |
| policy.rule.read | POLICY | READ | LOW | policy_rule | Yes |  | Read policy rules and compliance requirements |
| policy.rule.update | POLICY | UPDATE | HIGH | policy_rule | No |  | Update existing policy rules |
| policy.set.create | POLICY | CREATE | HIGH | policy_set | No |  | Create policy evaluation sets |
| policy.set.evaluate | POLICY | EXECUTE | LOW | policy_set | Yes |  | Request policy evaluation against a policy set |
| system.internal | GOVERNANCE | EXECUTE | NONE | system | No |  | System-internal capability for automated pipeline operations |
| treasury.liquidity.manage | TREASURY | UPDATE | CRITICAL | liquidity_pool | Yes |  | Manage liquidity pools and liquidity allocation |
| treasury.liquidity.read | TREASURY | READ | LOW | liquidity_pool | Yes |  | Query liquidity pool state and allocations |
| treasury.settlement.confirm | TREASURY | EXECUTE | HIGH | settlement | Yes |  | Confirm final settlement of transfers |
| treasury.transfer.approve | TREASURY | GOVERN | CRITICAL | transfer | No |  | Approve pending treasury transfers |
| treasury.transfer.authorize | TREASURY | GOVERN | CRITICAL | transfer | No |  | Authorize requested treasury transfers |
| treasury.transfer.cancel | TREASURY | DELETE | MEDIUM | transfer | No |  | Cancel pending or reserved treasury transfers |
| treasury.transfer.compensate | TREASURY | EXECUTE | HIGH | transfer | No |  | Compensate failed treasury transfers |
| treasury.transfer.execute | TREASURY | EXECUTE | CRITICAL | transfer | No |  | Execute authorized and reserved treasury transfers |
| treasury.transfer.initiate | TREASURY | EXECUTE | CRITICAL | transfer | Yes |  | Initiate treasury transfers between accounts |
| treasury.transfer.request | TREASURY | CREATE | HIGH | transfer | Yes |  | Request a treasury transfer |
| treasury.transfer.reserve | TREASURY | EXECUTE | HIGH | transfer | No |  | Reserve funds for an authorized transfer |
| vault.asset.create | VAULT | CREATE | CRITICAL | asset | No |  | Register new assets in the vault |
| vault.asset.impair | VAULT | GOVERN | HIGH | asset | No |  | Mark an asset as impaired |
| vault.asset.read | VAULT | READ | LOW | asset | Yes |  | Query asset state and metadata |
| vault.asset.reconcile | VAULT | EXECUTE | MEDIUM | asset | Yes |  | Initiate vault asset reconciliation |
| vault.asset.reject | VAULT | GOVERN | HIGH | asset | No |  | Reject a registered asset that fails verification |
| vault.asset.verify | VAULT | GOVERN | HIGH | asset | No |  | Verify asset existence and provenance |
| vault.collateral.add | VAULT | CREATE | HIGH | collateral | No |  | Add collateral to a position |
| vault.collateral.create | VAULT | CREATE | HIGH | collateral | No |  | Create collateral positions |
| vault.collateral.evaluate | VAULT | EXECUTE | HIGH | collateral | Yes |  | Evaluate collateral adequacy and value |
| vault.collateral.release | VAULT | DELETE | HIGH | collateral | No |  | Release collateral positions |
| vault.reconcile | VAULT | EXECUTE | MEDIUM | vault | Yes |  | Initiate vault-wide reconciliation process |
| vault.reserve.consume | VAULT | EXECUTE | HIGH | reservation | No |  | Consume a locked reservation for a completed operation |
| vault.reserve.create | VAULT | CREATE | HIGH | reserve | Yes |  | Create asset reservations against available balance |
| vault.reserve.lock | VAULT | EXECUTE | HIGH | reservation | No |  | Lock a pending reservation, committing the value |
| vault.reserve.release | VAULT | UPDATE | MEDIUM | reserve | Yes |  | Release previously created asset reservations |
| vault.valuation.manage | VAULT | UPDATE | HIGH | valuation | No |  | Manage valuation models and parameters |
| vault.valuation.update | VAULT | UPDATE | HIGH | asset | Yes |  | Update asset valuations |
