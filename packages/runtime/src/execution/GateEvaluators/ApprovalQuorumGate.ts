/**
 * ApprovalQuorumGate
 *
 * Gate type: APPROVAL_QUORUM
 *
 * Checks that the required number of approvals from
 * the specified role have been recorded for this aggregate.
 *
 * Use cases:
 *   High-value transfers requiring 2-of-3 officer approval
 *   Policy changes requiring board approval
 *   Escrow releases requiring counterparty sign-off
 *
 * Approvals are recorded as events in the event store.
 * This gate reads the current approval count from projections.
 */

import { GateEvaluator, GateType, ApprovalQuorumGateConfig, GateConfig } from '../types'

export interface ApprovalQueryHandle {
  getApprovalCount(
    aggregateId: string,
    role:        string
  ): Promise<number>
}

export class ApprovalQuorumGate implements GateEvaluator {

  readonly type: GateType = 'APPROVAL_QUORUM'

  constructor(private readonly approvalQuery: ApprovalQueryHandle) {}

  async evaluate(
    aggregateId: string,
    _actorId:    string,
    _payload:    Record<string, unknown>,
    config:      GateConfig
  ): Promise<{ passed: boolean; reason?: string }> {

    const cfg = config as ApprovalQuorumGateConfig

    const count = await this.approvalQuery.getApprovalCount(
      aggregateId,
      cfg.role
    )

    if (count < cfg.required) {
      return {
        passed: false,
        reason: `Insufficient approvals: ${count} of ${cfg.required} required from role '${cfg.role}'`
      }
    }

    return { passed: true }
  }
}
