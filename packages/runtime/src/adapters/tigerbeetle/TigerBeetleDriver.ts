/**
 * TigerBeetleDriver
 *
 * Financial accounting database — not an external payment rail.
 * This is the balance layer beneath SOVR.
 *
 * Architecture:
 *   PostgreSQL  → immutable event log (WHAT happened, audit trail)
 *   TigerBeetle → account balances    (WHAT the state is NOW)
 *
 * Constitutional alignment:
 *   INV-002 (double-entry) enforced at:
 *     Layer 1: SOVR CommandBus + GuardrailBus  (application)
 *     Layer 2: TigerBeetle                      (storage)
 *   Two independent enforcement points.
 *   If TigerBeetle rejects — the event is NOT written.
 *   Financial integrity is maintained.
 *
 * Two-phase transfer pattern:
 *   1. createTransfer({ flags: pending })  → funds RESERVED
 *   2. createTransfer({ flags: post })     → funds COMMITTED
 *   OR
 *   2. createTransfer({ flags: void })     → reservation CANCELLED
 *
 * Use cases by phase:
 *   Escrow fund:     reserve in escrow account
 *   Escrow release:  post reservation to beneficiary
 *   Card auth:       reserve on spend account
 *   Card settlement: post reservation
 *   ACH return:      void reservation
 *
 * npm install tigerbeetle-node
 */

import {
  createClient,
  type Client,
  type Account,
  type Transfer,
  AccountFlags,
  TransferFlags,
} from 'tigerbeetle-node'

// ─── Ledger Partitions ────────────────────────────────────────────────────────

/**
 * TigerBeetle ledger = u32 domain partition.
 * One ledger per SOVR domain — isolation by design.
 * Accounts in different ledgers cannot transfer directly.
 */
export const TB_LEDGER = {
  VAULT:     1,
  LEDGER:    2,
  TREASURY:  3,
  ESCROW:    4,
  PAYMENT:   5,
  FEES:      6,
  RESERVE:   7,
  SYSTEM:    8
} as const

export type TBLedger = keyof typeof TB_LEDGER

/**
 * TigerBeetle account code = u16 account type discriminant.
 */
export const TB_ACCOUNT_CODE = {
  ASSET:       1,
  LIABILITY:   2,
  EQUITY:      3,
  REVENUE:     4,
  EXPENSE:     5,
  MEMORANDUM:  6,
  RESERVE:     7,
  COLLATERAL:  8,
  ESCROW:      9,
  FEE:         10
} as const

export type TBAccountCode = keyof typeof TB_ACCOUNT_CODE

/**
 * TigerBeetle transfer code = u16 transfer type discriminant.
 */
export const TB_TRANSFER_CODE = {
  JOURNAL_ENTRY:    1,
  RESERVE:          2,   // Two-phase pending
  POST_RESERVE:     3,   // Two-phase commit
  VOID_RESERVE:     4,   // Two-phase rollback
  FEE:              5,
  INTEREST:         6,
  ADJUSTMENT:       7,
  SETTLEMENT:       8,
  COMPENSATION:     9    // Saga rollback compensation
} as const

export type TBTransferCode = keyof typeof TB_TRANSFER_CODE

// ─── Configuration ────────────────────────────────────────────────────────────

export type TigerBeetleConfig = {
  clusterId:      number     // TigerBeetle cluster ID
  addresses:      string[]   // ['localhost:3000'] or multi-node
  concurrencyMax?: number    // Default 32
}

// ─── Domain Types ─────────────────────────────────────────────────────────────

export type TBCreateAccountRequest = {
  sovrId:        string           // SOVR aggregate_id (UUID)
  ledger:        TBLedger
  code:          TBAccountCode
  flags?: {
    debitsMustNotExceedCredits?:  boolean  // Enforce non-negative balance
    creditsMustNotExceedDebits?:  boolean  // Enforce credit limit
    linked?:                      boolean  // Atomic with next in batch
  }
}

export type TBCreateTransferRequest = {
  sovrCommandId:    string       // SOVR command_id → user_data_128
  sovrCorrelationId: string      // SOVR correlation_id → user_data_64
  debitSovrId:      string       // SOVR account ID to debit
  creditSovrId:     string       // SOVR account ID to credit
  amount:           bigint       // Base units — no decimals
  ledger:           TBLedger
  code:             TBTransferCode
  flags?: {
    twoPhase?:      boolean      // Pending — reserve funds
    linked?:        boolean      // Atomic with next in batch
  }
  timeout?:         number       // Two-phase expiry in seconds (0 = no expiry)
}

