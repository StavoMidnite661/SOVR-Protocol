/**
 * RailDriverRegistry
 *
 * Single source of truth for all registered rail drivers.
 *
 * Loaded at Runlevel 5 — EXECUTION_BOUNDARY.
 * Only drivers with valid credentials are registered.
 * SovrLedgerDriver is always registered — it has no external deps.
 * TigerBeetle is registered when TIGERBEETLE_ADDRESSES is set.
 * External rails registered when their API keys are present.
 *
 * Constitutional guarantee:
 *   Every registered driver has been credential-validated at boot.
 *   An unregistered rail cannot be called.
 *   Unknown rail ID → REJECTED (fail closed).
 */

import { BaseRailDriver }              from './base/BaseRailDriver'
import { TigerBeetleDriver }           from './tigerbeetle/TigerBeetleDriver'
import { TigerBeetleAccountManager }   from './tigerbeetle/TigerBeetleAccountManager'
import { TigerBeetleTransferBuilder }  from './tigerbeetle/TigerBeetleTransferBuilder'
import { SovrLedgerDriver }            from './private-ledger/SovrLedgerDriver'
import { AchDriver }                   from './ach/AchDriver'
import { FedNowDriver }                from './fednow/FedNowDriver'
import { FedwireDriver }               from './wire/FedwireDriver'
import { RtpDriver }                   from './rtp/RtpDriver'
import { CardNetworkDriver }           from './card/CardNetworkDriver'
import { EvmDriver }                   from './blockchain/EvmDriver'
import { StablecoinDriver }            from './stablecoin/StablecoinDriver'
import { SwiftDriver }                 from './swift/SwiftDriver'
import { SepaDriver }                  from './sepa/SepaDriver'
import { PriceOracleDriver }           from './oracle/PriceOracleDriver'

import type { KernelExecutorHandle }   from './private-ledger/SovrLedgerDriver'
import type { EventStoreHandle }       from './private-ledger/SovrLedgerDriver'

// ─── Registry ─────────────────────────────────────────────────────────────────

export class RailDriverRegistry {

  private readonly drivers: Map<string, BaseRailDriver> = new Map()

  // TigerBeetle is not a rail driver — it has its own registry slot
  private _tigerBeetle:      TigerBeetleDriver          | null = null
  private _accountManager:   TigerBeetleAccountManager  | null = null
  private _transferBuilder:  TigerBeetleTransferBuilder | null = null

  // ─── Registration ───────────────────────────────────────────────────────────

  registerDriver(railId: string, driver: BaseRailDriver): void {
    this.drivers.set(railId, driver)
    // Forward circuit breaker events to registry-level listeners
    driver.on('circuit:open',      (e) => this.emit_registry('circuit:open', e))
    driver.on('circuit:closed',    (e) => this.emit_registry('circuit:closed', e))
    driver.on('circuit:half_open', (e) => this.emit_registry('circuit:half_open', e))
    driver.on('rail:audit',        (e) => this.emit_registry('rail:audit', e))
  }

  registerTigerBeetle(tb: TigerBeetleDriver): void {
    this._tigerBeetle = tb
  }

  registerAccountManager(mgr: TigerBeetleAccountManager): void {
    this._accountManager = mgr
  }

  registerTransferBuilder(builder: TigerBeetleTransferBuilder): void {
    this._transferBuilder = builder
  }

  // ─── Retrieval ──────────────────────────────────────────────────────────────

  getDriver(railId: string): BaseRailDriver | null {
    return this.drivers.get(railId) ?? null
  }

  requireDriver(railId: string): BaseRailDriver {
    const driver = this.drivers.get(railId)
    if (!driver) {
      throw new Error(
        `Rail '${railId}' is not registered. ` +
        `Available: ${[...this.drivers.keys()].join(', ')}`
      )
    }
    return driver
  }

  get tigerBeetle(): TigerBeetleDriver | null        { return this._tigerBeetle }
  get accountManager(): TigerBeetleAccountManager | null { return this._accountManager }
  get transferBuilder(): TigerBeetleTransferBuilder | null { return this._transferBuilder }

  hasTigerBeetle(): boolean { return this._tigerBeetle !== null }

  // ─── Observability ──────────────────────────────────────────────────────────

  getRegisteredRails(): string[] {
    return [...this.drivers.keys()]
  }

