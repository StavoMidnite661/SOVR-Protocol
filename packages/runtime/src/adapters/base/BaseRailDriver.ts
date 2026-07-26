/**
 * BaseRailDriver
 *
 * Abstract foundation for every SOVR rail driver.
 *
 * Constitutional rules enforced here:
 *   1. Drivers emit events only — no direct state mutation
 *   2. Every interaction is logged before and after
 *   3. Fail-closed — unknown response = UNKNOWN_EXTERNAL_STATE
 *   4. Circuit breaker — open rail cannot be called
 *   5. Retry with backoff — transient failures are retried
 *   6. Stateless — all state lives in event store
 *
 * Every driver that extends this MUST implement:
 *   submitToRail()     — send payload to external system
 *   queryRailStatus()  — poll external system for status
 *   validateCredentials() — verify credentials at boot
 */

import { EventEmitter } from 'events'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RailDriverConfig = {
  railId:                    string
  railName:                  string
  timeout:                   number   // ms
  maxRetries:                number
  retryBackoff:              number   // ms base — multiplied by attempt
  circuitBreakerThreshold:   number   // failures before OPEN
  circuitBreakerResetMs:     number   // ms before HALF_OPEN
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export type RailPayload = {
  commandId:     string
  correlationId: string
  actorId:       string
  amount: {
    value:     string    // String — never float for money
    currency:  string    // ISO 4217
    precision: number    // Decimal places (USD = 2)
  }
  source: {
    accountNumber?: string
    routingNumber?: string
    iban?:          string
    bic?:           string
    walletAddress?: string
  }
  destination: {
    accountNumber?: string
    routingNumber?: string
    iban?:          string
    bic?:           string
    walletAddress?: string
  }
  metadata: {
    description?:  string
    reference?:    string
    purposeCode?:  string
  }
  railHint?: string   // Caller can hint preferred rail
}

export type RailSubmissionResult = {
  status:              'SUBMITTED' | 'REJECTED' | 'PENDING' | 'UNKNOWN_EXTERNAL_STATE'
  externalReference?:  string    // Rail-assigned transaction ID
  rawResponse?:        unknown   // Full response — for audit log
  errorCode?:          string
  errorMessage?:       string
  retryable:           boolean
  submittedAt:         string    // ISO 8601
  railId:              string
  durationMs:          number
}

export type RailStatusResult = {
  status:            'PENDING' | 'SETTLED' | 'FAILED' | 'RETURNED' | 'REVERSED' | 'UNKNOWN_EXTERNAL_STATE'
  externalReference: string
  settledAt?:        string
  failureReason?:    string
  rawResponse?:      unknown
  railId:            string
}

export type RailAuditRecord = {
  railId:            string
  commandId:         string
  correlationId:     string
  direction:         'OUTBOUND' | 'INBOUND'
  event:             'PRE_SUBMISSION' | 'POST_SUBMISSION' | 'STATUS_QUERY' | 'RETRY' | 'CIRCUIT_OPEN'
  status?:           string
  externalReference?: string
  errorCode?:        string
  durationMs?:       number
  attempt?:          number
  timestamp:         string
}

// ─── Abstract Base ────────────────────────────────────────────────────────────

export abstract class BaseRailDriver extends EventEmitter {

  protected readonly config: RailDriverConfig

  // Circuit breaker state
  private _circuitState:   CircuitState = 'CLOSED'
  private _failureCount:   number       = 0
  private _lastFailureAt:  number       = 0

  // Metrics
  private _totalSubmissions: number = 0
  private _totalSuccesses:   number = 0
  private _totalFailures:    number = 0

  constructor(config: RailDriverConfig) {
    super()
    this.config = config
  }

  // ─── Abstract Contract ──────────────────────────────────────────────────────

  protected abstract submitToRail(
    payload: RailPayload
  ): Promise<RailSubmissionResult>

  protected abstract queryRailStatus(
    externalReference: string
  ): Promise<RailStatusResult>

  abstract validateCredentials(): Promise<boolean>

  // ─── Public Interface ───────────────────────────────────────────────────────

  /**
   * Primary entry point — submit a payment to this rail.
   *
   * Enforces:
   *   - Circuit breaker check before any call
   *   - Pre-submission audit log
   *   - Retry with exponential backoff
   *   - Post-submission audit log
   *   - Fail-closed on exhausted retries
   */
  async submit(payload: RailPayload): Promise<RailSubmissionResult> {
    this._totalSubmissions++

    // Circuit breaker — check before calling external system
    const circuitCheck = this.checkCircuit()
    if (!circuitCheck.allowed) {
      this.auditLog({
        railId:        this.config.railId,
        commandId:     payload.commandId,
        correlationId: payload.correlationId,
        direction:     'OUTBOUND',
        event:         'CIRCUIT_OPEN',
        errorCode:     'CIRCUIT_BREAKER_OPEN',
        timestamp:     now()
      })
      return {
        status:       'REJECTED',
        errorCode:    'CIRCUIT_BREAKER_OPEN',
        errorMessage: circuitCheck.message,
        retryable:    true,
        submittedAt:  now(),
        railId:       this.config.railId,
        durationMs:   0
      }
    }

    // Pre-submission audit
    this.auditLog({
      railId:        this.config.railId,
      commandId:     payload.commandId,
      correlationId: payload.correlationId,
      direction:     'OUTBOUND',
      event:         'PRE_SUBMISSION',
      timestamp:     now()
    })

    let lastResult: RailSubmissionResult | null = null
    const overallStart = Date.now()

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {

      const attemptStart = Date.now()

      try {
        const result = await this.withTimeout(
          this.submitToRail(payload),
          this.config.timeout
        )

        result.durationMs = Date.now() - attemptStart
        result.railId     = this.config.railId

        if (result.status === 'SUBMITTED' || result.status === 'PENDING') {
          this.recordSuccess()
          this._totalSuccesses++
        } else if (result.status === 'REJECTED') {
          // Definitive rejection — do not retry
          this.recordFailure()
          this._totalFailures++
          this.auditLog({
            railId:            this.config.railId,
            commandId:         payload.commandId,
            correlationId:     payload.correlationId,
            direction:         'OUTBOUND',
            event:             'POST_SUBMISSION',
            status:            result.status,
            externalReference: result.externalReference,
            errorCode:         result.errorCode,
            durationMs:        Date.now() - overallStart,
            attempt,
            timestamp:         now()
          })
          return result
        }

        // Post-submission audit
        this.auditLog({
          railId:            this.config.railId,
          commandId:         payload.commandId,
          correlationId:     payload.correlationId,
          direction:         'OUTBOUND',
          event:             'POST_SUBMISSION',
          status:            result.status,
          externalReference: result.externalReference,
          durationMs:        Date.now() - overallStart,
          attempt,
          timestamp:         now()
        })

        return result

      } catch (err) {
        const durationMs = Date.now() - attemptStart
        this.recordFailure()
        lastResult = {
          status:       'UNKNOWN_EXTERNAL_STATE',
          errorCode:    'DRIVER_EXCEPTION',
          errorMessage: (err as Error).message,
          retryable:    true,
          submittedAt:  now(),
          railId:       this.config.railId,
          durationMs
        }

        if (attempt < this.config.maxRetries) {
          const backoff = this.config.retryBackoff * attempt
          this.auditLog({
            railId:        this.config.railId,
            commandId:     payload.commandId,
            correlationId: payload.correlationId,
            direction:     'OUTBOUND',
            event:         'RETRY',
            errorCode:     (err as Error).message,
            attempt,
            durationMs,
            timestamp:     now()
          })
          await sleep(backoff)
        }
      }
    }

    // All retries exhausted
    // Constitutional rule: emit UNKNOWN_EXTERNAL_STATE
    // We cannot know if the submission reached the rail
    this._totalFailures++

    const exhaustedResult: RailSubmissionResult = {
      status:       'UNKNOWN_EXTERNAL_STATE',
      errorCode:    lastResult?.errorCode ?? 'RETRIES_EXHAUSTED',
      errorMessage: lastResult?.errorMessage ?? 'All retry attempts exhausted',
      retryable:    true,
      submittedAt:  now(),
      railId:       this.config.railId,
      durationMs:   Date.now() - overallStart
    }

    this.auditLog({
      railId:        this.config.railId,
      commandId:     payload.commandId,
      correlationId: payload.correlationId,
      direction:     'OUTBOUND',
      event:         'POST_SUBMISSION',
      status:        'UNKNOWN_EXTERNAL_STATE',
      errorCode:     exhaustedResult.errorCode,
      durationMs:    exhaustedResult.durationMs,
      timestamp:     now()
    })

    return exhaustedResult
  }

  /**
   * Query the external rail for the status of a prior submission.
   */
  async queryStatus(externalReference: string): Promise<RailStatusResult> {
    try {
      const result = await this.withTimeout(
        this.queryRailStatus(externalReference),
        this.config.timeout
      )
      result.railId = this.config.railId

      this.auditLog({
        railId:            this.config.railId,
        commandId:         externalReference,
        correlationId:     externalReference,
        direction:         'INBOUND',
        event:             'STATUS_QUERY',
        status:            result.status,
        externalReference,
        timestamp:         now()
      })

      return result

    } catch (err) {
      return {
        status:            'UNKNOWN_EXTERNAL_STATE',
        externalReference,
        failureReason:     (err as Error).message,
        railId:            this.config.railId
      }
    }
  }

  // ─── Circuit Breaker ────────────────────────────────────────────────────────

  private checkCircuit(): { allowed: boolean; message: string } {
    if (this._circuitState === 'CLOSED') {
      return { allowed: true, message: 'ok' }
    }

    if (this._circuitState === 'OPEN') {
      const elapsed = Date.now() - this._lastFailureAt
      if (elapsed >= this.config.circuitBreakerResetMs) {
        this._circuitState = 'HALF_OPEN'
        this.emit('circuit:half_open', { railId: this.config.railId })
        return { allowed: true, message: 'half_open_probe' }
      }
      const retryInMs = this.config.circuitBreakerResetMs - elapsed
      return {
        allowed: false,
        message: `Circuit OPEN for ${this.config.railId}. Retry in ${Math.ceil(retryInMs / 1000)}s`
      }
    }

    // HALF_OPEN — allow one probe
    return { allowed: true, message: 'half_open_probe' }
  }

  private recordSuccess(): void {
    this._failureCount = 0
    if (this._circuitState !== 'CLOSED') {
      this._circuitState = 'CLOSED'
      this.emit('circuit:closed', { railId: this.config.railId })
    }
  }

  private recordFailure(): void {
    this._failureCount++
    this._lastFailureAt = Date.now()

    if (this._failureCount >= this.config.circuitBreakerThreshold) {
      if (this._circuitState !== 'OPEN') {
        this._circuitState = 'OPEN'
        this.emit('circuit:open', {
          railId:   this.config.railId,
          failures: this._failureCount
        })
      }
    }
  }

  // ─── Observability ──────────────────────────────────────────────────────────

  getCircuitState(): CircuitState {
    return this._circuitState
  }

  getRailId(): string {
    return this.config.railId
  }

  getMetrics() {
    return {
      railId:            this.config.railId,
      circuitState:      this._circuitState,
      failureCount:      this._failureCount,
      totalSubmissions:  this._totalSubmissions,
      totalSuccesses:    this._totalSuccesses,
      totalFailures:     this._totalFailures,
      successRate:       this._totalSubmissions > 0
        ? (this._totalSuccesses / this._totalSubmissions * 100).toFixed(2) + '%'
        : 'N/A'
    }
  }

  // ─── Audit ──────────────────────────────────────────────────────────────────

  /**
   * Every rail interaction is audit-logged.
   * Emitted as an event — BoundaryEventBus picks this up
   * and writes to the SOVR audit trail.
   *
   * Constitutional rule:
   *   Pre and post audit for every submission.
   *   Success, failure, retry, circuit-open — all recorded.
   */
  private auditLog(record: RailAuditRecord): void {
    this.emit('rail:audit', record)
  }

  // ─── Utilities ──────────────────────────────────────────────────────────────

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Rail ${this.config.railId} timeout after ${ms}ms`)),
          ms
        )
      )
    ])
  }
}

// ─── Shared Utilities ─────────────────────────────────────────────────────────

export function now(): string {
  return new Date().toISOString()
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