export type TBTransferResult = {
  ok:               boolean
  transferId?:      bigint
  pendingId?:       bigint       // Set when twoPhase=true
  errorCode?:       string
  errorMessage?:    string
}

export type TBAccountBalance = {
  sovrId:          string
  tbId:            bigint
  debitsPending:   bigint
  debitsPosted:    bigint
  creditsPending:  bigint
  creditsPosted:   bigint
  netBalance:      bigint       // creditsPosted − debitsPosted
  timestamp:       bigint
}

export type TBHealthResult = {
  status:              'HEALTHY' | 'DEGRADED' | 'UNHEALTHY'
  connected:           boolean
  accountsRegistered:  number
  latencyMs?:          number
  error?:              string
}

// ─── Driver ───────────────────────────────────────────────────────────────────

export class TigerBeetleDriver {

  private client:        Client | null = null
  private readonly cfg:  TigerBeetleConfig

  // Bidirectional SOVR UUID ↔ TigerBeetle u128 mapping
  private readonly sovrToTb:  Map<string, bigint> = new Map()
  private readonly tbToSovr:  Map<bigint, string> = new Map()

  // Monotonically increasing ID sequence
  // TigerBeetle requires unique u128 IDs — we use time-seeded sequence
  private sequence: bigint = BigInt(Date.now()) * 1_000_000n

  constructor(config: TigerBeetleConfig) {
    this.cfg = config
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    throw new Error(
      'TigerBeetleDriver is not the runtime integration boundary. Use packages/runtime/src/ledger/tigerbeetle/TigerBeetleTransportClient.'
    )
  }

  async disconnect(): Promise<void> {
    if (!this.client) return
    this.client.destroy()
    this.client = null
  }

  isConnected(): boolean {
    return this.client !== null
  }

  // ─── Account Management ─────────────────────────────────────────────────────

  /**
   * Create a financial account in TigerBeetle.
   *
   * Idempotent — if account already exists with same params, returns ok.
   * Called by TigerBeetleAccountManager in response to SOVR account events.
   */
  async createAccount(req: TBCreateAccountRequest): Promise<{
    ok:      boolean
    tbId:    bigint
    error?:  string
  }> {
    const c = this.requireClient()

    // Check if already registered
    const existing = this.sovrToTb.get(req.sovrId)
    if (existing) {
      return { ok: true, tbId: existing }
    }

    const tbId = this.nextId()

    let flags = 0
    if (req.flags?.debitsMustNotExceedCredits) {
      flags |= AccountFlags.debits_must_not_exceed_credits
    }
    if (req.flags?.creditsMustNotExceedDebits) {
      flags |= AccountFlags.credits_must_not_exceed_debits
    }
    if (req.flags?.linked) {
      flags |= AccountFlags.linked
    }

    const account: Account = {
      id:               tbId,
      ledger:           TB_LEDGER[req.ledger],
      code:             TB_ACCOUNT_CODE[req.code],
      flags,
      user_data_128:    this.sovrIdToU128(req.sovrId),
      user_data_64:     0n,
      user_data_32:     0,
      debits_pending:   0n,
      debits_posted:    0n,
      credits_pending:  0n,
      credits_posted:   0n,
      reserved:         0,
      timestamp:        0n   // TigerBeetle assigns timestamp
    }

    const results: any[] = await c.createAccounts([account])

    if (results.length === 0) {
      this.register(req.sovrId, tbId)
      return { ok: true, tbId }
    }

    const status = results[0]?.status as number

    // Idempotent — already exists is ok
    if (status === 21) {
      this.register(req.sovrId, tbId)
      return { ok: true, tbId }
    }

    return { ok: false, tbId, error: this.accountErrCode(status) }
  }

  /**
   * Create multiple accounts atomically.
   * Use flags.linked = true to chain them.
   */
  async createAccounts(reqs: TBCreateAccountRequest[]): Promise<Array<{
    ok:     boolean
    tbId:   bigint
    error?: string
  }>> {
    const results = []
    for (const req of reqs) {
      results.push(await this.createAccount(req))
    }
    return results
  }

