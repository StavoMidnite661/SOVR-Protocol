/**
 * FedwireDriver
 *
 * Fedwire Funds Service — large-value same-day wire.
 *
 * Settlement: Same-day, real-time during operating hours
 * Format: Fedwire message format (tag-based)
 * Operating hours: 9:00 PM ET Sunday → 7:00 PM ET Friday
 * Access: Via Fedwire-participating bank API
 *
 * IMAD — Input Message Accountability Data
 *   Assigned by Fedwire at submission.
 *   Used to track and query the transfer.
 */

import {
  BaseRailDriver,
  RailPayload,
  RailSubmissionResult,
  RailStatusResult,
  now
} from '../base/BaseRailDriver'

export type FedwireConfig = {
  sponsoringBankUrl:     string
  apiKey:                string
  senderRoutingNumber:   string   // 9-digit ABA
  senderAccountNumber:   string
  environment:           'test' | 'production'
}

export class FedwireDriver extends BaseRailDriver {

  private readonly wireConfig: FedwireConfig

  constructor(config: FedwireConfig) {
    super({
      railId:                  'wire',
      railName:                'Fedwire Funds Service',
      timeout:                 30_000,
      maxRetries:              2,
      retryBackoff:            5_000,
      circuitBreakerThreshold: 3,
      circuitBreakerResetMs:   300_000
    })
    this.wireConfig = config
  }

  protected async submitToRail(
    payload: RailPayload
  ): Promise<RailSubmissionResult> {

    // Constitutional rule: Fedwire hours must be checked
    // before any submission attempt
    if (!this.isFedwireOpen()) {
      return {
        status:       'REJECTED',
        errorCode:    'FEDWIRE_CLOSED',
        errorMessage: this.fedwireClosedMessage(),
        retryable:    true,
        submittedAt:  now(),
        railId:       this.config.railId,
        durationMs:   0
      }
    }

    const res = await fetch(
      `${this.wireConfig.sponsoringBankUrl}/wire/submit`,
      {
        method:  'POST',
        headers: {
          'Authorization':   `Bearer ${this.wireConfig.apiKey}`,
          'Content-Type':    'application/json',
          'Idempotency-Key': payload.commandId
        },
        body: JSON.stringify({
          senderRoutingNumber:   this.wireConfig.senderRoutingNumber,
          senderAccountNumber:   this.wireConfig.senderAccountNumber,
          receiverRoutingNumber: payload.destination.routingNumber,
          receiverAccountNumber: payload.destination.accountNumber,
          amount:                payload.amount.value,
          currency:              payload.amount.currency,
          wireReference:         payload.commandId,
          senderToReceiverInfo:  payload.metadata.description ?? 'SOVR Wire',
          businessFunctionCode:  'CTR'   // Customer Transfer
        })
      }
    )

    const body = await res.json()

    if (res.ok) {
      return {
        status:            'SUBMITTED',
        externalReference: body.imad ?? body.transactionId,
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
      errorCode:    body.errorCode,
      errorMessage: body.errorMessage,
      rawResponse:  body,
      retryable:    !isClientError,
      submittedAt:  now(),
      railId:       this.config.railId,
      durationMs:   0
    }
  }

  protected async queryRailStatus(ref: string): Promise<RailStatusResult> {
    const res = await fetch(
      `${this.wireConfig.sponsoringBankUrl}/wire/status/${ref}`,
      { headers: { 'Authorization': `Bearer ${this.wireConfig.apiKey}` } }
    )

    const body = await res.json()

    const map: Record<string, RailStatusResult['status']> = {
      'SENT':     'SETTLED',
      'SETTLED':  'SETTLED',
      'PENDING':  'PENDING',
      'FAILED':   'FAILED',
      'RETURNED': 'RETURNED'
    }

    return {
      status:            map[body.status] ?? 'UNKNOWN_EXTERNAL_STATE',
      externalReference: ref,
      settledAt:         body.settlementTime,
      rawResponse:       body,
      railId:            this.config.railId
    }
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const res = await fetch(`${this.wireConfig.sponsoringBankUrl}/ping`, {
        headers: { 'Authorization': `Bearer ${this.wireConfig.apiKey}` }
      })
      return res.ok
    } catch {
      return false
    }
  }

  /**
   * Fedwire operating hours (ET):
   *   Opens:  9:00 PM Sunday
   *   Closes: 7:00 PM Friday
   *   Closed: All day Saturday
   *
   * Source: Federal Reserve Financial Services
   */
  isFedwireOpen(): boolean {
    const et    = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
    )
    const day   = et.getDay()       // 0=Sun … 6=Sat
    const mins  = et.getHours() * 60 + et.getMinutes()
    const open  = 21 * 60           // 9:00 PM = 1260 min
    const close = 19 * 60           // 7:00 PM = 1140 min

    if (day === 6) return false                  // Saturday: always closed
    if (day === 0) return mins >= open           // Sunday: opens 9 PM
    if (day === 5) return mins < close           // Friday: closes 7 PM
    return true                                  // Mon–Thu: always open
  }

  private fedwireClosedMessage(): string {
    const et  = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
    )
    const day = et.getDay()
    if (day === 6) {
      return 'Fedwire is closed Saturday. Opens Sunday at 9:00 PM ET.'
    }
    return 'Fedwire is currently closed. Operating hours: 9:00 PM ET Sunday through 7:00 PM ET Friday.'
  }
}
