// ─────────────────────────────────────────────────────────────────────────────
// packages/runtime/src/adapters/swift/SwiftDriver.ts
// ─────────────────────────────────────────────────────────────────────────────
/**
 * SWIFT Driver — International Wire
 *
 * Settlement: T+1 to T+5 (correspondent chain)
 * Format: ISO 20022 MX / MT legacy
 * SWIFT gpi: Global Payments Innovation (same-day tracking)
 * Access: SWIFT member bank or correspondent bank API
 * Required: BIC code for sender and receiver
 *
 * Scaffold: structure complete, live wire pending SWIFT membership or sponsor
 */

import { BaseRailDriver, RailPayload, RailSubmissionResult, RailStatusResult, now } from '../base/BaseRailDriver'

export type SwiftConfig = {
  sponsoringBankUrl: string
  apiKey:            string
  bic:               string   // Bank Identifier Code (8 or 11 chars)
  environment:       'test' | 'production'
}

export class SwiftDriver extends BaseRailDriver {
  private readonly swiftConfig: SwiftConfig

  constructor(config: SwiftConfig) {
    super({
      railId:                  'swift',
      railName:                'SWIFT International Wire',
      timeout:                 30_000,
      maxRetries:              3,
      retryBackoff:            10_000,
      circuitBreakerThreshold: 3,
      circuitBreakerResetMs:   600_000   // 10 min
    })
    this.swiftConfig = config
  }

  protected async submitToRail(p: RailPayload): Promise<RailSubmissionResult> {
    const res = await fetch(`${this.swiftConfig.sponsoringBankUrl}/swift/transfer`, {
      method:  'POST',
      headers: {
        'Authorization':   `Bearer ${this.swiftConfig.apiKey}`,
        'Content-Type':    'application/json',
        'Idempotency-Key': p.commandId
      },
      body: JSON.stringify({
        // ISO 20022 pacs.008 with SWIFT extensions
        msgId:    p.commandId,
        uetr:     p.commandId,     // Unique End-to-End Transaction Reference (SWIFT gpi)
        amount:   { ccy: p.amount.currency, value: p.amount.value },
        dbtrBic:  this.swiftConfig.bic,
        cdtrBic:  p.destination.bic,
        dbtrAcct: p.source.iban ?? p.source.accountNumber,
        cdtrAcct: p.destination.iban ?? p.destination.accountNumber,
        rmtInf:   p.metadata.description ?? 'SOVR SWIFT Transfer'
      })
    })

    const body = await res.json()
    if (res.ok) return { status: 'SUBMITTED', externalReference: body.uetr ?? body.transactionId, rawResponse: body, retryable: false, submittedAt: now(), railId: this.config.railId, durationMs: 0 }
    const isClientError = res.status >= 400 && res.status < 500
    return { status: isClientError ? 'REJECTED' : 'UNKNOWN_EXTERNAL_STATE', errorCode: body.code, errorMessage: body.message, rawResponse: body, retryable: !isClientError, submittedAt: now(), railId: this.config.railId, durationMs: 0 }
  }

  protected async queryRailStatus(ref: string): Promise<RailStatusResult> {
    const res = await fetch(`${this.swiftConfig.sponsoringBankUrl}/swift/gpi/status/${ref}`, {
      headers: { 'Authorization': `Bearer ${this.swiftConfig.apiKey}` }
    })
    const body = await res.json()
    const map: Record<string, RailStatusResult['status']> = { 'ACSC': 'SETTLED', 'PDNG': 'PENDING', 'RJCT': 'FAILED' }
    return { status: map[body.status] ?? 'UNKNOWN_EXTERNAL_STATE', externalReference: ref, settledAt: body.settlementDate, rawResponse: body, railId: this.config.railId }
  }

  async validateCredentials(): Promise<boolean> {
    try { return (await fetch(`${this.swiftConfig.sponsoringBankUrl}/ping`, { headers: { 'Authorization': `Bearer ${this.swiftConfig.apiKey}` } })).ok } catch { return false }
  }
}
