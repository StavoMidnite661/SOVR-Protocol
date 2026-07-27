/**
 * TestActorFactory — creates test actors with capability profiles.
 *
 * Instance-based; constructed by AcceptanceTestHarness as:
 *   new TestActorFactory(capStore, eventStore)
 *
 * Called as:
 *   await harness.actorFactory.create('ADMIN')
 *   await harness.actorFactory.create('ATTACKER')
 *
 * Grants are written through the capability store AND emitted as events, so
 * that a simulated restart can rebuild them from the log (AUDIT-005).
 */

import type { CapabilityGrant } from '../../../execution/types'
import type { TestCapabilityStore } from './TestCapabilityStore'
import type { TestEventStoreAdapter } from './TestEventStoreAdapter'

export type ActorProfile = 'ADMIN' | 'ATTACKER' | 'OPERATOR' | 'READONLY' | 'SYSTEM'

export interface TestActor {
  actorId: string
  actorType: string
  profile: ActorProfile
  capabilities: string[]
}

/**
 * Capability sets per profile.
 *
 * ATTACKER is deliberately given no capabilities: the INV-003/INV-004 suites
 * assert that an unauthorized actor is rejected fail-closed. Its actorId also
 * contains "attacker", which the harness treats as an agent-class actor for
 * INV-004 agent-prohibition checks.
 */
const PROFILE_CAPABILITIES: Record<ActorProfile, string[]> = {
  ADMIN: [
    'governance.capability.grant',
    'ledger.account.open',
    'ledger.entry.post',
    'vault.asset.create',
    'treasury.transfer.request',
    // Escrow lifecycle — INV006 exercises a sovereignty rejection via
    // escrow.account.release, which must clear the authority gate first so
    // the state-machine check is what actually rejects it.
    'escrow.account.create',
    'escrow.account.fund',
    'escrow.account.release',
  ],
  OPERATOR: ['ledger.entry.post', 'vault.asset.create'],
  READONLY: ['ledger.account.read'],
  SYSTEM: ['system.internal'],
  ATTACKER: [],
}

export class TestActorFactory {
  private counter = 0

  constructor(
    private readonly capStore: TestCapabilityStore,
    private readonly eventStore: TestEventStoreAdapter
  ) {}

  async create(profile: ActorProfile = 'OPERATOR'): Promise<TestActor> {
    const actorId = `${profile.toLowerCase()}-${++this.counter}`
    const capabilities = PROFILE_CAPABILITIES[profile] ?? []

    for (const capability of capabilities) {
      const grantId = `grant-${actorId}-${capability}`
      const grant: CapabilityGrant = {
        grantId,
        actorId,
        capability,
        scope: '*',
        grantedBy: 'system:test',
        grantedAt: Date.now(),
      }
      await this.capStore.addGrant(grant)

      this.eventStore.append({
        eventId: `grant-evt-${grantId}`,
        eventName: 'capability.grant.issued',
        aggregateId: grantId,
        actorId: 'system:test',
        payload: {
          grantId,
          actorId,
          capability,
          scope: '*',
          grantedBy: 'system:test',
          grantedAt: grant.grantedAt,
          audit: { constitutional_rules_referenced: ['INV-004'] },
        },
        timestamp: new Date().toISOString(),
      })
    }

    return {
      actorId,
      actorType: profile === 'ATTACKER' ? 'ai_agent' : 'human',
      profile,
      capabilities,
    }
  }

  reset(): void {
    this.counter = 0
  }
}
