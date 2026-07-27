/**
 * SagaCompensationEnforcer — INV-009 (Saga Compensation Completeness)
 *
 * Constitutional requirement:
 *   Every initiated saga must terminate in COMPLETED or FULLY_COMPENSATED.
 *   Orphaned or partially-compensated sagas are constitutionally prohibited.
 *
 * Constructed with no arguments by KernelExecutor:
 *   new SagaCompensationEnforcer()
 *
 * A registry may be supplied for durable saga state; without one the
 * enforcer tracks sagas in-process.
 */

export interface SagaEnforcementResult {
  allowed: boolean
  invariant: string
  reason?: string
  failClosed: boolean
}

export type SagaCompensationStatus =
  | 'RUNNING'
  | 'COMPENSATING'
  | 'COMPLETED'
  | 'FULLY_COMPENSATED'

export interface SagaCompensationState {
  sagaId: string
  status: SagaCompensationStatus
  compensationSteps: number
  completedCompensationSteps: number
}

export interface SagaStateRegistry {
  getSagaState(sagaId: string): Promise<SagaCompensationState | null>
}

export interface SagaEnforcementContext {
  sagaId: string
  operation: 'FORWARD' | 'COMPENSATE' | 'COMPLETE'
}

export class SagaCompensationEnforcer {
  private readonly local = new Map<string, SagaCompensationState>()

  constructor(private readonly sagaRegistry?: SagaStateRegistry) {}

  /** Register a saga as started. Used by the saga interpreter. */
  track(state: SagaCompensationState): void {
    this.local.set(state.sagaId, state)
  }

  async enforce(context: SagaEnforcementContext): Promise<SagaEnforcementResult> {
    const { sagaId, operation } = context

    const state =
      (await this.sagaRegistry?.getSagaState(sagaId)) ?? this.local.get(sagaId) ?? null

    if (!state) {
      return {
        allowed: false,
        invariant: 'INV-009',
        reason: `Saga ${sagaId} not found. Orphaned saga reference is prohibited.`,
        failClosed: true,
      }
    }

    // A saga mid-compensation may only receive compensating steps. Allowing a
    // forward step here would strand the saga in a partially-compensated state.
    if (state.status === 'COMPENSATING' && operation === 'FORWARD') {
      return {
        allowed: false,
        invariant: 'INV-009',
        reason:
          `Saga ${sagaId} is mid-compensation. Only COMPENSATE operations are permitted ` +
          'until compensation completes.',
        failClosed: true,
      }
    }

    // Compensation has run to completion but the status was never advanced to
    // FULLY_COMPENSATED — the terminal-state guarantee has been broken.
    if (
      state.status === 'COMPENSATING' &&
      state.completedCompensationSteps >= state.compensationSteps
    ) {
      return {
        allowed: false,
        invariant: 'INV-009',
        reason:
          `Saga ${sagaId} completed all ${state.compensationSteps} compensation steps ` +
          'but status was not advanced to FULLY_COMPENSATED.',
        failClosed: true,
      }
    }

    return { allowed: true, invariant: 'INV-009', failClosed: false }
  }

  /**
   * Terminal-state audit. Returns sagas that never reached a constitutional
   * terminal state — used at shutdown and by the acceptance suites.
   */
  findOrphaned(): SagaCompensationState[] {
    return [...this.local.values()].filter(
      (s) => s.status !== 'COMPLETED' && s.status !== 'FULLY_COMPENSATED'
    )
  }

  reset(): void {
    this.local.clear()
  }
}
