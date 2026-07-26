/**
 * ExecutionGateEnforcer
 *
 * Runtime enforcement of INV-008 — Command Execution Gates.
 *
 * Constitutional requirement:
 *   Commands may execute only when all declared gates are satisfied.
 *   Gates are declared in YAML only.
 *   Gate evaluation is deterministic.
 *   Unknown gate type → fail closed.
 *   All gates must pass — one failure blocks execution.
 *
 * Called by KernelExecutor AFTER INV-003 check, BEFORE state machine.
 *
 * If any gate fails:
 *   - Command is REJECTED
 *   - Rejection event written with full gate evaluation context
 *   - State machine never executes
 *   - No state mutation occurs
 *
 * Gate evaluation is ordered:
 *   Gates are evaluated in declaration order.
 *   First failure terminates the chain.
 *   This is intentional — cheapest gates should be declared first.
 *
 * Advisory gates (fatal: false):
 *   These emit a warning event but do not block execution.
 *   Used for soft limits and compliance recommendations.
 *   Fatal gates (fatal: true) are the enforcement mechanism.
 */

import {
  GateCheckInput,
  GateCheckResult,
  GateDefinition,
  GateEvaluationRecord,
  GateEvaluator,
  GateType,
  GateFailedEventPayload
} from './types'

export interface GateEventStoreHandle {
  append(event: {
    eventName:   string
    aggregateId: string
    actorId:     string
    payload:     Record<string, unknown>
  }): Promise<{ eventId: string }>
}

export class ExecutionGateEnforcer {

  private readonly evaluators: Map<GateType, GateEvaluator>

  constructor(
    evaluators: GateEvaluator[],
    private readonly eventStore: GateEventStoreHandle
  ) {
    this.evaluators = new Map(
      evaluators.map(e => [e.type, e])
    )
  }

  async check(input: GateCheckInput): Promise<GateCheckResult> {

    if (input.gates.length === 0) {
      return { passed: true, evaluated: [] }
    }

    const evaluated: GateEvaluationRecord[] = []
    let firstFatalFailure: { gateId: string; gateType: GateType; reason: string } | null = null

    for (const gate of input.gates) {

      const start = Date.now()

      const evaluator = this.evaluators.get(gate.type)
      if (!evaluator) {
        const record: GateEvaluationRecord = {
          gateId:     gate.gateId,
          gateType:   gate.type,
          passed:     false,
          reason:     `Unknown gate type '${gate.type}' — fail closed`,
          durationMs: Date.now() - start
        }
        evaluated.push(record)

        if (gate.fatal) {
          firstFatalFailure = {
            gateId:   gate.gateId,
            gateType: gate.type,
            reason:   record.reason!
          }
          break
        }
        continue
      }

      let evalResult: { passed: boolean; reason?: string }

      try {
        evalResult = await evaluator.evaluate(
          input.aggregateId,
          input.actorId,
          input.payload,
          gate.config
        )
      } catch (err) {
        evalResult = {
          passed: false,
          reason: `Gate evaluator error: ${(err as Error).message}`
        }
      }

      const record: GateEvaluationRecord = {
        gateId:     gate.gateId,
        gateType:   gate.type,
        passed:     evalResult.passed,
        reason:     evalResult.reason,
        durationMs: Date.now() - start
      }
      evaluated.push(record)

      if (!evalResult.passed) {
        if (gate.fatal) {
          firstFatalFailure = {
            gateId:   gate.gateId,
            gateType: gate.type,
            reason:   evalResult.reason ?? 'Gate condition not satisfied'
          }
          break
        } else {
          await this.emitAdvisoryEvent(input, gate, evalResult.reason ?? 'Advisory gate failed')
        }
      }
    }

    if (firstFatalFailure) {
      await this.emitRejectionEvent(input, firstFatalFailure, evaluated)

      return {
        passed:      false,
        failedGate:  firstFatalFailure.gateId,
        failedType:  firstFatalFailure.gateType,
        reason:      firstFatalFailure.reason,
        evaluated
      }
    }

    return { passed: true, evaluated }
  }

  private async emitRejectionEvent(
    input:   GateCheckInput,
    failure: { gateId: string; gateType: GateType; reason: string },
    evaluated: GateEvaluationRecord[]
  ): Promise<void> {

    const payload: GateFailedEventPayload = {
      commandName:   input.commandName,
      commandId:     input.commandId,
      actorId:       input.actorId,
      aggregateId:   input.aggregateId,
      gateId:        failure.gateId,
      gateType:      failure.gateType,
      reason:        failure.reason,
      evaluated
    }

    try {
      await this.eventStore.append({
        eventName:   'command.rejected.execution_gate_failed',
        aggregateId: input.aggregateId,
        actorId:     input.actorId,
        payload:     payload as unknown as Record<string, unknown>
      })
    } catch (err) {
      console.error(JSON.stringify({
        level:     'error',
        event:     'audit_write_failed_on_gate_failure',
        commandId: input.commandId,
        error:     (err as Error).message
      }))
    }
  }

  private async emitAdvisoryEvent(
    input:  GateCheckInput,
    gate:   GateDefinition,
    reason: string
  ): Promise<void> {
    try {
      await this.eventStore.append({
        eventName:   'command.advisory.gate_warning',
        aggregateId: input.aggregateId,
        actorId:     input.actorId,
        payload: {
          commandName: input.commandName,
          commandId:   input.commandId,
          gateId:      gate.gateId,
          gateType:    gate.type,
          description: gate.description,
          reason
        }
      })
    } catch {
      // Advisory write failure is non-fatal
    }
  }

  getRegisteredGateTypes(): GateType[] {
    return [...this.evaluators.keys()]
  }

  hasEvaluator(gateType: GateType): boolean {
    return this.evaluators.has(gateType)
  }
}
