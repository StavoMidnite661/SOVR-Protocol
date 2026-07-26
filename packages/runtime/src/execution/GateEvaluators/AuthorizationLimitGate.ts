/**
 * AuthorizationLimitGate
 *
 * Gate type: AUTHORIZATION_LIMIT
 *
 * Checks that the command amount does not exceed
 * the actor's authorization limit.
 *
 * Limit source:
 *   actor_grant — limit comes from the actor's capability grant constraints
 *   static      — limit is hardcoded in the gate config (YAML-driven)
 *
 * This prevents:
 *   - Authorization limit bypass
 *   - Large-value transfers by low-authority actors
 *   - Approval-limit circumvention
 */

import {
  GateEvaluator,
  GateType,
  AuthorizationLimitGateConfig,
  GateConfig
} from '../types'

export interface ActorLimitHandle {
  getActorAuthorizationLimit(actorId: string, capability: string): Promise<bigint | null>
}

export class AuthorizationLimitGate implements GateEvaluator {

  readonly type: GateType = 'AUTHORIZATION_LIMIT'

  constructor(private readonly actorLimits: ActorLimitHandle) {}

  async evaluate(
    _aggregateId: string,
    actorId:      string,
    payload:      Record<string, unknown>,
    config:       GateConfig
  ): Promise<{ passed: boolean; reason?: string }> {

    const cfg = config as AuthorizationLimitGateConfig

    const amountStr = this.extractAmount(payload, cfg.amountPayloadKey)
    if (amountStr === null) {
      return {
        passed: false,
        reason: `Amount not found in payload at key '${cfg.amountPayloadKey}'`
      }
    }

    let amount: bigint
    try {
      amount = BigInt(amountStr)
    } catch {
      return {
        passed: false,
        reason: `Amount '${amountStr}' is not valid`
      }
    }

    let limit: bigint | null = null

    if (cfg.limitSource === 'static') {
      if (!cfg.staticLimit) {
        return {
          passed: false,
          reason: 'Static limit not configured in gate definition'
        }
      }
      try {
        limit = BigInt(cfg.staticLimit)
      } catch {
        return {
          passed: false,
          reason: `Static limit '${cfg.staticLimit}' is not valid`
        }
      }
    } else {
      limit = await this.actorLimits.getActorAuthorizationLimit(
        actorId,
        'authorization.limit'
      )
    }

    if (limit === null) {
      return {
        passed: false,
        reason: 'No authorization limit configured for actor — denied by default'
      }
    }

    if (amount > limit) {
      return {
        passed: false,
        reason: `Amount ${amount} exceeds authorization limit ${limit}`
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
    if (typeof val === 'object' && val !== null && 'value' in val) {
      return String((val as any).value)
    }
    return null
  }
}
