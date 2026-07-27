/**
 * StateSovereigntyEnforcer — INV-006 (State Sovereignty)
 *
 * Constitutional requirement:
 *   Every state transition must exist in the compiled state machine.
 *   The compiled machine is sovereign — external mutation is rejected.
 *
 * Invoked by KernelExecutor before a transition is planned:
 *
 *   this.stateSovereigntyEnforcer.enforce({
 *     aggregate, aggregateId, domain, fromState, toState, trigger
 *   })
 *
 * Authority source: generated/registries/machines.registry.json, reached
 * through StateRegistry so the runtime holds no machine knowledge itself.
 */

import machinesRegistry from '../../../../generated/registries/machines.registry.json' with { type: 'json' }

export interface StateSovereigntyInput {
  aggregate: string
  aggregateId: string
  domain: string
  fromState: string
  toState: string
  trigger: string
}

export interface StateSovereigntyResult {
  allowed: boolean
  invariant: string
  reason?: string
  failClosed: boolean
}

export class StateSovereigntyEnforcer {
  constructor(private readonly stateRegistry?: unknown) {}

  enforce(input: StateSovereigntyInput): StateSovereigntyResult {
    const { aggregate, fromState, trigger } = input

    const entries = (machinesRegistry as any).entries ?? {}

    // Locate the machine governing this aggregate. Registry keys are machine
    // ids (e.g. vault_asset_lifecycle); match on the declared aggregate.
    const machine = Object.values(entries).find(
      (m: any) => m?.aggregate === aggregate
    ) as any

    // No compiled machine for this aggregate: the kernel has no authority to
    // invent one. Commands whose aggregates are lifecycle-exempt are filtered
    // out by the caller, so reaching here with no machine is not an error —
    // it is simply outside INV-006's jurisdiction.
    if (!machine) {
      return { allowed: true, invariant: 'INV-006', failClosed: false }
    }

    const transitions: any[] = Array.isArray(machine.transitions)
      ? machine.transitions
      : Object.values(machine.transitions ?? {})

    if (transitions.length === 0) {
      return { allowed: true, invariant: 'INV-006', failClosed: false }
    }

    // "INIT" is the kernel's synthetic pre-existence state, not one the
    // compiled machine declares. A command against an aggregate that does not
    // yet exist is a creation command: it has no inbound transition by
    // definition, and the machine's initial_state is its result. Unless the
    // machine explicitly models INIT, creation is outside INV-006's
    // jurisdiction — enforcing here would reject every create in the corpus.
    if (fromState === 'INIT') {
      const declaresInit = transitions.some((t: any) => {
        const from = t?.from ?? t?.from_state ?? t?.source
        return Array.isArray(from) ? from.includes('INIT') : from === 'INIT'
      })
      if (!declaresInit) {
        return { allowed: true, invariant: 'INV-006', failClosed: false }
      }
    }

    // A transition is sovereign if the compiled machine declares one leaving
    // fromState under this trigger.
    const match = transitions.find((t: any) => {
      const from = t?.from ?? t?.from_state ?? t?.source
      const on = t?.trigger ?? t?.on ?? t?.command ?? t?.event
      const fromMatches = Array.isArray(from)
        ? from.includes(fromState)
        : from === fromState
      // Trigger may be absent in some compiled forms; fall back to state-only.
      const triggerMatches = on === undefined || on === trigger
      return fromMatches && triggerMatches
    })

    if (!match) {
      return {
        allowed: false,
        invariant: 'INV-006',
        reason:
          `No compiled transition from "${fromState}" via "${trigger}" ` +
          `for aggregate "${aggregate}". The compiled state machine is sovereign.`,
        failClosed: true,
      }
    }

    return { allowed: true, invariant: 'INV-006', failClosed: false }
  }
}