  async healthCheck(): Promise<{
    rails: Record<string, {
      railId:       string
      circuitState: string
      healthy:      boolean
      metrics:      ReturnType<BaseRailDriver['getMetrics']>
    }>
    tigerBeetle?: Awaited<ReturnType<TigerBeetleDriver['healthCheck']>>
  }> {
    const rails: Record<string, any> = {}

    for (const [railId, driver] of this.drivers) {
      rails[railId] = {
        railId,
        circuitState: driver.getCircuitState(),
        healthy:      driver.getCircuitState() !== 'OPEN',
        metrics:      driver.getMetrics()
      }
    }

    const result: any = { rails }

    if (this._tigerBeetle) {
      result.tigerBeetle = await this._tigerBeetle.healthCheck()
    }

    return result
  }

  // ─── Event Forwarding ────────────────────────────────────────────────────────

  private _listeners: Map<string, Array<(e: unknown) => void>> = new Map()

  on(event: string, fn: (e: unknown) => void): this {
    if (!this._listeners.has(event)) this._listeners.set(event, [])
    this._listeners.get(event)!.push(fn)
    return this
  }

  private emit_registry(event: string, data: unknown): void {
    const fns = this._listeners.get(event) ?? []
    for (const fn of fns) fn(data)
  }

  // ─── Bootstrap ──────────────────────────────────────────────────────────────

