// ─────────────────────────────────────────────────────────────────────────────
// packages/runtime/src/adapters/oracle/PriceOracleDriver.ts
// ─────────────────────────────────────────────────────────────────────────────
/**
 * PriceOracleDriver
 *
 * NOT a payment rail — READ ONLY price data source.
 *
 * Sources:
 *   Chainlink  — on-chain decentralized price feeds
 *   Band       — cross-chain oracle protocol
 *   Internal   — trusted internal pricing service
 *
 * Constitutional rule:
 *   Price data is INPUT to valuation commands.
 *   It CANNOT directly mutate ledger state.
 *   All price-driven mutations route through CommandBus.
 *   Emits: vault.asset.valuation.updated event only.
 *
 * Scaffold: structure complete, live wire pending oracle integration
 */

import { BaseRailDriver, RailPayload, RailSubmissionResult, RailStatusResult, now } from '../base/BaseRailDriver'

export type OracleProvider = 'chainlink' | 'band' | 'internal'

export type OracleConfig = {
  provider:    OracleProvider
  apiKey?:     string
  rpcUrl?:     string    // For Chainlink on-chain reads
  environment: 'test' | 'production'
}

export type PriceResult = {
  asset:      string
  priceUSD:   string
  precision:  number
  timestamp:  string
  source:     OracleProvider
}

export class PriceOracleDriver extends BaseRailDriver {
  private readonly oracleConfig: OracleConfig

  constructor(config: OracleConfig) {
    super({
      railId:                  'price-oracle',
      railName:                'Price Oracle',
      timeout:                 5_000,
      maxRetries:              3,
      retryBackoff:            1_000,
      circuitBreakerThreshold: 5,
      circuitBreakerResetMs:   60_000
    })
    this.oracleConfig = config
  }

  /**
   * Price oracle does not submit transfers.
   * submitToRail is a READ operation — fetch current price.
   * Returns price in the externalReference field.
   */
  protected async submitToRail(p: RailPayload): Promise<RailSubmissionResult> {
    const asset = p.metadata.reference ?? p.amount.currency
    const price = await this.fetchPrice(asset)

    if (price) {
      return { status: 'SUBMITTED', externalReference: price.priceUSD, rawResponse: price, retryable: false, submittedAt: now(), railId: this.config.railId, durationMs: 0 }
    }
    return { status: 'UNKNOWN_EXTERNAL_STATE', errorCode: 'PRICE_UNAVAILABLE', errorMessage: `Could not fetch price for ${asset}`, retryable: true, submittedAt: now(), railId: this.config.railId, durationMs: 0 }
  }

  async fetchPrice(asset: string): Promise<PriceResult | null> {
    // Scaffold: integrate Chainlink AggregatorV3Interface or Band Protocol SDK
    // For Chainlink: read latestRoundData() from price feed contract via ethers.js
    // For Band: query /oracle/v1/standard_reference/standard from Band REST API
    // For internal: fetch from trusted internal pricing microservice
    return null
  }

  protected async queryRailStatus(ref: string): Promise<RailStatusResult> {
    return { status: 'UNKNOWN_EXTERNAL_STATE', externalReference: ref, failureReason: 'Price oracle does not support status queries', railId: this.config.railId }
  }

  async validateCredentials(): Promise<boolean> {
    return this.oracleConfig.provider === 'internal' || !!this.oracleConfig.apiKey || !!this.oracleConfig.rpcUrl
  }
}
