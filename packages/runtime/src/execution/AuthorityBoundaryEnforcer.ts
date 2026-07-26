/**
 * AuthorityBoundaryEnforcer
 *
 * Runtime enforcement of INV-003 — Authority Boundary.
 *
 * Constitutional requirement:
 *   No actor may exercise authority outside explicitly granted capabilities.
 *   Authority does not flow upward.
 *   Authority does not transfer laterally without explicit grant.
 *   Authority cannot be self-escalated.
 *
 * Called by KernelExecutor on EVERY command, BEFORE state machine.
 *
 * If check fails:
 *   - Command is REJECTED immediately
 *   - Rejection event is written to event store
 *   - State machine never executes
 *   - No state mutation occurs
 *
 * This is the primary defense against privilege escalation.
 *
 * System actors (identified by SYSTEM_ACTOR_IDs) bypass capability
 * checks for internal commands only. External-origin commands
 * always require explicit capability.
 */

import {
  AuthorityCheckInput,
  AuthorityCheckResult,
  AuthorityViolationType,
  CapabilityGrant,
  AuthorityViolationEventPayload
} from './types'

export interface CapabilityRegistryHandle {
  getActorCapabilities(actorId: string): Promise<CapabilityGrant[]>
  isSystemActor(actorId: string): boolean
}

export interface EventStoreHandle {
  append(event: {
    eventName:   string
    aggregateId: string
    actorId:     string
    payload:     Record<string, unknown>
    timestamp?:  string
  }): Promise<{ eventId: string }>
}

export class AuthorityBoundaryEnforcer {

  private readonly systemActorIds: Set<string>

  private readonly capabilityExemptCommands: Set<string> = new Set([
    'system.health.check',
    'system.boot.attest',
    'system.runlevel.advance'
  ])

  constructor(
    private readonly capabilityRegistry: CapabilityRegistryHandle,
    private readonly eventStore:         EventStoreHandle,
    systemActorIds:                      string[] = []
  ) {
    this.systemActorIds = new Set(systemActorIds)
  }

  async check(input: AuthorityCheckInput): Promise<AuthorityCheckResult> {

    if (this.capabilityExemptCommands.has(input.commandName)) {
      return { granted: true }
    }

    if (this.capabilityRegistry.isSystemActor(input.actorId)) {
      if (this.isInternalSystemCommand(input.commandName)) {
        return { granted: true }
      }
    }

    const grants = await this.capabilityRegistry.getActorCapabilities(
      input.actorId
    )

    const matchResult = this.findMatchingGrant(
      grants,
      input.requiredCapability,
      input.aggregateId
    )

    if (!matchResult.found) {
      return this.deny(input, matchResult.violation!, matchResult.reason!)
    }

    const grant = matchResult.grant!

    if (this.isExpired(grant)) {
      return this.deny(
        input,
        'CAPABILITY_EXPIRED',
        `Capability '${grant.capability}' expired at ${new Date(grant.expiresAt!).toISOString()}`
      )
    }

    if (this.isRevoked(grant)) {
      return this.deny(
        input,
        'CAPABILITY_REVOKED',
        `Capability '${grant.capability}' has been revoked`
      )
    }

    if (grant.constraints) {
      const constraintResult = this.checkConstraints(
        grant,
        input.payload
      )
      if (!constraintResult.satisfied) {
        return this.deny(
          input,
          constraintResult.violation!,
          constraintResult.reason!
        )
      }
    }

    return {
      granted: true,
      grantId: grant.grantId
    }
  }

  private findMatchingGrant(
    grants:             CapabilityGrant[],
    requiredCapability: string,
    aggregateId:        string
  ): {
    found:     boolean
    grant?:    CapabilityGrant
    violation?: AuthorityViolationType
    reason?:   string
  } {

    const capabilityGrants = grants.filter(
      g => g.capability === requiredCapability
    )

    if (capabilityGrants.length === 0) {
      return {
        found:     false,
        violation: 'CAPABILITY_NOT_HELD',
        reason:    `Actor does not hold capability '${requiredCapability}'`
      }
    }

    const scopedGrant = capabilityGrants.find(
      g => g.scope === '*' || g.scope === aggregateId
    )

    if (!scopedGrant) {
      return {
        found:     false,
        violation: 'SCOPE_MISMATCH',
        reason:    `Capability '${requiredCapability}' not granted for aggregate '${aggregateId}'`
      }
    }

    return { found: true, grant: scopedGrant }
  }

