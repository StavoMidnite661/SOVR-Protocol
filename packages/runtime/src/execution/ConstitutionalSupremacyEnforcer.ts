/**
 * ConstitutionalSupremacyEnforcer — INV-010 (Constitutional Supremacy)
 *
 * Constitutional requirement:
 *   No command, event, or capability may exist at runtime that is not
 *   present in the compiled constitutional corpus. This is the final gate.
 *
 * Constructed with no arguments by KernelExecutor:
 *   new ConstitutionalSupremacyEnforcer()
 *
 * Authority is read directly from the compiled registries, so the kernel
 * carries no hardcoded command, event, or capability knowledge. An
 * alternate registry may be injected for testing.
 */

import commandsRegistry from '../../../../generated/registries/commands.registry.json' with { type: 'json' }
import eventsRegistry from '../../../../generated/registries/events.registry.json' with { type: 'json' }
import capabilitiesRegistry from '../../../../generated/registries/capabilities.registry.json' with { type: 'json' }

export interface SupremacyEnforcementResult {
  allowed: boolean
  invariant: string
  reason?: string
  failClosed: boolean
}

export interface ConstitutionalRegistry {
  isCommandRegistered(commandType: string): boolean
  isEventRegistered(eventType: string): boolean
  isCapabilityRegistered(capabilityId: string): boolean
}

/** Default registry backed by the compiled corpus. */
class CompiledCorpusRegistry implements ConstitutionalRegistry {
  private readonly commands = new Set(
    Object.keys((commandsRegistry as any).entries ?? {})
  )
  private readonly events = new Set(
    Object.keys((eventsRegistry as any).entries ?? {})
  )
  private readonly capabilities = new Set(
    Object.keys((capabilitiesRegistry as any).entries ?? {})
  )

  isCommandRegistered(commandType: string): boolean {
    return this.commands.has(commandType)
  }

  isEventRegistered(eventType: string): boolean {
    return this.events.has(eventType)
  }

  isCapabilityRegistered(capabilityId: string): boolean {
    return this.capabilities.has(capabilityId)
  }
}

export class ConstitutionalSupremacyEnforcer {
  private readonly registry: ConstitutionalRegistry

  constructor(registry?: ConstitutionalRegistry) {
    this.registry = registry ?? new CompiledCorpusRegistry()
  }

  enforceCommand(commandType: string): SupremacyEnforcementResult {
    if (!this.registry.isCommandRegistered(commandType)) {
      return {
        allowed: false,
        invariant: 'INV-010',
        reason:
          `Command "${commandType}" is not in the constitutional corpus. ` +
          'Runtime behavior outside the constitution is prohibited.',
        failClosed: true,
      }
    }
    return { allowed: true, invariant: 'INV-010', failClosed: false }
  }

  enforceEvent(eventType: string): SupremacyEnforcementResult {
    if (!this.registry.isEventRegistered(eventType)) {
      return {
        allowed: false,
        invariant: 'INV-010',
        reason: `Event "${eventType}" is not in the constitutional corpus.`,
        failClosed: true,
      }
    }
    return { allowed: true, invariant: 'INV-010', failClosed: false }
  }

  enforceCapability(capabilityId: string): SupremacyEnforcementResult {
    if (!this.registry.isCapabilityRegistered(capabilityId)) {
      return {
        allowed: false,
        invariant: 'INV-010',
        reason: `Capability "${capabilityId}" is not in the constitutional corpus.`,
        failClosed: true,
      }
    }
    return { allowed: true, invariant: 'INV-010', failClosed: false }
  }
}
