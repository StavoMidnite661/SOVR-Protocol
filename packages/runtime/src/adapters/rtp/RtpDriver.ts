// ─────────────────────────────────────────────────────────────────────────────
// packages/runtime/src/adapters/rtp/RtpDriver.ts
// ─────────────────────────────────────────────────────────────────────────────
/**
 * RTP Driver — The Clearing House Real-Time Payments
 *
 * Settlement: Real-time, 15 seconds, 24/7/365
 * Maximum: $1,000,000 per transaction
 * Format: ISO 20022 (same message structure as FedNow)
 * Network: TCH RTP (separate from FedNow — competing networks)
 * Access: Via TCH RTP participating bank
 *
 * Scaffold: structure complete, live wire pending provider agreement
 */

import { BaseRailDriver, RailPayload, RailSubmissionResult, RailStatusResult, now } from '../base/BaseRailDriver'

export type RtpConfig = {
  participantId:     string
  sponsoringBankUrl: string
  apiKey:            string
  environment:       'test' | 'production'
}

export class RtpDriver extends BaseRailDriver {
  private readonly rtpConfig: RtpConfig

  constructor(config: RtpConfig) {
    super({
      railId:                  'rtp',
      railName:                'RTP Real-Time Payments (TCH)',
      timeout:                 10_000,
      maxRetries:              2,
      retryBackoff:            1_000,
      circuitBreakerThreshold: 5,
      circuitBreakerResetMs:   60_000
    })
    this.rtpConfig = config
  }

  protected async submitToRail(p: RailPayload): Promise<RailSubmissionResult> {
    const res = await fetch(`${this.rtpConfig.sponsoringBankUrl}/rtp/credit-transfer`, {
      method:  'POST',
      headers: {
        'Authorization':    `Bearer ${this.rtpConfig.apiKey}`,
        'Content-Type':     'application/json',
        'X-Participant-Id': this.rtpConfig.participantId,
        'X-Idempotency-Key': p.commandId
      },
      body: JSON.stringify({
        // ISO 20022 pacs.008 — same structure as FedNow
        msgId:   p.commandId,
        amount:  { ccy: p.amount.currency, value: p.amount.value },
        dbtr:    { rtgNb: p.source.routingNumber, acctNb: p.source.accountNumber },
        cdtr:    { rtgNb: p.destination.routingNumber, acctNb: p.destination.accountNumber },
        rmtInf:  p.metadata.description ?? 'SOVR RTP Transfer'
      })
    })

    const body = await res.json()

    if (res.ok && (body.status === 'ACCP' || body.status === 'ACSC')) {
      return { status: 'SUBMITTED', externalReference: body.transactionId, rawResponse: body, retryable: false, submittedAt: now(), railId: this.config.railId, durationMs: 0 }
    }
    if (body.status === 'RJCT') {
      return { status: 'REJECTED', errorCode: body.reasonCode, errorMessage: body.reasonDescription, rawResponse: body, retryable: false, submittedAt: now(), railId: this.config.railId, durationMs: 0 }
    }
    return { status: 'UNKNOWN_EXTERNAL_STATE', retryable: true, submittedAt: now(), railId: this.config.railId, durationMs: 0 }
  }

  protected async queryRailStatus(ref: string): Promise<RailStatusResult> {
    const res = await fetch(`${this.rtpConfig.sponsoringBankUrl}/rtp/status/${ref}`, {
      headers: { 'Authorization': `Bearer ${this.rtpConfig.apiKey}` }
    })
    const body = await res.json()
    const map: Record<string, RailStatusResult['status']> = { 'ACSC': 'SETTLED', 'ACCC': 'SETTLED', 'PDNG': 'PENDING', 'ACCP': 'PENDING', 'RJCT': 'FAILED' }
    return { status: map[body.status] ?? 'UNKNOWN_EXTERNAL_STATE', externalReference: ref, settledAt: body.settlementDate, rawResponse: body, railId: this.config.railId }
  }

  async validateCredentials(): Promise<boolean> {
    try { return (await fetch(`${this.rtpConfig.sponsoringBankUrl}/ping`, { headers: { 'Authorization': `Bearer ${this.rtpConfig.apiKey}` } })).ok } catch { return false }
  }
}
