/**
 * SovrLedgerDriver
 *
 * The native SOVR execution path.
 *
 * This driver routes transfers through the SOVR constitutional kernel
 * directly — no external network call.
 *
 * It is the reference implementation for what all drivers aspire to:
 *   - Deterministic
 *   - Constitutional
 *   - Tamper-evident
 *   - Fail-closed
 *   - Zero external dependency
 *
 * When TigerBeetle is configured:
 *   Financial state recorded in TigerBeetle (balances)
 *   AND PostgreSQL event store (audit history)
 *
 * When TigerBeetle is not configured:
 *   Financial state from PostgreSQL event store projections only
 */

import {
  BaseRailDriver,
  RailPayload,
  RailSubmissionResult,
  RailStatusResult,
  now
} from '../base/BaseRailDriver'

// Minimal interface — full KernelExecutor is injected at runtime
export type KernelExecutorHandle = {
  execute(command: {
    commandName:   string
    commandId:     string
    correlationId: string
    actorId:       string
    aggregateId:   string
    payload:       Record<string, unknown>
  }): Promise<{
    status:         'ACCEPTED' | 'REJECTED'
    eventId?:       string
    toState?:       string
    rejectionCode?: string
    rejectionReason?: string
  }>
  healthCheck(): Promise<{ status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' }>
}

export type EventStoreHandle = {
  findById(eventId: string): Promise<{
    id:        string
    toState:   string
    timestamp: string
  } | null>
}

export class SovrLedgerDriver extends BaseRailDriver {

  constructor(
    private readonly kernel:     KernelExecutorHandle,
    private readonly eventStore: EventStoreHandle
  ) {
    super({
      railId:                  'sovr-private-ledger',
      railName:                'SOVR Constitutional Private Ledger',
      timeout:                 5_000,   // Local — should be < 100ms
      maxRetries:              1,       // Local — no network retry needed
      retryBackoff:            0,
      circuitBreakerThreshold: 10,
      circuitBreakerResetMs:   30_000
    })
  }

  /**
   * Submit a transfer through the SOVR constitutional kernel.
   *
   * Flow:
   *   RailPayload → SOVR command envelope
   *   → KernelExecutor.execute()
   *   → StateMachine validates
   *   → GuardrailBus enforces INV-002
   *   → TigerBeetle records balance change
   *   → PostgreSQL appends immutable event
   *   → Result returned
   */
  protected async submitToRail(
    payload: RailPayload
  ): Promise<RailSubmissionResult> {

    const command = this.buildCommand(payload)

    const result = await this.kernel.execute(command)

    if (result.status === 'ACCEPTED') {
      return {
        status:             'SUBMITTED',
        externalReference:  result.eventId,
        rawResponse:        result,
        retryable:          false,
        submittedAt:        now(),
        railId:             this.config.railId,
        durationMs:         0   // Set by BaseRailDriver
      }
    }

    if (result.status === 'REJECTED') {
      return {
        status:       'REJECTED',
        rawResponse:  result,
        errorCode:    result.rejectionCode,
        errorMessage: result.rejectionReason,
        retryable:    false,
        submittedAt:  now(),
        railId:       this.config.railId,
        durationMs:   0
      }
    }

    // Unexpected kernel response — fail closed
    return {
      status:       'UNKNOWN_EXTERNAL_STATE',
      rawResponse:  result,
      retryable:    true,
      submittedAt:  now(),
      railId:       this.config.railId,
      durationMs:   0
    }
  }

  /**
   * Query status from the event store.
   * Source of truth: PostgreSQL event log.
   * Not a network call — direct read.
   */
  protected async queryRailStatus(
    externalReference: string
  ): Promise<RailStatusResult> {

    const event = await this.eventStore.findById(externalReference)

    if (!event) {
      return {
        status:            'UNKNOWN_EXTERNAL_STATE',
        externalReference,
        failureReason:     'Event not found in store',
        railId:            this.config.railId
      }
    }

    const stateMap: Record<string, RailStatusResult['status']> = {
      'SETTLED':   'SETTLED',
      'COMPLETED': 'SETTLED',
      'RELEASED':  'SETTLED',
      'FUNDED':    'PENDING',
      'PENDING':   'PENDING',
      'CREATED':   'PENDING',
      'FAILED':    'FAILED',
      'REJECTED':  'FAILED',
      'REVERSED':  'REVERSED'
    }

    return {
      status:            stateMap[event.toState] ?? 'UNKNOWN_EXTERNAL_STATE',
      externalReference,
      settledAt:         event.timestamp,
      rawResponse:       event,
      railId:            this.config.railId
    }
  }

  async validateCredentials(): Promise<boolean> {
    const health = await this.kernel.healthCheck()
    return health.status === 'HEALTHY' || health.status === 'DEGRADED'
  }

  /**
   * Translate generic RailPayload → SOVR command envelope.
   *
   * The command name is the primary routing key.
   * KernelExecutor routes by command name to the correct
   * state machine and handler — all from the registry.
   */
  private buildCommand(payload: RailPayload) {
    return {
      // 'treasury.transfer.request' is the registered lifecycle entry point in
      // 03_command-catalog.yaml. This previously read 'treasury.transfer.initiate',
      // which is not a registered command — kernel-executor throws
      // UNKNOWN_COMMAND for unregistered names, so every private-ledger
      // submission would have failed at runtime (audit finding D8).
      commandName:   'treasury.transfer.request',
      commandId:     payload.commandId,
      correlationId: payload.correlationId,
      actorId:       payload.actorId,
      aggregateId:   `transfer:${payload.commandId}`,
      payload: {
        amount:      payload.amount,
        source:      payload.source,
        destination: payload.destination,
        rail:        'sovr-private-ledger',
        metadata:    payload.metadata
      }
    }
  }
}
