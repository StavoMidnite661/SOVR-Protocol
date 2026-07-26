// ─────────────────────────────────────────────────────────────────────────────
// packages/runtime/src/adapters/stablecoin/StablecoinDriver.ts
// ─────────────────────────────────────────────────────────────────────────────
/**
 * StablecoinDriver
 *
 * USDC (Circle), USDT (Tether), DAI (MakerDAO) transfers.
 *
 * Preferred path: Circle API (USDC)
 *   Programmable wallets — Circle manages gas
 *   No private key management required for USDC
 *   Circle API: https://developers.circle.com
 *
 * Fallback path: Direct ERC-20 transfer (via EvmDriver pattern)
 *   Requires funded wallet + gas
 *   USDT and DAI — no Circle API equivalent
 *
 * Scaffold: structure complete, live wire pending Circle API key
 */

import { BaseRailDriver, RailPayload, RailSubmissionResult, RailStatusResult, now } from '../base/BaseRailDriver'

export type StablecoinConfig = {
  token:       'USDC' | 'USDT' | 'DAI'
  provider:    'circle' | 'erc20_direct'
  apiKey?:     string    // Circle API key (USDC via Circle)
  walletId?:   string    // Circle wallet ID
  environment: 'sandbox' | 'production'
}

export class StablecoinDriver extends BaseRailDriver {
  private readonly stableConfig: StablecoinConfig

  constructor(config: StablecoinConfig) {
    super({
      railId:                  'stablecoin',
      railName:                `Stablecoin (${config.token})`,
      timeout:                 60_000,
      maxRetries:              3,
      retryBackoff:            5_000,
      circuitBreakerThreshold: 5,
      circuitBreakerResetMs:   120_000
    })
    this.stableConfig = config
  }

  protected async submitToRail(p: RailPayload): Promise<RailSubmissionResult> {
    if (this.stableConfig.provider === 'circle' && this.stableConfig.apiKey) {
      return this.circleSubmit(p)
    }
    return { status: 'UNKNOWN_EXTERNAL_STATE', errorCode: 'SCAFFOLD_NOT_WIRED', errorMessage: 'StablecoinDriver: configure Circle API key or ERC-20 path', retryable: false, submittedAt: now(), railId: this.config.railId, durationMs: 0 }
  }

  private async circleSubmit(p: RailPayload): Promise<RailSubmissionResult> {
    const base = this.stableConfig.environment === 'production'
      ? 'https://api.circle.com/v1'
      : 'https://api-sandbox.circle.com/v1'

    const res = await fetch(`${base}/transfers`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${this.stableConfig.apiKey}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        idempotencyKey: p.commandId,
        source:         { type: 'wallet', id: this.stableConfig.walletId },
        destination:    { type: 'blockchain', address: p.destination.walletAddress, chain: 'ETH' },
        amount:         { amount: p.amount.value, currency: 'USD' }
      })
    })

    const body = await res.json()
    if (res.ok) return { status: 'SUBMITTED', externalReference: body.data?.id, rawResponse: body, retryable: false, submittedAt: now(), railId: this.config.railId, durationMs: 0 }
    return { status: 'REJECTED', errorCode: body.code?.toString(), errorMessage: body.message, rawResponse: body, retryable: false, submittedAt: now(), railId: this.config.railId, durationMs: 0 }
  }

  protected async queryRailStatus(ref: string): Promise<RailStatusResult> {
    if (this.stableConfig.provider !== 'circle' || !this.stableConfig.apiKey) {
      return { status: 'UNKNOWN_EXTERNAL_STATE', externalReference: ref, railId: this.config.railId }
    }
    const base = this.stableConfig.environment === 'production' ? 'https://api.circle.com/v1' : 'https://api-sandbox.circle.com/v1'
    const res = await fetch(`${base}/transfers/${ref}`, { headers: { 'Authorization': `Bearer ${this.stableConfig.apiKey}` } })
    const body = await res.json()
    const map: Record<string, RailStatusResult['status']> = { 'complete': 'SETTLED', 'pending': 'PENDING', 'failed': 'FAILED' }
    return { status: map[body.data?.status] ?? 'UNKNOWN_EXTERNAL_STATE', externalReference: ref, rawResponse: body, railId: this.config.railId }
  }

  async validateCredentials(): Promise<boolean> {
    return !!this.stableConfig.apiKey
  }
}
