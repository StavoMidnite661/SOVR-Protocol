/**
 * CapabilityBoundaryEnforcer
 *
 * Runtime enforcement of INV-004 — Agent Financial Authority Prohibition.
 *
 * Constitutional requirement:
 *   No agent (AI or autonomous) may create, grant, or modify financial authority.
 *   Only governance (human-approved) may modify capabilities.
 *
 * Called by KernelExecutor / GuardrailBus before any capability grant or modification.
 *
 * If violation:
 *   - Command rejected
 *   - INV-004 violation event emitted
 *   - Agent terminated in context (upper layers)
 */

import { CapabilityEngine } from '../server/capabilityEngine.js'
import type { EventStoreHandle } from './AuthorityBoundaryEnforcer.js'

export interface CapabilityBoundaryInput {
  actorId: string
  actorType: string
  operation: 'GRANT' | 'REVOKE' | 'MODIFY' | 'CREATE'
  targetCapability?: string
  targetActor?: string
  commandId: string
  correlationId: string
}

export interface CapabilityBoundaryResult {
  allowed: boolean
  invariant: string
  reason?: string
  failClosed: boolean
}

export class CapabilityBoundaryEnforcer {
  constructor(
    private readonly capabilityEngine: CapabilityEngine,
    private readonly eventStore: EventStoreHandle
  ) {}

  async enforce(input: CapabilityBoundaryInput): Promise<CapabilityBoundaryResult> {
    const isAgent = input.actorType === 'ai_agent' || input.actorType === 'agent'

    if (!isAgent) {
      return { allowed: true, invariant: 'INV-004', failClosed: false }
    }

    // Agents are prohibited from any authority mutation operations
    if (['GRANT', 'REVOKE', 'MODIFY', 'CREATE'].includes(input.operation)) {
      const reason = `INV-004 violation: AI agent ${input.actorId} attempted ${input.operation} on capability ${input.targetCapability ?? 'unknown'} for ${input.targetActor ?? 'self'}`

      await this.eventStore.append({
        eventName: 'constitutional.violation.inv004',
        aggregateId: input.commandId,
        actorId: input.actorId,
        payload: {
          invariant: 'INV-004',
          operation: input.operation,
          targetCapability: input.targetCapability,
          targetActor: input.targetActor,
          reason
        }
      })

      return {
        allowed: false,
        invariant: 'INV-004',
        reason,
        failClosed: true
      }
    }

    return { allowed: true, invariant: 'INV-004', failClosed: false }
  }
}