  /**
   * Bootstrap all drivers from environment configuration.
   *
   * Called at Runlevel 5 — EXECUTION_BOUNDARY.
   *
   * Rules:
   *   1. SovrLedgerDriver — always registered
   *   2. TigerBeetle     — registered if TIGERBEETLE_ADDRESSES set
   *   3. External rails  — registered if API key present
   *   4. Each driver credential-validated before registration
   *   5. Failed validation — logged, driver NOT registered
   */
  static async bootstrap(
    kernel:     KernelExecutorHandle,
    eventStore: EventStoreHandle
  ): Promise<RailDriverRegistry> {

    const registry = new RailDriverRegistry()
    const env = process.env

    // ── SOVR Private Ledger — always active ─────────────────────────────────
    const sovrDriver = new SovrLedgerDriver(kernel, eventStore)
    registry.registerDriver('sovr-private-ledger', sovrDriver)

    // ── TigerBeetle — registered if addresses configured ────────────────────
    if (env.TIGERBEETLE_ADDRESSES) {
      const tb = new TigerBeetleDriver({
        clusterId:      parseInt(env.TIGERBEETLE_CLUSTER_ID ?? '0'),
        addresses:      env.TIGERBEETLE_ADDRESSES.split(','),
        concurrencyMax: parseInt(env.TIGERBEETLE_CONCURRENCY ?? '32')
      })

      await tb.connect()
      const tbHealth = await tb.healthCheck()

      if (tbHealth.status !== 'UNHEALTHY') {
        registry.registerTigerBeetle(tb)
        registry.registerAccountManager(new TigerBeetleAccountManager(tb))
        registry.registerTransferBuilder(new TigerBeetleTransferBuilder(tb))
        log('TigerBeetle: registered', tbHealth)
      } else {
        log('TigerBeetle: UNHEALTHY — not registered', tbHealth)
      }
    }

    // ── ACH ─────────────────────────────────────────────────────────────────
    if (env.ACH_API_KEY) {
      await registerIf(registry, new AchDriver({
        provider:                (env.ACH_PROVIDER ?? 'dwolla') as any,
        apiKey:                  env.ACH_API_KEY,
        apiSecret:               env.ACH_API_SECRET ?? '',
        environment:             prod(env) ? 'production' : 'sandbox',
        companyId:               env.ACH_COMPANY_ID ?? '',
        companyName:             env.ACH_COMPANY_NAME ?? 'SOVR',
        companyEntryDescription: env.ACH_ENTRY_DESC ?? 'SOVR',
        odfiRoutingNumber:       env.ACH_ODFI_ROUTING ?? ''
      }), 'ach')
    }

    // ── FedNow ───────────────────────────────────────────────────────────────
    if (env.FEDNOW_API_KEY) {
      await registerIf(registry, new FedNowDriver({
        participantId:     env.FEDNOW_PARTICIPANT_ID ?? '',
        sponsoringBankUrl: env.FEDNOW_BANK_URL ?? '',
        apiKey:            env.FEDNOW_API_KEY,
        environment:       prod(env) ? 'production' : 'test'
      }), 'fednow')
    }

    // ── Fedwire ──────────────────────────────────────────────────────────────
    if (env.WIRE_API_KEY) {
      await registerIf(registry, new FedwireDriver({
        sponsoringBankUrl:   env.WIRE_BANK_URL ?? '',
        apiKey:              env.WIRE_API_KEY,
        senderRoutingNumber: env.WIRE_SENDER_ROUTING ?? '',
        senderAccountNumber: env.WIRE_SENDER_ACCOUNT ?? '',
        environment:         prod(env) ? 'production' : 'test'
      }), 'wire')
    }

    // ── RTP ──────────────────────────────────────────────────────────────────
    if (env.RTP_API_KEY) {
      await registerIf(registry, new RtpDriver({
        participantId:     env.RTP_PARTICIPANT_ID ?? '',
        sponsoringBankUrl: env.RTP_BANK_URL ?? '',
        apiKey:            env.RTP_API_KEY,
        environment:       prod(env) ? 'production' : 'test'
      }), 'rtp')
    }

    // ── Card Networks ─────────────────────────────────────────────────────────
    if (env.CARD_API_KEY) {
      await registerIf(registry, new CardNetworkDriver({
        provider:    (env.CARD_PROVIDER ?? 'marqeta') as any,
        apiKey:      env.CARD_API_KEY,
        apiSecret:   env.CARD_API_SECRET,
        environment: prod(env) ? 'production' : 'sandbox'
      }), 'card')
    }

    // ── EVM ──────────────────────────────────────────────────────────────────
    if (env.EVM_RPC_URL) {
      await registerIf(registry, new EvmDriver({
        rpcUrl:      env.EVM_RPC_URL,
        privateKey:  env.EVM_PRIVATE_KEY ?? '',
        chainId:     parseInt(env.EVM_CHAIN_ID ?? '1'),
        environment: prod(env) ? 'production' : 'test'
      }), 'blockchain-evm')
    }

    // ── Stablecoin ───────────────────────────────────────────────────────────
    if (env.CIRCLE_API_KEY) {
      await registerIf(registry, new StablecoinDriver({
        token:       'USDC',
        provider:    'circle',
        apiKey:      env.CIRCLE_API_KEY,
        walletId:    env.CIRCLE_WALLET_ID,
        environment: prod(env) ? 'production' : 'sandbox'
      }), 'stablecoin')
    }

    // ── SWIFT ────────────────────────────────────────────────────────────────
    if (env.SWIFT_API_KEY) {
      await registerIf(registry, new SwiftDriver({
        sponsoringBankUrl: env.SWIFT_BANK_URL ?? '',
        apiKey:            env.SWIFT_API_KEY,
        bic:               env.SWIFT_BIC ?? '',
        environment:       prod(env) ? 'production' : 'test'
      }), 'swift')
    }

    // ── SEPA ─────────────────────────────────────────────────────────────────
    if (env.SEPA_API_KEY) {
      await registerIf(registry, new SepaDriver({
        sponsoringBankUrl: env.SEPA_BANK_URL ?? '',
        apiKey:            env.SEPA_API_KEY,
        sourceIban:        env.SEPA_SOURCE_IBAN ?? '',
        environment:       prod(env) ? 'production' : 'test'
      }), 'sepa')
    }

    // ── Price Oracle ──────────────────────────────────────────────────────────
    if (env.ORACLE_API_KEY || env.EVM_RPC_URL) {
      await registerIf(registry, new PriceOracleDriver({
        provider:    (env.ORACLE_PROVIDER ?? 'internal') as any,
        apiKey:      env.ORACLE_API_KEY,
        rpcUrl:      env.EVM_RPC_URL,
        environment: prod(env) ? 'production' : 'test'
      }), 'price-oracle')
    }

    log('RailDriverRegistry bootstrap complete', {
      registeredRails: registry.getRegisteredRails(),
      tigerBeetle:     registry.hasTigerBeetle()
    })

    return registry
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function registerIf(
  registry: RailDriverRegistry,
  driver:   BaseRailDriver,
  railId:   string
): Promise<void> {
  try {
    const valid = await driver.validateCredentials()
    if (valid) {
      registry.registerDriver(railId, driver)
      log(`Driver registered: ${railId}`)
    } else {
      log(`Driver credential validation failed — not registered: ${railId}`)
    }
  } catch (err) {
    log(`Driver registration error — not registered: ${railId}`, { error: (err as Error).message })
  }
}

function prod(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === 'production'
}

function log(msg: string, data?: unknown): void {
  console.log(JSON.stringify({
    level:     'info',
    component: 'RailDriverRegistry',
    message:   msg,
    data,
    timestamp: new Date().toISOString()
  }))
}
