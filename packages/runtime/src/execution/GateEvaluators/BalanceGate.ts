/**
 * BalanceGate
 *
 * Gate type: BALANCE_SUFFICIENT
 *
 * Checks that the specified account has sufficient
 * balance to cover the requested amount.
 *
 * Source of truth: TigerBeetle netBalance.
 * Constitutional alignment: INV-002 + INV-008.
 *
 * This gate prevents:
 *   - Overdraft attempts
 *   - Escrow release without funding
 *   - Transfer without available funds
 */

import { GateEvaluator, GateType, BalanceGateConfig, GateConfig } from '../types'

export interface TigerBeetleBalanceHandle {
  getBalance(sovrId: string): Promise<{
    netBalance: bigint
  } | null>
}

export class BalanceGate implements GateEvaluator {

  readonly type: GateType = 'BALANCE_SUFFICIENT'

  constructor(private readonly tb: TigerBeetleBalanceHandle) {}

  async evaluate(
    _aggregateId: string,
    _actorId:     string,
    payload:      Record<string, unknown>,
    config:       GateConfig
  ): Promise<{ passed: boolean; reason?: string }> {

    const cfg = config as BalanceGateConfig

    const accountId = this.extractString(payload, cfg.accountPayloadKey)
    if (!accountId) {
      return {
        passed: false,
        reason: `Account ID not found in payload at key '${cfg.accountPayloadKey}'`
      }
    }

    const amountStr = this.extractString(payload, cfg.amountPayloadKey)
    if (!amountStr) {
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
        reason: `Amount '${amountStr}' is not a valid integer`
      }
    }

    if (amount <= 0n) {
      return {
        passed: false,
        reason: `Amount must be greater than zero`
      }
    }

    const balance = await this.tb.getBalance(accountId)

    if (!balance) {
      return {
        passed: false,
        reason: `Account '${accountId}' not found in TigerBeetle`
      }
    }

    if (balance.netBalance < amount) {
      return {
        passed: false,
        reason: `Insufficient balance: available ${balance.netBalance}, required ${amount}`
      }
    }

    return { passed: true }
  }

  private extractString(
    payload: Record<string, unknown>,
    key:     string
  ): string | null {
    const val = payload[key]
    if (val === undefined || val === null) return null
    if (typeof val === 'string') return val
    if (typeof val === 'number' || typeof val === 'bigint') return String(val)
    if (typeof val === 'object' && 'value' in (val as any)) {
      return String((val as any).value)
    }
    return null
  }
}
