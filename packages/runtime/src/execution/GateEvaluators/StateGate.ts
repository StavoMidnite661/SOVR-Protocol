/**
 * StateGate
 *
 * Gate type: STATE_PRECONDITION
 *
 * Checks that the target aggregate is in one of
 * the required states before the command executes.
 *
 * This is NOT the same as the state machine guard.
 * The state machine guard checks if a transition is valid.
 * The state gate checks if the aggregate meets a compound precondition.
 *
 * Example:
 *   escrow.account.release requires aggregate in FUNDED state.
 *   The state machine may allow the transition.
 *   But the gate verifies the state independently from the
 *   current projection — defense in depth.
 */

import { GateEvaluator, GateType, StateGateConfig, GateConfig } from '../types'

export interface AggregateStateHandle {
  getCurrentState(aggregateId: string): Promise<string | null>
}

export class StateGate implements GateEvaluator {

  readonly type: GateType = 'STATE_PRECONDITION'

  constructor(private readonly aggregateStore: AggregateStateHandle) {}

  async evaluate(
    aggregateId: string,
    _actorId:    string,
    _payload:    Record<string, unknown>,
    config:      GateConfig
  ): Promise<{ passed: boolean; reason?: string }> {

    const cfg = config as StateGateConfig

    const currentState = await this.aggregateStore.getCurrentState(aggregateId)

    if (!currentState) {
      return {
        passed: false,
        reason: `Aggregate '${aggregateId}' not found or has no state`
      }
    }

    if (!cfg.requiredStates.includes(currentState)) {
      return {
        passed: false,
        reason: `Aggregate is in state '${currentState}', required one of: [${cfg.requiredStates.join(', ')}]`
      }
    }

    return { passed: true }
  }
}
