// ─────────────────────────────────────────────────────────────────────────────
// packages/runtime/src/adapters/sepa/SepaDriver.ts
// ─────────────────────────────────────────────────────────────────────────────
/**
 * SEPA Driver — Single Euro Payments Area
 *
 * Schemes:
 *   SCT     — Credit Transfer, T+1, no limit
 *   SCT Inst — Instant, 10 seconds, max €100,000
 *   SDD     — Direct Debit, T+2 to T+5
 *
 * Geography: 36 countries (EU + EEA)
 * Format: ISO 20022 (pain.001, pacs.008)
 * Currency: EUR only
 * Required: IBAN for both parties, BIC for cross-border
 *
 * Scaffold: structure complete, live wire pending SEPA bank agreement
 */

import { BaseRailDriver, RailPayload, RailSubmissionResult, RailStatusResult, now } from '../base/BaseRailDriver'

export type SepaConfig = {
  sponsoringBankUrl: string
  apiKey:            string
  sourceIban:        string
  environment:       'test' | 'production'
}

export class SepaDriver extends BaseRailDriver {
  private readonly sepaConfig: SepaConfig

  constructor(config: SepaConfig) {
    super({
      railId:                  'sepa',
      railName:                'SEPA Credit Transfer',
      timeout:                 15_000,
      maxRetries:              3,
      retryBackoff:            2_000,
      circuitBreakerThreshold: 5,
      circuitBreakerResetMs:   120_000
    })
    this.sepaConfig = config
  }

  protected async submitToRail(p: RailPayload): Promise<RailSubmissionResult> {
    const res = await fetch(`${this.sepaConfig.sponsoringBankUrl}/sepa/credit-transfer`, {
      method:  'POST',
      headers: {
        'Authorization':   `Bearer ${this.sepaConfig.apiKey}`,
        'Content-Type':    'application/json',
        'Idempotency-Key': p.commandId
      },
      body: JSON.stringify({
        // ISO 20022 pain.001
        msgId:      p.commandId,
        creDtTm:    now(),
        amount:     { ccy: 'EUR', value: p.amount.value },
        dbtrIban:   this.sepaConfig.sourceIban,
        cdtrIban:   p.destination.iban,
        cdtrBic:    p.destination.bic,
        endToEndId: p.correlationId,
        rmtInf:     p.metadata.description ?? 'SOVR SEPA Transfer'
      })
    })

    const body = await res.json()
    if (res.ok) return { status: 'SUBMITTED', externalReference: body.transactionId, rawResponse: body, retryable: false, submittedAt: now(), railId: this.config.railId, durationMs: 0 }
    const isClientError = res.status >= 400 && res.status < 500
    return { status: isClientError ? 'REJECTED' : 'UNKNOWN_EXTERNAL_STATE', errorCode: body.code, errorMessage: body.message, retryable: !isClientError, submittedAt: now(), railId: this.config.railId, durationMs: 0 }
  }

  protected async queryRailStatus(ref: string): Promise<RailStatusResult> {
    const res = await fetch(`${this.sepaConfig.sponsoringBankUrl}/sepa/status/${ref}`, {
      headers: { 'Authorization': `Bearer ${this.sepaConfig.apiKey}` }
    })
    const body = await res.json()
    const map: Record<string, RailStatusResult['status']> = { 'ACSC': 'SETTLED', 'PDNG': 'PENDING', 'RJCT': 'FAILED' }
    return { status: map[body.status] ?? 'UNKNOWN_EXTERNAL_STATE', externalReference: ref, settledAt: body.settlementDate, rawResponse: body, railId: this.config.railId }
  }

  async validateCredentials(): Promise<boolean> {
    try { return (await fetch(`${this.sepaConfig.sponsoringBankUrl}/ping`, { headers: { 'Authorization': `Bearer ${this.sepaConfig.apiKey}` } })).ok } catch { return false }
  }
}