  private isExpired(grant: CapabilityGrant): boolean {
    if (!grant.expiresAt) return false
    return Date.now() > grant.expiresAt
  }

  private isRevoked(grant: CapabilityGrant): boolean {
    return grant.revokedAt !== undefined && grant.revokedAt !== null
  }

  private checkConstraints(
    grant:   CapabilityGrant,
    payload: Record<string, unknown>
  ): {
    satisfied:  boolean
    violation?: AuthorityViolationType
    reason?:    string
  } {

    const c = grant.constraints!

    if (c.maxAmount !== undefined) {
      const payloadAmount = this.extractAmount(payload)
      if (payloadAmount !== null) {
        if (BigInt(payloadAmount) > BigInt(c.maxAmount)) {
          return {
            satisfied: false,
            violation: 'CONSTRAINT_AMOUNT_EXCEEDED',
            reason:    `Amount ${payloadAmount} exceeds grant limit ${c.maxAmount}`
          }
        }
      }
    }

    if (c.allowedTimeWindow) {
      if (!this.isWithinTimeWindow(c.allowedTimeWindow)) {
        return {
          satisfied: false,
          violation: 'CONSTRAINT_TIME_WINDOW',
          reason:    `Command not allowed outside time window`
        }
      }
    }

    if (c.allowedDomains && c.allowedDomains.length > 0) {
      const commandDomain = this.extractDomain(payload)
      if (commandDomain && !c.allowedDomains.includes(commandDomain)) {
        return {
          satisfied: false,
          violation: 'CONSTRAINT_DOMAIN',
          reason:    `Domain '${commandDomain}' not in allowed domains`
        }
      }
    }

    return { satisfied: true }
  }

  private extractAmount(payload: Record<string, unknown>): string | null {
    const candidates = ['amount', 'transferAmount', 'paymentAmount', 'value']
    for (const key of candidates) {
      if (payload[key] !== undefined) {
        const val = payload[key]
        if (typeof val === 'string' || typeof val === 'number') {
          return String(val)
        }
        if (typeof val === 'object' && val !== null && 'value' in val) {
          return String((val as any).value)
        }
      }
    }
    return null
  }

  private extractDomain(payload: Record<string, unknown>): string | null {
    if (typeof payload.domain === 'string') return payload.domain
    return null
  }

  private isWithinTimeWindow(window: NonNullable<CapabilityGrant['constraints']>['allowedTimeWindow']): boolean {
    if (!window) return true
    const now = new Date(
      new Date().toLocaleString('en-US', { timeZone: window.timezone })
    )
    const day  = now.getDay()
    const hour = now.getHours()

    if (!window.daysOfWeek.includes(day)) return false
    if (hour < window.startHour || hour >= window.endHour) return false
    return true
  }

  private async deny(
    input:     AuthorityCheckInput,
    violation: AuthorityViolationType,
    reason:    string
  ): Promise<AuthorityCheckResult> {

    const eventPayload: AuthorityViolationEventPayload = {
      commandName:        input.commandName,
      commandId:          input.commandId,
      actorId:            input.actorId,
      aggregateId:        input.aggregateId,
      requiredCapability: input.requiredCapability,
      violation,
      reason
    }

    try {
      await this.eventStore.append({
        eventName:   'command.rejected.authority_boundary_violation',
        aggregateId: input.aggregateId,
        actorId:     input.actorId,
        payload:     eventPayload as unknown as Record<string, unknown>
      })
    } catch (err) {
      console.error(JSON.stringify({
        level:     'error',
        event:     'audit_write_failed_on_denial',
        commandId: input.commandId,
        error:     (err as Error).message
      }))
    }

    return { granted: false, violation, reason }
  }

  private isInternalSystemCommand(commandName: string): boolean {
    const internalPrefixes = [
      'system.',
      'kernel.',
      'boundary.'
    ]
    return internalPrefixes.some(p => commandName.startsWith(p))
  }
}
