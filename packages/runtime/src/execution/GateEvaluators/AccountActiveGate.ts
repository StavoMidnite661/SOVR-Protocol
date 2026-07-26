/**
 * AccountActiveGate
 *
 * Gate type: ACCOUNT_ACTIVE
 *
 * Checks that the target account is in an active state.
 * Prevents commands against closed, suspended, or frozen accounts.
 */

import { GateEvaluator, GateType, AccountActiveGateConfig, GateConfig } from '../types'

export interface AccountStateQueryHandle {
  getAccountStatus(accountId: string): Promise<
    'ACTIVE' | 'CLOSED' | 'SUSPENDED' | 'FROZEN' | 'PENDING' | null
  >
}

const ACTIVE_STATUSES = new Set(['ACTIVE'])

export class AccountActiveGate implements GateEvaluator {

  readonly type: GateType = 'ACCOUNT_ACTIVE'

  constructor(private readonly accountQuery: AccountStateQueryHandle) {}

  async evaluate(
    _aggregateId: string,
    _actorId:     string,
    payload:      Record<string, unknown>,
    config:       GateConfig
  ): Promise<{ passed: boolean; reason?: string }> {

    const cfg = config as AccountActiveGateConfig

    const accountId = payload[cfg.accountPayloadKey]
    if (!accountId || typeof accountId !== 'string') {
      return {
        passed: false,
        reason: `Account ID not found at payload key '${cfg.accountPayloadKey}'`
      }
    }

    const status = await this.accountQuery.getAccountStatus(accountId)

    if (!status) {
      return {
        passed: false,
        reason: `Account '${accountId}' not found`
      }
    }

    if (!ACTIVE_STATUSES.has(status)) {
      return {
        passed: false,
        reason: `Account '${accountId}' is ${status} — only ACTIVE accounts can receive commands`
      }
    }

    return { passed: true }
  }
}
