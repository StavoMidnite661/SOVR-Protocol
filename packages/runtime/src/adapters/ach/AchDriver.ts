/**
 * AchDriver
 *
 * Automated Clearing House — domestic US bank transfers.
 *
 * Supported providers:
 *   dwolla         — Dwolla API (most common for platforms)
 *   modern_treasury — Modern Treasury API
 *   column         — Column Bank API (direct bank)
 *
 * Requirements:
 *   ODFI agreement — Originating Depository Financial Institution
 *   SOVR does not hold this license.
 *   This driver connects to a licensed ODFI partner via their API.
 *
 * Settlement:
 *   Standard ACH: T+1 or T+2
 *   Same-Day ACH: same business day (ODFI agreement required)
 *   Cutoff times: 10:30 AM and 2:45 PM ET for same-day
 *
 * Return codes handled:
 *   R01 Insufficient funds
 *   R02 Bank account closed
 *   R03 No account / unable to locate
 *   R04 Invalid account number
 *   R05 Unauthorized debit
 *   R07 Authorization revoked
 *   R10 Customer advises not authorized
 *   R11 Check truncation entry return
 *   R29 Corporate customer advises not authorized
 */

import {
  BaseRailDriver,
  RailPayload,
  RailSubmissionResult,
  RailStatusResult,
  now
} from '../base/BaseRailDriver'

// ─── Config ───────────────────────────────────────────────────────────────────

export type AchProvider = 'dwolla' | 'modern_treasury' | 'column'

export type AchDriverConfig = {
  provider:                AchProvider
  apiKey:                  string
  apiSecret:               string
  environment:             'sandbox' | 'production'
  companyId:               string   // 10-digit NACHA Company ID
  companyName:             string   // Max 16 chars
  companyEntryDescription: string   // Max 10 chars
  odfiRoutingNumber:       string   // 9-digit ABA
}

// ─── Return Code Map ──────────────────────────────────────────────────────────

const ACH_RETURN_CODES: Record<string, string> = {
  R01: 'Insufficient funds',
  R02: 'Bank account closed',
  R03: 'No account — unable to locate account',
  R04: 'Invalid account number structure',
  R05: 'Unauthorized debit to consumer account',
  R06: 'Returned per ODFI request',
  R07: 'Authorization revoked by customer',
  R08: 'Payment stopped',
  R09: 'Uncollected funds',
  R10: 'Customer advises not authorized',
  R11: 'Check truncation entry return',
  R16: 'Account frozen',
  R20: 'Non-transaction account',
  R23: 'Credit entry refused by receiver',
  R29: 'Corporate customer advises not authorized',
  R33: 'Return of XCK entry',
  R38: 'Stop payment on source document'
}

// ─── Driver ───────────────────────────────────────────────────────────────────

export class AchDriver extends BaseRailDriver {

  private readonly achConfig: AchDriverConfig
  private dwollaToken:        string | null = null
  private dwollaTokenExpiry:  number        = 0

  constructor(config: AchDriverConfig) {
    super({
      railId:                  'ach',
      railName:                'ACH — Automated Clearing House',
      timeout:                 30_000,
      maxRetries:              3,
      retryBackoff:            2_000,
      circuitBreakerThreshold: 5,
      circuitBreakerResetMs:   300_000    // 5 minutes
    })
    this.achConfig = config
  }

  // ─── Abstract Implementation ────────────────────────────────────────────────

  protected async submitToRail(
    payload: RailPayload
  ): Promise<RailSubmissionResult> {
    switch (this.achConfig.provider) {
      case 'dwolla':          return this.dwolla_submit(payload)
      case 'modern_treasury': return this.modernTreasury_submit(payload)
      case 'column':          return this.column_submit(payload)
    }
  }

  protected async queryRailStatus(
    externalReference: string
  ): Promise<RailStatusResult> {
    switch (this.achConfig.provider) {
      case 'dwolla':          return this.dwolla_status(externalReference)
      case 'modern_treasury': return this.modernTreasury_status(externalReference)
      case 'column':          return this.column_status(externalReference)
    }
  }

  async validateCredentials(): Promise<boolean> {
    try {
      switch (this.achConfig.provider) {
        case 'dwolla':
          return !!(await this.getDwollaToken())
        case 'modern_treasury':
        case 'column':
          return !!this.achConfig.apiKey
      }
    } catch {
      return false
    }
  }

  // ─── Dwolla ─────────────────────────────────────────────────────────────────

