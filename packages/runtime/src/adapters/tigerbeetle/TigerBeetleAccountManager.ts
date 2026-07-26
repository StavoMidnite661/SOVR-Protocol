/**
 * TigerBeetleAccountManager
 *
 * Bridges SOVR account lifecycle events to TigerBeetle account creation.
 *
 * When SOVR's kernel processes a command that creates an account,
 * the resulting event flows here and creates the corresponding
 * TigerBeetle account.
 *
 * This is a projection — it reacts to SOVR events.
 * It does NOT generate commands.
 * It does NOT mutate constitutional state.
 *
 * Mapping:
 *   ledger.account.open       → TB LEDGER domain, account type from event
 *   vault.asset.register      → TB VAULT domain, ASSET type
 *   escrow.account.create     → TB ESCROW domain, ESCROW type
 *   treasury.account.open     → TB TREASURY domain, ASSET type
 *   payment.account.create    → TB PAYMENT domain, ASSET type
 */

import {
  TigerBeetleDriver,
  TBLedger,
  TBAccountCode,
  TB_ACCOUNT_CODE
} from './TigerBeetleDriver'

export type AccountOpenedEvent = {
  aggregateId:   string
  eventName:     string
  domain:        string
  payload: {
    accountType?:    string
    debitLimit?:     string
    creditLimit?:    string
    [key: string]:   unknown
  }
}

export class TigerBeetleAccountManager {

  constructor(private readonly tb: TigerBeetleDriver) {}

  /**
   * Process a SOVR account-opening event.
   * Route to correct TigerBeetle ledger and account code.
   */
  async onAccountOpened(event: AccountOpenedEvent): Promise<{
    ok:    boolean
    tbId?: bigint
    error?: string
  }> {
    const domain  = this.resolveLedger(event.domain, event.eventName)
    const code    = this.resolveCode(event.payload.accountType)

    const flags: Record<string, boolean> = {}
    if (event.payload.debitLimit) {
      flags.debitsMustNotExceedCredits = true
    }
    if (event.payload.creditLimit) {
      flags.creditsMustNotExceedDebits = true
    }

    return this.tb.createAccount({
      sovrId:  event.aggregateId,
      ledger:  domain,
      code,
      flags: Object.keys(flags).length > 0 ? flags : undefined
    })
  }

  /**
   * Bulk — create system accounts at boot.
   *
   * Some SOVR domains require system accounts that are
   * not created by user commands (fee pools, reserve accounts).
   * These are created during Runlevel 5 boot.
   */
  async createSystemAccounts(accounts: Array<{
    sovrId:  string
    ledger:  TBLedger
    code:    TBAccountCode
  }>): Promise<void> {
    for (const acct of accounts) {
      await this.tb.createAccount({
        sovrId: acct.sovrId,
        ledger: acct.ledger,
        code:   acct.code
      })
    }
  }

  // ─── Event Name → Ledger Mapping ────────────────────────────────────────────

  private resolveLedger(domain: string, eventName: string): TBLedger {
    const domainMap: Record<string, TBLedger> = {
      'ledger':   'LEDGER',
      'vault':    'VAULT',
      'escrow':   'ESCROW',
      'treasury': 'TREASURY',
      'payment':  'PAYMENT',
      'fees':     'FEES',
      'reserve':  'RESERVE',
      'system':   'SYSTEM'
    }

    // Try domain match first
    const domainKey = domain.toLowerCase().split('.')[0]
    if (domainMap[domainKey]) return domainMap[domainKey]

    // Fallback: parse from event name
    for (const [key, ledger] of Object.entries(domainMap)) {
      if (eventName.toLowerCase().includes(key)) return ledger
    }

    return 'LEDGER'  // Default
  }

  private resolveCode(accountType?: string): TBAccountCode {
    if (!accountType) return 'ASSET'

    const normalized = accountType.toUpperCase()
    if (normalized in TB_ACCOUNT_CODE) {
      return normalized as TBAccountCode
    }

    // Common aliases
    const aliases: Record<string, TBAccountCode> = {
      'CHECKING':    'ASSET',
      'SAVINGS':     'ASSET',
      'OPERATING':   'ASSET',
      'SETTLEMENT':  'ASSET',
      'TRUST':       'ASSET',
      'ESCROW':      'ESCROW',
      'COLLATERAL':  'COLLATERAL',
      'RESERVE':     'RESERVE',
      'FEE':         'FEE',
      'FEE_POOL':    'FEE'
    }

    return aliases[normalized] ?? 'ASSET'
  }
}