  // ─── Transfers ──────────────────────────────────────────────────────────────

  /**
   * Execute a single transfer.
   *
   * Constitutional guarantee:
   *   TigerBeetle enforces double-entry at storage layer.
   *   If this returns ok=false, the SOVR event must NOT be written.
   *   Call this BEFORE appending to the PostgreSQL event store.
   */
  async createTransfer(req: TBCreateTransferRequest): Promise<TBTransferResult> {
    const c = this.requireClient()

    const debitTbId  = this.sovrToTb.get(req.debitSovrId)
    const creditTbId = this.sovrToTb.get(req.creditSovrId)

    if (!debitTbId) {
      return {
        ok:           false,
        errorCode:    'DEBIT_ACCOUNT_NOT_REGISTERED',
        errorMessage: `Account not in TigerBeetle: ${req.debitSovrId}`
      }
    }
    if (!creditTbId) {
      return {
        ok:           false,
        errorCode:    'CREDIT_ACCOUNT_NOT_REGISTERED',
        errorMessage: `Account not in TigerBeetle: ${req.creditSovrId}`
      }
    }

    const transferId = this.nextId()

    let flags = 0
    if (req.flags?.twoPhase) flags |= TransferFlags.pending
    if (req.flags?.linked)   flags |= TransferFlags.linked

    const transfer: Transfer = {
      id:                transferId,
      debit_account_id:  debitTbId,
      credit_account_id: creditTbId,
      amount:            req.amount,
      ledger:            TB_LEDGER[req.ledger],
      code:              TB_TRANSFER_CODE[req.code],
      flags,
      pending_id:        0n,
      user_data_128:     this.sovrIdToU128(req.sovrCommandId),
      user_data_64:      this.sovrIdToU64(req.sovrCorrelationId),
      user_data_32:      0,
      timeout:           req.timeout ?? 0,
      timestamp:         0n
    }

    const results: any[] = await c.createTransfers([transfer])

    if (results.length === 0) {
      return {
        ok:         true,
        transferId,
        pendingId:  req.flags?.twoPhase ? transferId : undefined
      }
    }

    const status = results[0]?.status as number

    // Idempotent — same commandId already processed
    if (status === 46) {
      return { ok: true, transferId }
    }

    return {
      ok:           false,
      errorCode:    this.transferErrCode(status),
      errorMessage: this.transferErrMessage(this.transferErrCode(status))
    }
  }

  /**
   * Execute multiple transfers atomically.
   *
   * All succeed or all fail.
   * Use for:
   *   Multi-leg journal entries (fee + principal)
   *   Saga atomic steps
   *   Any compound financial operation
   *
   * Internally uses TigerBeetle's linked transfer flag.
   * The last transfer in the batch does NOT have linked flag set.
   * If any transfer fails, all preceding linked transfers are rolled back.
   */
  async createLinkedTransfers(
    reqs: TBCreateTransferRequest[]
  ): Promise<TBTransferResult[]> {
    if (reqs.length === 0) return []
    if (reqs.length === 1) return [await this.createTransfer(reqs[0])]

    const c = this.requireClient()
    const tbTransfers: Transfer[] = []
    const transferIds: bigint[] = []

    for (let i = 0; i < reqs.length; i++) {
      const req       = reqs[i]
      const isLast    = i === reqs.length - 1
      const debitTbId  = this.sovrToTb.get(req.debitSovrId)
      const creditTbId = this.sovrToTb.get(req.creditSovrId)

      if (!debitTbId || !creditTbId) {
        return reqs.map(() => ({
          ok:           false,
          errorCode:    'ACCOUNT_NOT_REGISTERED',
          errorMessage: `One or more accounts not registered in TigerBeetle`
        }))
      }

      const transferId = this.nextId()
      transferIds.push(transferId)

      let flags = 0
      if (!isLast)              flags |= TransferFlags.linked
      if (req.flags?.twoPhase)  flags |= TransferFlags.pending

      tbTransfers.push({
        id:                transferId,
        debit_account_id:  debitTbId,
        credit_account_id: creditTbId,
        amount:            req.amount,
        ledger:            TB_LEDGER[req.ledger],
        code:              TB_TRANSFER_CODE[req.code],
        flags,
        pending_id:        0n,
        user_data_128:     this.sovrIdToU128(req.sovrCommandId),
        user_data_64:      BigInt(i),
        user_data_32:      0,
        timeout:           req.timeout ?? 0,
        timestamp:         0n
      })
    }

    const errors: any[] = await c.createTransfers(tbTransfers)

    if (errors.length === 0) {
      return transferIds.map((transferId, i) => ({
        ok:        true,
        transferId,
        pendingId: reqs[i].flags?.twoPhase ? transferId : undefined
      }))
    }

    // Any failure = all linked transfers rolled back
    const status = errors[0]?.status as number
    const errCode = this.transferErrCode(status)
    return reqs.map(() => ({
      ok:           false,
      errorCode:    errCode,
      errorMessage: this.transferErrMessage(errCode)
    }))
  }

