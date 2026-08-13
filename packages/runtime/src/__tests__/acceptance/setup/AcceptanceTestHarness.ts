/**
 * AcceptanceTestHarness
 *
 * Uses the live kernel path only:
 *   compiled registries → CommandBus → KernelExecutor
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bootstrapSimulation, type SimulationBootstrapResult } from '../../../simulation/simulation-bootstrap.js'

const commandsRegistry = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../../../../generated/registries/commands.registry.json'), 'utf8')
)
import type { CapabilityEngine } from '../../../server/capabilityEngine.js'
import type { KernelExecutor } from '../../../execution/kernel-executor.js'
import type { StateRegistry } from '../../../execution/state-registry.js'
import { TestActorFactory, type ActorProfile, type TestActor } from './TestActorFactory.js'

export type TestCommand = {
  commandName: string
  commandId: string
  correlationId: string
  actorId: string
  actorType?: string
  aggregateId: string
  payload: Record<string, unknown>
}

export type TestResult = {
  status: 'ACCEPTED' | 'REJECTED'
  eventId?: string
  toState?: string
  rejectionCode?: string
  rejectionReason?: string
  events: any[]
}

export class AcceptanceTestHarness {
  readonly actorFactory: TestActorFactory
  private readonly kernelExecutor: KernelExecutor
  private readonly capabilityEngine: CapabilityEngine
  private readonly stateRegistry: StateRegistry
  private readonly actors = new Map<string, TestActor>()

  private constructor(boot: SimulationBootstrapResult, factory: TestActorFactory) {
    this.kernelExecutor = boot.kernelExecutor
    this.capabilityEngine = boot.capabilityEngine
    this.stateRegistry = boot.stateRegistry
    this.actorFactory = factory
  }

  static async create(): Promise<AcceptanceTestHarness> {
    const boot = await bootstrapSimulation()
    const factory = new TestActorFactory(boot.capabilityEngine)
    return new AcceptanceTestHarness(boot, factory)
  }

  async execute(cmd: TestCommand): Promise<TestResult> {
    const actor = this.actors.get(cmd.actorId)
    const actorType = cmd.actorType ?? actor?.actorType ?? 'human'
    const cmdDef = (commandsRegistry as any).entries?.[cmd.commandName] ?? {}
    const domain = cmdDef.source_domain ?? cmdDef.domain ?? cmd.commandName.split('.')[0]
    const aggregate = cmdDef.aggregate ?? cmd.commandName.split('.')[1] ?? 'command'
    const capabilityId = cmdDef.authorization_requirements?.capability
      ?? cmdDef.issuer?.minimum_capability
      ?? cmd.commandName

    try {
      const result = await this.kernelExecutor.execute({
        command_id: cmd.commandId,
        command_name: cmd.commandName,
        aggregate,
        source_domain: domain,
        payload: cmd.payload,
        identity_context: {
          identity_id: cmd.actorId,
          actor_id: cmd.actorId,
          actor_type: actorType,
          session_id: `accept-${cmd.correlationId}`,
        },
        capability_id: capabilityId,
        scope: '*',
        correlation_id: cmd.correlationId,
        causation_id: cmd.correlationId,
      })

      if (result.status === 'REJECTED') {
        return {
          status: 'REJECTED',
          rejectionCode: result.rejectionCode ?? result.violation ?? result.error_type ?? 'REJECTED',
          rejectionReason: result.rejectionReason ?? result.error,
          events: result.events ?? [],
        }
      }

      return {
        status: 'ACCEPTED',
        eventId: result.events?.[0]?.event_id,
        toState: result.transitionResult?.toState,
        events: result.events ?? [],
      }
    } catch (error: any) {
      const message = error?.message ?? String(error)
      const code = error?.name === 'InvalidStateTransitionError' ? 'INVALID_TRANSITION'
        : message.includes('INV-004') ? 'INVARIANT_VIOLATION'
        : error?.name ?? 'KERNEL_ERROR'
      return {
        status: 'REJECTED',
        rejectionCode: code,
        rejectionReason: message,
        events: [],
      }
    }
  }

  async registerActor(actor: TestActor): Promise<void> {
    this.actors.set(actor.actorId, actor)
  }

  setAggregateState(aggregateId: string, state: string, aggregate = 'escrow_account', domain = 'escrow'): void {
    void this.stateRegistry.setState(aggregate, aggregateId, state, domain)
  }
}

export { TestActorFactory }
export type { ActorProfile, TestActor }
