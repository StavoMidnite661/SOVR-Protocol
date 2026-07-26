// ─────────────────────────────────────────────────────────────────────────────
// packages/runtime/src/adapters/card/CardNetworkDriver.ts
// ─────────────────────────────────────────────────────────────────────────────
/**
 * CardNetworkDriver
 *
 * Card issuing and authorization via card issuing platform.
 *
 * Platforms: Marqeta, Stripe Issuing, Lithic
 * Networks: Visa, Mastercard, Amex (via issuing platform)
 * Settlement: T+1 to T+3 net settlement
 * Auth: Synchronous, must respond < 2 seconds
 *
 * Required:
 *   BIN sponsorship (issuing bank provides BIN range)
 *   Card issuing platform API agreement
 *   PCI-DSS compliance (handled by issuing platform)
 *
 * Flow:
 *   Authorization → immediate (submit returns PENDING)
 *   Settlement    → async (query returns SETTLED when net settled)
 *
 * Scaffold: structure complete, live wire pending BIN/platform agreement
 */

import { BaseRailDriver, RailPayload, RailSubmissionResult, RailStatusResult, now } from '../base/BaseRailDriver'

export type CardProvider = 'marqeta' | 'stripe' | 'lithic'

export type CardNetworkConfig = {
  provider:    CardProvider
  apiKey:      string
  apiSecret?:  string
  environment: 'sandbox' | 'production'
}

export class CardNetworkDriver extends BaseRailDriver {
  private readonly cardConfig: CardNetworkConfig

  constructor(config: CardNetworkConfig) {
    super({
      railId:                  'card',
      railName:                'Card Network (Visa/MC/Amex)',
      timeout:                 5_000,    // Card auth MUST be < 2s; 5s is outer limit
      maxRetries:              1,        // Never retry card auth — idempotency unclear
      retryBackoff:            0,
      circuitBreakerThreshold: 10,
      circuitBreakerResetMs:   60_000
    })
    this.cardConfig = config
  }

  protected async submitToRail(p: RailPayload): Promise<RailSubmissionResult> {
    // Platform-specific auth
    // Card submit = authorization (returns PENDING until settlement)
    const baseUrl = this.cardConfig.provider === 'marqeta'
      ? (this.cardConfig.environment === 'production' ? 'https://api.marqeta.com/v3' : 'https://sandbox-api.marqeta.com/v3')
      : this.cardConfig.provider === 'stripe'
        ? 'https://api.stripe.com/v1'
        : (this.cardConfig.environment === 'production' ? 'https://api.lithic.com/v1' : 'https://sandbox.lithic.com/v1')

    const res = await fetch(`${baseUrl}/transactions`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${this.cardConfig.apiKey}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        amount:   Math.round(parseFloat(p.amount.value) * 100),
        currency: p.amount.currency,
        token:    p.destination.accountNumber,  // Card token
        metadata: { sovr_command_id: p.commandId }
      })
    })

    const body = await res.json()
    if (res.ok) return { status: 'PENDING', externalReference: body.token ?? body.id, rawResponse: body, retryable: false, submittedAt: now(), railId: this.config.railId, durationMs: 0 }
    const isClientError = res.status >= 400 && res.status < 500
    return { status: isClientError ? 'REJECTED' : 'UNKNOWN_EXTERNAL_STATE', errorCode: body.error_code ?? body.error?.code, errorMessage: body.error_message ?? body.error?.message, rawResponse: body, retryable: !isClientError, submittedAt: now(), railId: this.config.railId, durationMs: 0 }
  }

  protected async queryRailStatus(ref: string): Promise<RailStatusResult> {
    const baseUrl = this.cardConfig.provider === 'marqeta'
      ? 'https://api.marqeta.com/v3'
      : this.cardConfig.provider === 'stripe'
        ? 'https://api.stripe.com/v1'
        : 'https://api.lithic.com/v1'

    const res = await fetch(`${baseUrl}/transactions/${ref}`, {
      headers: { 'Authorization': `Bearer ${this.cardConfig.apiKey}` }
    })
    const body = await res.json()
    const map: Record<string, RailStatusResult['status']> = { 'COMPLETION': 'SETTLED', 'SETTLED': 'SETTLED', 'PENDING': 'PENDING', 'DECLINE': 'FAILED', 'REVERSAL': 'REVERSED' }
    return { status: map[body.type ?? body.status] ?? 'UNKNOWN_EXTERNAL_STATE', externalReference: ref, rawResponse: body, railId: this.config.railId }
  }

  async validateCredentials(): Promise<boolean> {
    return !!this.cardConfig.apiKey
  }
}