  /**
   * Post a pending (two-phase) transfer.
   *
   * Moves reserved funds to posted — the reservation is consumed.
   * Called when the condition for release is met:
   *   - Escrow beneficiary confirmed
   *   - Card transaction settled
   *   - ACH transfer confirmed by RDFI
   */
  async postReservation(
    pendingId:        bigint,
    sovrCommandId:    string,
    partialAmount?:   bigint   // Omit to post full reserved amount
  ): Promise<TBTransferResult> {
    const c = this.requireClient()

    const postId = this.nextId()

    const postTransfer: Transfer = {
      id:                postId,
      debit_account_id:  0n,   // Inherited from pending transfer
      credit_account_id: 0n,   // Inherited from pending transfer
      amount:            partialAmount ?? 0n,  // 0 = post full amount
      ledger:            0,    // Inherited
      code:              TB_TRANSFER_CODE.POST_RESERVE,
      flags:             TransferFlags.post_pending_transfer,
      pending_id:        pendingId,
      user_data_128:     this.sovrIdToU128(sovrCommandId),
      user_data_64:      0n,
      user_data_32:      0,
      timeout:           0,
      timestamp:         0n
    }

    const errors: any[] = await c.createTransfers([postTransfer])

    if (errors.length === 0) {
      return { ok: true, transferId: postId }
    }

    const status = errors[0]?.status as number
    return {
      ok:           false,
      errorCode:    this.transferErrCode(status),
      errorMessage: this.transferErrMessage(this.transferErrCode(status))
    }
  }

  /**
   * Void a pending (two-phase) transfer.
   *
   * Releases the reservation — funds return to source.
   * Called when the condition for release is NOT met:
   *   - Escrow cancelled
   *   - Card authorization reversed
   *   - ACH return received
   *   - Saga compensation required
   */
  async voidReservation(
    pendingId:     bigint,
    sovrCommandId: string
  ): Promise<TBTransferResult> {
    const c = this.requireClient()

    const voidId = this.nextId()

    const voidTransfer: Transfer = {
      id:                voidId,
      debit_account_id:  0n,
      credit_account_id: 0n,
      amount:            0n,
      ledger:            0,
      code:              TB_TRANSFER_CODE.VOID_RESERVE,
      flags:             TransferFlags.void_pending_transfer,
      pending_id:        pendingId,
      user_data_128:     this.sovrIdToU128(sovrCommandId),
      user_data_64:      0n,
      user_data_32:      0,
      timeout:           0,
      timestamp:         0n
    }

    const errors: any[] = await c.createTransfers([voidTransfer])

    if (errors.length === 0) {
      return { ok: true, transferId: voidId }
    }

    const status = errors[0]?.status as number
    return {
      ok:           false,
      errorCode:    this.transferErrCode(status),
      errorMessage: this.transferErrMessage(this.transferErrCode(status))
    }
  }

  // ─── Balance Queries ────────────────────────────────────────────────────────

  /**
   * Get the current balance for a SOVR account.
   *
   * TigerBeetle is the authoritative source for account balances.
   * The PostgreSQL event store is the authoritative source for audit history.
   * If they diverge — reconciliation is required immediately.
   */
  async getBalance(sovrId: string): Promise<TBAccountBalance | null> {
    const c    = this.requireClient()
    const tbId = this.sovrToTb.get(sovrId)
    if (!tbId) return null

    const accounts = await c.lookupAccounts([tbId])
    if (accounts.length === 0) return null

    const a = accounts[0]
    return {
      sovrId,
      tbId:           a.id,
      debitsPending:  BigInt(a.debits_pending),
      debitsPosted:   BigInt(a.debits_posted),
      creditsPending: BigInt(a.credits_pending),
      creditsPosted:  BigInt(a.credits_posted),
      netBalance:     BigInt(a.credits_posted) - BigInt(a.debits_posted),
      timestamp:      BigInt(a.timestamp)
    }
  }

