/**
 * BoundaryEventBus
 *
 * The constitutional bridge between rail driver events
 * and the SOVR CommandBus.
 *
 * Constitutional rule — enforced here:
 *   Drivers emit events only.
 *   Events enter SOVR through this bus.
 *   This bus translates driver events → SOVR commands.
 *   Commands route through CommandBus → KernelExecutor.
 *   KernelExecutor enforces all invariants.
 *   State mutation happens ONLY through this path.
 *
 * Flow:
 *   External rail event arrives
 *   → BoundaryEventBus receives it
 *   → Translates to SOVR command
 *   → Submits to CommandBus
 *   → KernelExecutor validates + executes
 *   → Event written to PostgreSQL
 *   → TigerBeetle balance updated (if configured)
 *
 * This is the ONLY path from external world → SOVR state.
 * There is no other path.
 * This is enforced architecturally — not by convention.
 */

import { RailDriverRegistry }     from './RailDriverRegistry'
import type { RailSubmissionResult } from './base/BaseRailDriver'
import type { RailAuditRecord }   from './base/BaseRailDriver'

// Minimal CommandBus interface — full implementation injected at runtime
export type CommandBusHandle = {
  dispatch(command: {
    commandName:   string
    commandId:     string
    correlationId: string
    actorId:       string
    aggregateId:   string
    payload:       Record<string, unknown>
  }): Promise<{
    status:  'ACCEPTED' | 'REJECTED'
    eventId?: string
    reason?:  string
  }>
}

export type BoundaryEventBusConfig = {
  systemActorId: string   // System actor for boundary-initiated commands
}

export class BoundaryEventBus {

  private readonly commandBus: CommandBusHandle
  private readonly registry:   RailDriverRegistry
  private readonly config:     BoundaryEventBusConfig

  // Audit log buffer — flushed to event store
  private readonly auditLog: RailAuditRecord[] = []

  constructor(
    commandBus: CommandBusHandle,
    registry:   RailDriverRegistry,
    config:     BoundaryEventBusConfig
  ) {
    this.commandBus = commandBus
    this.registry   = registry
    this.config     = config

    // Wire audit events from registry
    registry.on('rail:audit', (record) => {
      this.auditLog.push(record as RailAuditRecord)
    })

    // Circuit-breaker alerting is intentionally not dispatched as a command.
    // This previously dispatched 'system.rail.circuit_opened', which is not a
    // registered command — the system domain declares events only, no command
    // surface (audit finding D8). Circuit state is operational telemetry, not
    // a constitutional command; it is already surfaced through the rail audit
    // log above. If it needs to enter the event log, declare it in
    // 04_event-catalog.yaml alongside the existing system.health.* events.
  }

  // ─── Rail Submission ────────────────────────────────────────────────────────

  /**
   * Submit a payment to a specific rail.
   *
   * This is the ONLY way external value movement is initiated.
   * The result is translated into a SOVR command.
   * The SOVR command routes through CommandBus → constitutional enforcement.
   */
  async submitToRail(
    railId:  string,
    payload: Parameters<RailDriverRegistry['requireDriver']> extends [string] ? any : never
  ): Promise<RailSubmissionResult> {
    const driver = this.registry.getDriver(railId)

    if (!driver) {
      return {
        status:       'REJECTED',
        errorCode:    'RAIL_NOT_REGISTERED',
        errorMessage: `Rail '${railId}' is not registered. Available: ${this.registry.getRegisteredRails().join(', ')}`,
        retryable:    false,
        submittedAt:  new Date().toISOString(),
        railId,
        durationMs:   0
      }
    }

    const result = await driver.submit(payload)

    // Every submission result becomes a SOVR event via CommandBus
    await this.translateResultToCommand(railId, payload, result)

    return result
  }

  // ─── Result → Command Translation ──────────────────────────────────────────

  /**
   * Translate a rail result into a SOVR command.
   *
   * This is where external rail events become constitutional events.
   *
   * Rail result → SOVR command name mapping:
   *   SUBMITTED           → payment.rail.submitted
   *   REJECTED            → payment.rail.rejected
   *   UNKNOWN_EXTERNAL_STATE → payment.rail.unknown_state
   *   PENDING             → payment.rail.pending
   *
   * The command flows through CommandBus.
   * CommandBus enforces all invariants.
   * State machine validates the transition.
   * Event is written to event store.
   */
  private async translateResultToCommand(
    railId:  string,
    payload: any,
    result:  RailSubmissionResult
  ): Promise<void> {

    const commandMap: Record<RailSubmissionResult['status'], string> = {
      'SUBMITTED':             'payment.rail.submitted',
      'REJECTED':              'payment.rail.rejected',
      'PENDING':               'payment.rail.pending',
      'UNKNOWN_EXTERNAL_STATE':'payment.rail.unknown_state'
    }

    const commandName = commandMap[result.status]

    await this.commandBus.dispatch({
      commandName,
      commandId:     `boundary:${payload.commandId}:${result.status}`,
      correlationId: payload.correlationId,
      actorId:       this.config.systemActorId,
      aggregateId:   `payment:${payload.commandId}`,
      payload: {
        originalCommandId: payload.commandId,
        railId,
        status:            result.status,
        externalReference: result.externalReference,
        errorCode:         result.errorCode,
        errorMessage:      result.errorMessage,
        retryable:         result.retryable,
        submittedAt:       result.submittedAt,
        durationMs:        result.durationMs
      }
    })
  }

  // ─── Inbound Rail Events ────────────────────────────────────────────────────

  /**
   * Handle inbound events FROM the rail (webhooks, polling).
   *
   * Example:
   *   ACH return received → payment.rail.returned command
   *   FedNow confirmation → payment.rail.settled command
   *   Wire rejected       → payment.rail.rejected command
   *
   * Every inbound event follows the same path:
   *   webhook/poll → BoundaryEventBus → CommandBus → KernelExecutor
   */
  async onInboundRailEvent(event: {
    railId:            string
    eventType:         string
    externalReference: string
    correlationId:     string
    rawPayload:        unknown
  }): Promise<void> {

    const commandMap: Record<string, string> = {
      'settlement':   'payment.rail.settled',
      'return':       'payment.rail.returned',
      'reversal':     'payment.rail.reversed',
      'confirmation': 'payment.rail.confirmed',
      'rejection':    'payment.rail.rejected',
      'noc':          'payment.rail.noc_received'   // ACH Notification of Change
    }

    const commandName = commandMap[event.eventType] ?? 'payment.rail.status_update'

    await this.commandBus.dispatch({
      commandName,
      commandId:     `inbound:${event.railId}:${event.externalReference}`,
      correlationId: event.correlationId,
      actorId:       this.config.systemActorId,
      aggregateId:   `payment:${event.externalReference}`,
      payload: {
        railId:            event.railId,
        externalReference: event.externalReference,
        eventType:         event.eventType,
        rawPayload:        event.rawPayload
      }
    })
  }


  // ─── Audit ──────────────────────────────────────────────────────────────────

  getAuditLog(): RailAuditRecord[] {
    return [...this.auditLog]
  }

  clearAuditLog(): void {
    this.auditLog.length = 0
  }
}
