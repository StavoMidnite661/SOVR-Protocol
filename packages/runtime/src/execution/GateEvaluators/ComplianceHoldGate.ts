/**
 * ComplianceHoldGate
 *
 * Gate type: COMPLIANCE_HOLD_ABSENT
 *
 * Checks that no active compliance hold of the
 * specified types exists on the aggregate.
 *
 * A compliance hold blocks all specified commands
 * until the hold is lifted by an authorized actor.
 *
 * Hold types:
 *   AML_REVIEW          — Anti-money laundering review
 *   SANCTIONS_CHECK     — OFAC/sanctions screening
 *   KYC_DEFICIENCY      — KYC documentation incomplete
 *   REGULATORY_FREEZE   — Regulator-ordered freeze
 *   FRAUD_INVESTIGATION — Active fraud investigation
 *   LEGAL_HOLD          — Legal proceedings
 */

import { GateEvaluator, GateType, ComplianceHoldGateConfig, GateConfig } from '../types'

export interface ComplianceHoldQueryHandle {
  getActiveHolds(aggregateId: string): Promise<Array<{
    holdType: string
    issuedAt: number
    issuedBy: string
    reason:   string
  }>>
}

export class ComplianceHoldGate implements GateEvaluator {

  readonly type: GateType = 'COMPLIANCE_HOLD_ABSENT'

  constructor(private readonly holdQuery: ComplianceHoldQueryHandle) {}

  async evaluate(
    aggregateId: string,
    _actorId:    string,
    _payload:    Record<string, unknown>,
    config:      GateConfig
  ): Promise<{ passed: boolean; reason?: string }> {

    const cfg = config as ComplianceHoldGateConfig

    const activeHolds = await this.holdQuery.getActiveHolds(aggregateId)

    const blockingHolds = activeHolds.filter(
      h => cfg.holdTypes.includes(h.holdType)
    )

    if (blockingHolds.length > 0) {
      const holdSummary = blockingHolds
        .map(h => `${h.holdType} (issued: ${new Date(h.issuedAt).toISOString()})`)
        .join(', ')

      return {
        passed: false,
        reason: `Active compliance holds block this command: ${holdSummary}`
      }
    }

    return { passed: true }
  }
}