  private dwollaBase(): string {
    return this.achConfig.environment === 'production'
      ? 'https://api.dwolla.com'
      : 'https://api-sandbox.dwolla.com'
  }

  private async getDwollaToken(): Promise<string> {
    if (this.dwollaToken && Date.now() < this.dwollaTokenExpiry) {
      return this.dwollaToken
    }

    const res = await fetch(`${this.dwollaBase()}/token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     this.achConfig.apiKey,
        client_secret: this.achConfig.apiSecret
      })
    })

    if (!res.ok) {
      throw new Error(`Dwolla token fetch failed: ${res.status}`)
    }

    const body = await res.json()
    this.dwollaToken       = body.access_token
    this.dwollaTokenExpiry = Date.now() + (body.expires_in - 60) * 1000
    return this.dwollaToken!
  }

  private async dwolla_submit(payload: RailPayload): Promise<RailSubmissionResult> {
    const token = await this.getDwollaToken()

    const res = await fetch(`${this.dwollaBase()}/transfers`, {
      method:  'POST',
      headers: {
        'Authorization':  `Bearer ${token}`,
        'Content-Type':   'application/vnd.dwolla.v1.hal+json',
        'Accept':         'application/vnd.dwolla.v1.hal+json',
        'Idempotency-Key': payload.commandId
      },
      body: JSON.stringify({
        _links: {
          source:      { href: payload.source.accountNumber },
          destination: { href: payload.destination.accountNumber }
        },
        amount: {
          currency: payload.amount.currency,
          value:    payload.amount.value
        },
        metadata: {
          sovrCommandId:     payload.commandId,
          sovrCorrelationId: payload.correlationId
        },
        clearing: { source: 'next-available' }
      })
    })

    if (res.status === 201) {
      const location = res.headers.get('Location') ?? ''
      const transferId = location.split('/').pop() ?? ''
      return {
        status:            'SUBMITTED',
        externalReference: transferId,
        retryable:         false,
        submittedAt:       now(),
        railId:            this.config.railId,
        durationMs:        0
      }
    }

    if (res.status === 400 || res.status === 403 || res.status === 422) {
      const body = await res.json()
      return {
        status:       'REJECTED',
        errorCode:    body.code,
        errorMessage: body.message,
        rawResponse:  body,
        retryable:    false,
        submittedAt:  now(),
        railId:       this.config.railId,
        durationMs:   0
      }
    }

    // 5xx — unknown, may have submitted
    return {
      status:      'UNKNOWN_EXTERNAL_STATE',
      retryable:   true,
      submittedAt: now(),
      railId:      this.config.railId,
      durationMs:  0
    }
  }

  private async dwolla_status(ref: string): Promise<RailStatusResult> {
    const token = await this.getDwollaToken()

    const res = await fetch(`${this.dwollaBase()}/transfers/${ref}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept':        'application/vnd.dwolla.v1.hal+json'
      }
    })

    const body = await res.json()

    const map: Record<string, RailStatusResult['status']> = {
      'processed':  'SETTLED',
      'pending':    'PENDING',
      'failed':     'FAILED',
      'cancelled':  'FAILED'
    }

    return {
      status:            map[body.status] ?? 'UNKNOWN_EXTERNAL_STATE',
      externalReference: ref,
      settledAt:         body.created,
      rawResponse:       body,
      railId:            this.config.railId
    }
  }

  // ─── Modern Treasury ────────────────────────────────────────────────────────

  private modernTreasuryBase(): string {
    return 'https://app.moderntreasury.com/api'
  }

  private modernTreasuryAuth(): string {
    return 'Basic ' + Buffer.from(
      `${this.achConfig.apiKey}:${this.achConfig.apiSecret}`
    ).toString('base64')
  }

  private async modernTreasury_submit(
    payload: RailPayload
  ): Promise<RailSubmissionResult> {

    const cents = BigInt(
      Math.round(parseFloat(payload.amount.value) * 100)
    )

    const res = await fetch(`${this.modernTreasuryBase()}/payment_orders`, {
      method:  'POST',
      headers: {
        'Authorization':   this.modernTreasuryAuth(),
        'Content-Type':    'application/json',
        'Idempotency-Key': payload.commandId
      },
      body: JSON.stringify({
        type:                   'ach',
        amount:                 Number(cents),
        currency:               payload.amount.currency,
        direction:              'credit',
        originating_account_id: this.achConfig.companyId,
        receiving_account: {
          account_type:    'checking',
          account_number:  payload.destination.accountNumber,
          routing_number:  payload.destination.routingNumber,
          name:            payload.metadata.description ?? 'SOVR Transfer'
        },
        metadata: {
          sovr_command_id:     payload.commandId,
          sovr_correlation_id: payload.correlationId
        }
      })
    })

    const body = await res.json()

    if (res.ok) {
      return {
        status:            'SUBMITTED',
        externalReference: body.id,
        rawResponse:       body,
        retryable:         false,
        submittedAt:       now(),
        railId:            this.config.railId,
        durationMs:        0
      }
    }

    if (res.status === 422) {
      return {
        status:       'REJECTED',
        errorCode:    body.code,
        errorMessage: (body.errors ?? []).join(', '),
        rawResponse:  body,
        retryable:    false,
        submittedAt:  now(),
        railId:       this.config.railId,
        durationMs:   0
      }
    }

    return {
      status:      'UNKNOWN_EXTERNAL_STATE',
      retryable:   true,
      submittedAt: now(),
      railId:      this.config.railId,
      durationMs:  0
    }
  }

  private async modernTreasury_status(ref: string): Promise<RailStatusResult> {
    const res = await fetch(
      `${this.modernTreasuryBase()}/payment_orders/${ref}`,
      { headers: { 'Authorization': this.modernTreasuryAuth() } }
    )
    const body = await res.json()

    const map: Record<string, RailStatusResult['status']> = {
      'completed': 'SETTLED',
      'pending':   'PENDING',
      'processing':'PENDING',
      'failed':    'FAILED',
      'reversed':  'REVERSED'
    }

    return {
      status:            map[body.status] ?? 'UNKNOWN_EXTERNAL_STATE',
      externalReference: ref,
      settledAt:         body.effective_date,
      rawResponse:       body,
      railId:            this.config.railId
    }
  }

  // ─── Column ─────────────────────────────────────────────────────────────────

  private columnBase(): string {
    return this.achConfig.environment === 'production'
      ? 'https://api.column.com'
      : 'https://api.sandbox.column.com'
  }

  private async column_submit(
    payload: RailPayload
  ): Promise<RailSubmissionResult> {

    const cents = Math.round(parseFloat(payload.amount.value) * 100)

    const res = await fetch(`${this.columnBase()}/transfers/ach`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${this.achConfig.apiKey}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        amount:                   cents,
        currency_code:            payload.amount.currency,
        entry_class_code:         'PPD',
        company_entry_description: this.achConfig.companyEntryDescription,
        receiver_name:            payload.metadata.description ?? 'SOVR Transfer',
        bank_account_number:      payload.destination.accountNumber,
        bank_routing_number:      payload.destination.routingNumber,
        idempotency_key:          payload.commandId
      })
    })

    const body = await res.json()

    if (res.ok) {
      return {
        status:            'SUBMITTED',
        externalReference: body.id,
        rawResponse:       body,
        retryable:         false,
        submittedAt:       now(),
        railId:            this.config.railId,
        durationMs:        0
      }
    }

    const isClientError = res.status >= 400 && res.status < 500
    return {
      status:       isClientError ? 'REJECTED' : 'UNKNOWN_EXTERNAL_STATE',
      errorCode:    body.error_code,
      errorMessage: body.error_message,
      rawResponse:  body,
      retryable:    !isClientError,
      submittedAt:  now(),
      railId:       this.config.railId,
      durationMs:   0
    }
  }

  private async column_status(ref: string): Promise<RailStatusResult> {
    const res = await fetch(`${this.columnBase()}/transfers/ach/${ref}`, {
      headers: { 'Authorization': `Bearer ${this.achConfig.apiKey}` }
    })
    const body = await res.json()

    const map: Record<string, RailStatusResult['status']> = {
      'completed': 'SETTLED',
      'pending':   'PENDING',
      'failed':    'FAILED',
      'returned':  'RETURNED'
    }

    return {
      status:            map[body.status] ?? 'UNKNOWN_EXTERNAL_STATE',
      externalReference: ref,
      rawResponse:       body,
      railId:            this.config.railId
    }
  }

  // ─── Return Code Handler ────────────────────────────────────────────────────

  /**
   * Called when an ACH return event is received.
   * Returns human-readable reason for the SOVR event payload.
   */
  static decodeReturnCode(code: string): string {
    return ACH_RETURN_CODES[code.toUpperCase()] ?? `Unknown return code: ${code}`
  }
}
