/**
 * CapabilityRegistry (Test Shim)
 *
 * Thin wrapper expected by the Directive XXV AcceptanceTestHarness.
 * Delegates to TestCapabilityStore.
 * Matches the interface used in the spec.
 */

import { CapabilityGrant } from '../../../execution/types'
import { TestCapabilityStore } from './TestCapabilityStore'

export class CapabilityRegistry {
  constructor(
    private readonly store: TestCapabilityStore,
    private readonly ttlMs: number = 1
  ) {}

  async getActorCapabilities(actorId: string): Promise<CapabilityGrant[]> {
    return this.store.getByActor(actorId)
  }

  // Additional methods that the enforcers may call in some paths
  async listGrants(actorId: string): Promise<CapabilityGrant[]> {
    return this.store.getByActor(actorId)
  }

  // Required by AuthorityBoundaryEnforcer
  isSystemActor(actorId: string): boolean {
    return actorId.startsWith('system:') || actorId === 'system'
  }
}
