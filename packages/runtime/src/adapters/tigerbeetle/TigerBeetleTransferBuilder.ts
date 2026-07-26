/**
 * TigerBeetleTransferBuilder
 *
 * Translates SOVR command payloads into TigerBeetle transfer requests.
 *
 * Constitutional role:
 *   SOVR commands declare WHAT should happen.
 *   This builder translates WHAT into HOW TigerBeetle records it.
 *
 * Every financial command that affects balances
 * must go through this builder before being submitted
 * to TigerBeetle.
 *
 * INV-002 compliance:
 *   Every transfer has a debit and a credit.
 *   Sum of debits = sum of credits for any compound entry.
 *   TigerBeetle enforces this at the storage layer.
 *   SOVR CommandBus enforces this at the application layer.
 */

import {
  TigerBeetleDriver,
  TBCreateTransferRequest,
  TBTransferResult,
  TBLedger
} from './TigerBeetleDriver'

// ─── Journal Entry ───────────────────────────────────────────────────────────

export type JournalEntryLine = {
  accountId:  string          // SOVR aggregate_id
  type:       'DEBIT' | 'CREDIT'
  amount:     bigint
}

export type JournalEntryCommand = {
  commandId:     string
  correlationId: string
  lines:         JournalEntryLine[]
  ledger:        TBLedger
  memo?:         string
}

// ─── Transfer Commands ────────────────────────────────────────────────────────

export type SimpleTransferCommand = {
  commandId:     string
  correlationId: string
  sourceId:      string
  destinationId: string
  amount:        bigint
  ledger:        TBLedger
  twoPhase?:     boolean
  timeout?:      number
}

export type EscrowFundCommand = {
  commandId:       string
  correlationId:   string
  sourceId:        string
  escrowAccountId: string
  amount:          bigint
}

export type EscrowReleaseCommand = {
  commandId:         string
  correlationId:     string
  escrowPendingId:   bigint
  partialAmount?:    bigint
}

export type EscrowCancelCommand = {
  commandId:       string
  correlationId:   string
  escrowPendingId: bigint
}

// ─── Builder ─────────────────────────────────────────────────────────────────

export class TigerBeetleTransferBuilder {

  constructor(private readonly tb: TigerBeetleDriver) {}

  /**
   * Execute a journal entry — one or more balanced debit/credit pairs.
   *
   * Validates:
   *   - At least one debit and one credit
   *   - Sum(debits) === Sum(credits)
   *   - All accounts registered in TigerBeetle
   *
   * Executes as linked transfers — atomic.
   */
  async journalEntry(cmd: JournalEntryCommand): Promise<{
    ok:      boolean
    results: TBTransferResult[]
    error?:  string
  }> {
    const debits  = cmd.lines.filter(l => l.type === 'DEBIT')
    const credits = cmd.lines.filter(l => l.type === 'CREDIT')

    if (debits.length === 0 || credits.length === 0) {
      return {
        ok:      false,
        results: [],
        error:   'Journal entry must have at least one debit and one credit'
      }
    }

    const debitTotal  = debits.reduce((s, l) => s + l.amount, 0n)
    const creditTotal = credits.reduce((s, l) => s + l.amount, 0n)

    if (debitTotal !== creditTotal) {
      return {
        ok:      false,
        results: [],
        error:   `Journal entry imbalanced: debits=${debitTotal} credits=${creditTotal}`
      }
    }

    // Build one transfer per debit-credit pair
    // For N:1 or 1:N, pair round-robin and split amounts
    const transfers: TBCreateTransferRequest[] = []
    const count = Math.max(debits.length, credits.length)

    for (let i = 0; i < count; i++) {
      const debit  = debits[i % debits.length]
      const credit = credits[i % credits.length]

      // For multi-leg: each leg carries proportional amount
      const amount = debits.length === 1
        ? credit.amount
        : debit.amount

      transfers.push({
        sovrCommandId:     cmd.commandId,
        sovrCorrelationId: cmd.correlationId,
        debitSovrId:       debit.accountId,
        creditSovrId:      credit.accountId,
        amount,
        ledger:            cmd.ledger,
        code:              'JOURNAL_ENTRY',
        flags:             { linked: i < count - 1 }
      })
    }

    const results = await this.tb.createLinkedTransfers(transfers)

    return {
      ok:      results.every(r => r.ok),
      results,
      error:   results.find(r => !r.ok)?.errorMessage
    }
  }

  /**
   * Simple A → B transfer.
   *
   * Optional two-phase: reserve funds first, post on confirmation.
   */
  async simpleTransfer(cmd: SimpleTransferCommand): Promise<TBTransferResult> {
    return this.tb.createTransfer({
      sovrCommandId:     cmd.commandId,
      sovrCorrelationId: cmd.correlationId,
      debitSovrId:       cmd.sourceId,
      creditSovrId:      cmd.destinationId,
      amount:            cmd.amount,
      ledger:            cmd.ledger,
      code:              cmd.twoPhase ? 'RESERVE' : 'JOURNAL_ENTRY',
      flags:             { twoPhase: cmd.twoPhase },
      timeout:           cmd.timeout
    })
  }

  /**
   * Fund an escrow account.
   *
   * Two-phase: funds reserved in escrow.
   * Released only when escrow.account.release command is processed.
   *
   * Returns pendingId — store this in the SOVR event payload.
   * It is required to post or void the reservation later.
   */
  async fundEscrow(cmd: EscrowFundCommand): Promise<TBTransferResult> {
    return this.tb.createTransfer({
      sovrCommandId:     cmd.commandId,
      sovrCorrelationId: cmd.correlationId,
      debitSovrId:       cmd.sourceId,
      creditSovrId:      cmd.escrowAccountId,
      amount:            cmd.amount,
      ledger:            'ESCROW',
      code:              'RESERVE',
      flags:             { twoPhase: true },
      timeout:           0   // No expiry — escrow holds until explicit release
    })
  }

  /**
   * Release an escrow — post the pending reservation.
   *
   * Requires the pendingId from when the escrow was funded.
   */
  async releaseEscrow(cmd: EscrowReleaseCommand): Promise<TBTransferResult> {
    return this.tb.postReservation(
      cmd.escrowPendingId,
      cmd.commandId,
      cmd.partialAmount
    )
  }

  /**
   * Cancel an escrow — void the pending reservation.
   *
   * Funds return to source account.
   */
  async cancelEscrow(cmd: EscrowCancelCommand): Promise<TBTransferResult> {
    return this.tb.voidReservation(
      cmd.escrowPendingId,
      cmd.commandId
    )
  }

  /**
   * Saga compensation transfer.
   *
   * When a saga step must be compensated (rolled back),
   * this executes the reverse transfer.
   * Marked with COMPENSATION code for audit trail.
   */
  async compensate(cmd: SimpleTransferCommand): Promise<TBTransferResult> {
    return this.tb.createTransfer({
      sovrCommandId:     cmd.commandId,
      sovrCorrelationId: cmd.correlationId,
      debitSovrId:       cmd.destinationId,  // Reversed
      creditSovrId:      cmd.sourceId,       // Reversed
      amount:            cmd.amount,
      ledger:            cmd.ledger,
      code:              'COMPENSATION'
    })
  }
}
