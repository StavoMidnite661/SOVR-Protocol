/**
 * TestActorFactory — grants compiled capabilities through CapabilityEngine.
 */
import type { CapabilityEngine } from '../../../server/capabilityEngine.js'

export type ActorProfile = 'ADMIN' | 'ATTACKER' | 'OPERATOR' | 'READONLY' | 'SYSTEM'

export interface TestActor {
  actorId: string
  actorType: string
  profile: ActorProfile
  capabilities: string[]
}

const PROFILE_CAPABILITIES: Record<ActorProfile, string[]> = {
  ADMIN: [
    'governance.capability.grant',
    'ledger.account.create',
    'ledger.entry.post',
    'vault.asset.create',
    'treasury.transfer.request',
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

  constructor(private readonly capabilityEngine: CapabilityEngine) {}

  async create(profile: ActorProfile = 'OPERATOR'): Promise<TestActor> {
    const actorId = `${profile.toLowerCase()}-${++this.counter}`
    const capabilities = PROFILE_CAPABILITIES[profile] ?? []
    const actorType = profile === 'ATTACKER' ? 'ai_agent' : profile === 'ADMIN' ? 'governance' : profile === 'SYSTEM' ? 'system' : 'human'

    for (const capability of capabilities) {
      await this.capabilityEngine.grant({
        capability_id: capability,
        actor_id: actorId,
        scope_pattern: '*',
        granted_by: 'system:test',
      })
    }

    return { actorId, actorType, profile, capabilities }
  }

  reset(): void {
    this.counter = 0
  }
}
