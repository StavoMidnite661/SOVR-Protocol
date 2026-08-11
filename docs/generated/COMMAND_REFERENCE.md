# Command Reference

> **Compiler-generated reference documentation**
> Generated at: 2026-08-11T13:54:07.400Z
> Source: generated/registries/commands.registry.json

## Summary

| Metric | Count |
| --- | --- |
| Total Commands | 105 |
| Lifecycle Covered | 95 |
| Lifecycle Exempt | 10 |
| ABI Version | v1 |

## Commands

| Command | Domain | Version | Authorization | Lifecycle Exempt | Description |
| --- | --- | --- | --- | --- | --- |
| agent.activate | agent | 1.0.0 | Identity + Capability + Policy | No | agent.activate |
| agent.capability.bind | agent | 1.0.0 | Identity + Capability + Policy | No | agent.capability.bind |
| agent.capability.revoke | agent | 1.0.0 | Identity + Capability + Policy | No | agent.capability.revoke |
| agent.execution.execute | agent | 1.0.0 | Identity + Capability + Policy | No | agent.execution.execute |
| agent.governance.override | agent | 1.0.0 | Identity + Capability + Policy | Yes | agent.governance.override |
| agent.quota.update | agent | 1.0.0 | Identity + Capability + Policy | No | agent.quota.update |
| agent.register | agent | 1.0.0 | Identity + Capability + Policy | No | agent.register |
| agent.suspend | agent | 1.0.0 | Identity + Capability | No | agent.suspend |
| agent.terminate | agent | 1.0.0 | Identity + Capability + Policy | No | agent.terminate |
| escrow.account.cancel | escrow | 1.0.0 | Identity + Capability + Policy | No | escrow.account.cancel |
| escrow.account.create | escrow | 1.0.0 | Identity + Capability + Policy | No | escrow.account.create |
| escrow.account.fund | escrow | 1.0.0 | Identity + Capability + Policy | No | escrow.account.fund |
| escrow.account.release | escrow | 1.0.0 | Identity + Capability + Policy | No | escrow.account.release |
| governance.amend.propose | governance | 1.0.0 | Identity + Capability + Policy | No | governance.amend.propose |
| governance.amend.ratify | governance | 1.0.0 | Identity + Capability + Policy | No | governance.amend.ratify |
| governance.audit.query | governance | 1.0.0 | Identity + Capability + Policy | Yes | governance.audit.query |
| governance.capability.grant | governance | 1.0.0 | Identity + Capability + Policy | No | governance.capability.grant |
| governance.capability.revoke | governance | 1.0.0 | Identity + Capability + Policy | No | governance.capability.revoke |
| governance.emergency.halt | governance | 1.0.0 | Identity + Capability + Policy | Yes | governance.emergency.halt |
| governance.emergency.lift | governance | 1.0.0 | Identity + Capability + Policy | Yes | governance.emergency.lift |
| governance.escalation.resolve | governance | 1.0.0 | Identity + Capability + Policy | No | governance.escalation.resolve |
| governance.oversight.review | governance | 1.0.0 | Identity + Capability + Policy | Yes | governance.oversight.review |
| governance.policy_rule.review | governance | 1.0.0 | Identity + Capability + Policy | Yes | governance.policy_rule.review |
| governance.proposal.approve | governance | 1.0.0 | Identity + Capability + Policy | No | governance.proposal.approve |
| governance.proposal.cancel | governance | 1.0.0 | Identity + Capability | No | governance.proposal.cancel |
| governance.proposal.implement | governance | 1.0.0 | Identity + Capability | No | governance.proposal.implement |
| governance.proposal.reject | governance | 1.0.0 | Identity + Capability + Policy | No | governance.proposal.reject |
| governance.proposal.submit | governance | 1.0.0 | Identity + Capability + Policy | No | governance.proposal.submit |
| identity.actor.archive | identity | 1.0.0 | Identity + Capability + Policy | No | identity.actor.archive |
| identity.actor.register | identity | 1.0.0 | Identity + Capability + Policy | No | identity.actor.register |
| identity.actor.revoke | identity | 1.0.0 | Identity + Capability + Policy | No | identity.actor.revoke |
| identity.actor.suspend | identity | 1.0.0 | Identity + Capability + Policy | No | identity.actor.suspend |
| identity.actor.verify | identity | 1.0.0 | Identity + Capability + Policy | No | identity.actor.verify |
| identity.credential.issue | identity | 1.0.0 | Identity + Capability + Policy | No | identity.credential.issue |
| identity.credential.revoke | identity | 1.0.0 | Identity + Capability + Policy | No | identity.credential.revoke |
| identity.delegation.create | identity | 1.0.0 | Identity + Capability + Policy | No | identity.delegation.create |
| identity.delegation.revoke | identity | 1.0.0 | Identity + Capability + Policy | No | identity.delegation.revoke |
| identity.session.create | identity | 1.0.0 | Identity + Capability + Policy | No | identity.session.create |
| identity.session.terminate | identity | 1.0.0 | Identity + Capability + Policy | No | identity.session.terminate |
| identity.trust_anchor.register | identity | 1.0.0 | Identity + Capability + Policy | No | identity.trust_anchor.register |
| intent.archive | intent | 1.0.0 | Identity + Capability + Policy | No | intent.archive |
| intent.cancel | intent | 1.0.0 | Identity + Capability + Policy | No | intent.cancel |
| intent.convert_to_command | intent | 1.0.0 | Identity + Capability + Policy | No | intent.convert_to_command |
| intent.enrich | intent | 1.0.0 | Identity + Capability + Policy | No | intent.enrich |
| intent.multi_step.advance | intent | 1.0.0 | Identity + Capability + Policy | No | intent.multi_step.advance |
| intent.multi_step.create | intent | 1.0.0 | Identity + Capability + Policy | No | intent.multi_step.create |
| intent.submit | intent | 1.0.0 | Identity + Capability + Policy | No | intent.submit |
| intent.validate | intent | 1.0.0 | Identity + Capability + Policy | No | intent.validate |
| ledger.account.create | ledger | 1.0.0 | Identity + Capability + Policy | No | ledger.account.create |
| ledger.account.freeze | ledger | 1.0.0 | Identity + Capability + Policy | No | ledger.account.freeze |
| ledger.entry.correct | ledger | 1.0.0 | Identity + Capability + Policy | No | ledger.entry.correct |
| ledger.entry.post | ledger | 1.0.0 | Identity + Capability + Policy | No | ledger.entry.post |
| ledger.entry.reverse | ledger | 1.0.0 | Identity + Capability + Policy | No | ledger.entry.reverse |
| ledger.journal.create | ledger | 1.0.0 | Identity + Capability + Policy | No | ledger.journal.create |
| ledger.period.close | ledger | 1.0.0 | Identity + Capability + Policy | No | ledger.period.close |
| ledger.reconciliation.resolve | ledger | 1.0.0 | Identity + Capability + Policy | No | ledger.reconciliation.resolve |
| ledger.reconciliation.start | ledger | 1.0.0 | Identity + Capability + Policy | No | ledger.reconciliation.start |
| payment.adapter.disable | payment | 1.0.0 | Identity + Capability | Yes | payment.adapter.disable |
| payment.execution.compensate | payment | 1.0.0 | Identity + Capability + Policy | No | payment.execution.compensate |
| payment.execution.confirm | payment | 1.0.0 | Identity + Capability + Policy | No | payment.execution.confirm |
| payment.execution.execute | payment | 1.0.0 | Identity + Capability + Policy | No | payment.execution.execute |
| payment.execution.plan | payment | 1.0.0 | Identity + Capability + Policy | No | payment.execution.plan |
| payment.execution.prepare | payment | 1.0.0 | Identity + Capability | No | payment.execution.prepare |
| payment.receipt.issue | payment | 1.0.0 | Identity + Capability + Policy | Yes | payment.receipt.issue |
| payment.reconciliation.complete | payment | 1.0.0 | Identity + Capability + Policy | No | payment.reconciliation.complete |
| payment.reconciliation.start | payment | 1.0.0 | Identity + Capability + Policy | No | payment.reconciliation.start |
| payment.request.cancel | payment | 1.0.0 | Identity + Capability + Policy | No | payment.request.cancel |
| payment.request.create | payment | 1.0.0 | Identity + Capability + Policy | No | payment.request.create |
| policy.compliance.requirement.register | policy | 1.0.0 | Identity + Capability + Policy | No | policy.compliance.requirement.register |
| policy.escalation.resolve | policy | 1.0.0 | Identity + Capability + Policy | No | policy.escalation.resolve |
| policy.rule.activate | policy | 1.0.0 | Identity + Capability + Policy | No | policy.rule.activate |
| policy.rule.create | policy | 1.0.0 | Identity + Capability + Policy | No | policy.rule.create |
| policy.rule.deactivate | policy | 1.0.0 | Identity + Capability + Policy | No | policy.rule.deactivate |
| policy.rule.update | policy | 1.0.0 | Identity + Capability + Policy | No | policy.rule.update |
| policy.set.create | policy | 1.0.0 | Identity + Capability + Policy | No | policy.set.create |
| policy.set.evaluate | policy | 1.0.0 | Identity + Capability + Policy | No | policy.set.evaluate |
| saga.compensate | payment | 1.0.0 | Identity + Capability | Yes | saga.compensate |
| treasury.liquidity.allocate | treasury | 1.0.0 | Identity + Capability + Policy | No | treasury.liquidity.allocate |
| treasury.liquidity.check | treasury | 1.0.0 | Identity + Capability + Policy | Yes | treasury.liquidity.check |
| treasury.settlement.confirm | treasury | 1.0.0 | Identity + Capability + Policy | No | treasury.settlement.confirm |
| treasury.transfer.authorize | treasury | 1.0.0 | Identity + Capability + Policy | No | treasury.transfer.authorize |
| treasury.transfer.cancel | treasury | 1.0.0 | Identity + Capability + Policy | No | treasury.transfer.cancel |
| treasury.transfer.compensate | treasury | 1.0.0 | Identity + Capability + Policy | No | treasury.transfer.compensate |
| treasury.transfer.execute | treasury | 1.0.0 | Identity + Capability + Policy | No | treasury.transfer.execute |
| treasury.transfer.request | treasury | 1.0.0 | Identity + Capability + Policy | No | treasury.transfer.request |
| treasury.transfer.reserve | treasury | 1.0.0 | Identity + Capability + Policy | No | treasury.transfer.reserve |
| vault.asset.reconcile | vault | 1.0.0 | Identity + Capability + Policy | No | vault.asset.reconcile |
| vault.asset.register | vault | 1.0.0 | Identity + Capability + Policy | No | vault.asset.register |
| vault.asset.reject | vault | 1.0.0 | Identity + Capability + Policy | No | vault.asset.reject |
| vault.asset.verify | vault | 1.0.0 | Identity + Capability + Policy | No | vault.asset.verify |
| vault.asset.write_down | vault | 1.0.0 | Identity + Capability | No | vault.asset.write_down |
| vault.collateral.add | vault | 1.0.0 | Identity + Capability + Policy | No | vault.collateral.add |
| vault.collateral.remove | vault | 1.0.0 | Identity + Capability + Policy | No | vault.collateral.remove |
| vault.collateral.revalue | vault | 1.0.0 | Capability + Policy | No | vault.collateral.revalue |
| vault.ownership.transfer | vault | 1.0.0 | Identity + Capability | No | vault.ownership.transfer |
| vault.reserve.create | vault | 1.0.0 | Identity + Capability + Policy | No | vault.reserve.create |
| vault.reserve.expire | vault | 1.0.0 | Capability + Policy | No | vault.reserve.expire |
| vault.reserve.lock | vault | 1.0.0 | Identity + Capability + Policy | No | vault.reserve.lock |
| vault.reserve.release | vault | 1.0.0 | Identity + Capability + Policy | No | vault.reserve.release |
| vault.transaction.authorize_release | vault | 1.0.0 | Identity + Capability | No | vault.transaction.authorize_release |
| vault.transaction.cancel | vault | 1.0.0 | Identity + Capability | No | vault.transaction.cancel |
| vault.transaction.disburse | vault | 1.0.0 | Identity + Capability | No | vault.transaction.disburse |
| vault.transaction.fund | vault | 1.0.0 | Identity + Capability | No | vault.transaction.fund |
| vault.transfer.request | vault | 1.0.0 | Identity + Capability | No | vault.transfer.request |
| vault.valuation.update | vault | 1.0.0 | Capability + Policy | No | vault.valuation.update |
