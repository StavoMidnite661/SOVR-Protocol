/**
 * AmountWithinLimitGate
 *
 * Gate type: AMOUNT_WITHIN_LIMIT
 *
 * Checks that the command amount does not exceed
 * a static constitutional limit declared in YAML.
 *
 * Different from AuthorizationLimitGate:
 *   AmountWithinLimitGate — enforces constitutional max (per YAML)
 *   AuthorizationLimitGate — enforces actor's personal limit
 *
 * Example:
 *   FedNow max = $500,000 (constitutional limit)
 *   Actor limit = $100,000 (actor-specific limit)
 *   Both gates apply — both must pass
 */

import { GateEvaluator, GateType, AmountLimitGateConfig, GateConfig } from '../types'

export class AmountWithinLimitGate implements GateEvaluator {

  readonly type: GateType = 'AMOUNT_WITHIN_LIMIT'

  async evaluate(
    _aggregateId: string,
    _actorId:     string,
    payload:      Record<string, unknown>,
    config:       GateConfig
  ): Promise<{ passed: boolean; reason?: string }> {

    const cfg = config as AmountLimitGateConfig

    const amountStr = this.extractAmount(payload, cfg.amountPayloadKey)
    if (amountStr === null) {
      return {
        passed: false,
        reason: `Amount not found at payload key '${cfg.amountPayloadKey}'`
      }
    }

    let amount: bigint
    let maxAmount: bigint
    try {
      amount    = BigInt(amountStr)
      maxAmount = BigInt(cfg.maxAmount)
    } catch {
      return {
        passed: false,
        reason: `Invalid amount value: '${amountStr}'`
      }
    }

    if (amount <= 0n) {
      return { passed: false, reason: 'Amount must be greater than zero' }
    }

    if (amount > maxAmount) {
      return {
        passed: false,
        reason: `Amount ${amount} exceeds constitutional limit ${maxAmount} ${cfg.currency}`
      }
    }

    return { passed: true }
  }

  private extractAmount(
    payload: Record<string, unknown>,
    key:     string
  ): string | null {
    const val = payload[key]
    if (val === undefined || val === null) return null
    if (typeof val === 'string' || typeof val === 'number') return String(val)
    if (typeof val === 'object' && 'value' in (val as any)) {
      return String((val as any).value)
    }
    return null
  }
}