  /**
   * Bulk balance query — TigerBeetle handles batches efficiently.
   */
  async getBalances(sovrIds: string[]): Promise<TBAccountBalance[]> {
    const c = this.requireClient()

    const tbIds = sovrIds
      .map(id => this.sovrToTb.get(id))
      .filter((id): id is bigint => id !== undefined)

    if (tbIds.length === 0) return []

    const accounts = await c.lookupAccounts(tbIds)

    return accounts.map((a: Account) => ({
      sovrId:         this.tbToSovr.get(a.id) ?? 'unknown',
      tbId:           a.id,
      debitsPending:  BigInt(a.debits_pending),
      debitsPosted:   BigInt(a.debits_posted),
      creditsPending: BigInt(a.credits_pending),
      creditsPosted:  BigInt(a.credits_posted),
      netBalance:     BigInt(a.credits_posted) - BigInt(a.debits_posted),
      timestamp:      BigInt(a.timestamp)
    }))
  }

  // ─── Reconciliation ─────────────────────────────────────────────────────────

  /**
   * Verify TigerBeetle balance matches SOVR event store projection.
   *
   * Run on:
   *   - System startup after event store rebuild
   *   - Manual operations trigger
   *   - After any failure recovery
   *
   * If reconciled = false → CRITICAL integrity failure.
   * Halt and alert. Do not continue processing.
   */
  async reconcile(
    sovrId:          string,
    expectedBalance: bigint
  ): Promise<{
    reconciled:      boolean
    tbBalance:       bigint
    expectedBalance: bigint
    delta:           bigint
  }> {
    const balance = await this.getBalance(sovrId)
    const tbBalance = balance?.netBalance ?? 0n
    const delta = tbBalance - expectedBalance

    return {
      reconciled:     delta === 0n,
      tbBalance,
      expectedBalance,
      delta
    }
  }

  // ─── Health ─────────────────────────────────────────────────────────────────

  async healthCheck(): Promise<TBHealthResult> {
    if (!this.client) {
      return { status: 'UNHEALTHY', connected: false, accountsRegistered: 0 }
    }

    try {
      const start = Date.now()
      // Probe: look up non-existent ID — fast no-op
      await this.client.lookupAccounts([0n])
      const latencyMs = Date.now() - start

      return {
        status:             'HEALTHY',
        connected:          true,
        accountsRegistered: this.sovrToTb.size,
        latencyMs
      }
    } catch (err) {
      return {
        status:             'UNHEALTHY',
        connected:          false,
        accountsRegistered: this.sovrToTb.size,
        error:              (err as Error).message
      }
    }
  }

  // ─── Internal Utilities ─────────────────────────────────────────────────────

  private requireClient(): Client {
    if (!this.client) {
      throw new Error(
        'TigerBeetleDriver: not connected. Call connect() before use.'
      )
    }
    return this.client
  }

  private register(sovrId: string, tbId: bigint): void {
    this.sovrToTb.set(sovrId, tbId)
    this.tbToSovr.set(tbId, sovrId)
  }

  private nextId(): bigint {
    return ++this.sequence
  }

  /**
   * Convert SOVR UUID → TigerBeetle u128 bigint.
   * UUID is 128-bit. Strip hyphens, parse hex.
   */
  private sovrIdToU128(sovrId: string): bigint {
    const hex = sovrId.replace(/-/g, '').padEnd(32, '0').slice(0, 32)
    try { return BigInt('0x' + hex) } catch { return 0n }
  }

  /**
   * Convert SOVR UUID → TigerBeetle u64 (first 64 bits only).
   */
  private sovrIdToU64(sovrId: string): bigint {
    const hex = sovrId.replace(/-/g, '').padEnd(16, '0').slice(0, 16)
    try { return BigInt('0x' + hex) } catch { return 0n }
  }

  private accountErrCode(status: number): string {
    const map: Record<number, string> = {
      1: 'linked_event_failed',
      2: 'linked_event_chain_open',
      3: 'timestamp_must_be_zero',
      4: 'reserved_field',
      5: 'reserved_flag',
      6: 'id_must_not_be_zero',
      7: 'id_must_not_be_int_max',
      8: 'flags_are_mutually_exclusive',
      9: 'debits_pending_must_be_zero',
      10: 'debits_posted_must_be_zero',
      11: 'credits_pending_must_be_zero',
      12: 'credits_posted_must_be_zero',
      13: 'ledger_must_not_be_zero',
      14: 'code_must_not_be_zero',
      15: 'exists_with_different_flags',
      16: 'exists_with_different_user_data_128',
      17: 'exists_with_different_user_data_64',
      18: 'exists_with_different_user_data_32',
      19: 'exists_with_different_ledger',
      20: 'exists_with_different_code',
      21: 'exists',
    };
    return map[status] ?? `unknown_${status}`
  }

  private transferErrCode(status: number): string {
    const map: Record<number, string> = {
      1: 'linked_event_failed',
      2: 'linked_event_chain_open',
      3: 'timestamp_must_be_zero',
      4: 'reserved_flag',
      5: 'id_must_not_be_zero',
      6: 'id_must_not_be_int_max',
      7: 'flags_are_mutually_exclusive',
      8: 'debit_account_id_must_not_be_zero',
      9: 'debit_account_id_must_not_be_int_max',
      10: 'credit_account_id_must_not_be_zero',
      11: 'credit_account_id_must_not_be_int_max',
      12: 'accounts_must_be_different',
      13: 'pending_id_must_be_zero',
      14: 'pending_id_must_not_be_zero',
      15: 'pending_id_must_not_be_int_max',
      16: 'pending_id_must_be_different',
      17: 'timeout_reserved_for_pending_transfer',
      18: 'closing_transfer_must_be_pending',
      19: 'ledger_must_not_be_zero',
      20: 'code_must_not_be_zero',
      21: 'debit_account_not_found',
      22: 'credit_account_not_found',
      23: 'accounts_must_have_the_same_ledger',
      24: 'transfer_must_have_the_same_ledger_as_accounts',
      25: 'pending_transfer_not_found',
      26: 'pending_transfer_not_pending',
      27: 'pending_transfer_has_different_debit_account_id',
      28: 'pending_transfer_has_different_credit_account_id',
      29: 'pending_transfer_has_different_ledger',
      30: 'pending_transfer_has_different_code',
      31: 'exceeds_pending_transfer_amount',
      32: 'pending_transfer_has_different_amount',
      33: 'pending_transfer_already_posted',
      34: 'pending_transfer_already_voided',
      35: 'pending_transfer_expired',
      36: 'exists_with_different_flags',
      37: 'exists_with_different_debit_account_id',
      38: 'exists_with_different_credit_account_id',
      39: 'exists_with_different_amount',
      40: 'exists_with_different_pending_id',
      41: 'exists_with_different_user_data_128',
      42: 'exists_with_different_user_data_64',
      43: 'exists_with_different_user_data_32',
      44: 'exists_with_different_timeout',
      45: 'exists_with_different_code',
      46: 'exists',
      47: 'overflows_debits_pending',
      48: 'overflows_credits_pending',
      49: 'overflows_debits_posted',
      50: 'overflows_credits_posted',
      51: 'overflows_debits',
      52: 'overflows_credits',
      53: 'overflows_timeout',
      54: 'exceeds_credits',
      55: 'exceeds_debits',
    };
    return map[status] ?? `unknown_${status}`
  }

  private transferErrMessage(code: string): string {
    const map: Record<string, string> = {
      'exceeds_credits':                  'Insufficient funds — transfer would exceed balance limit',
      'exceeds_debits':                   'Transfer would exceed debit limit',
      'debit_account_not_found':          'Debit account not found in TigerBeetle',
      'credit_account_not_found':         'Credit account not found in TigerBeetle',
      'accounts_must_be_different':       'Cannot transfer between the same account',
      'amount_must_not_be_zero':          'Transfer amount must be greater than zero',
      'pending_transfer_expired':         'Two-phase reservation has expired',
      'pending_transfer_already_posted':  'Reservation already posted',
      'pending_transfer_already_voided':  'Reservation already voided',
      'exists':                           'Idempotent — transfer already processed'
    }
    return map[code] ?? `TigerBeetle error: ${code}`
  }
}
