/**
 * TestCapabilityStore — in-memory, PostgreSQL-compatible capability store.
 *
 * Surface required by AcceptanceTestHarness / CapabilityRegistry:
 *   addGrant(grant)
 *   getByActor(actorId)
 *   revokeGrant(grantId)
 *   rebuildFromEvents(events)   ← AUDIT-005: survives simulated restart
 */

import type { CapabilityGrant } from '../../../execution/types'

export class TestCapabilityStore {
  private grants = new Map<string, CapabilityGrant>()

  async addGrant(grant: CapabilityGrant): Promise<void> {
    this.grants.set(grant.grantId, { ...grant })
  }

  /** Active (non-revoked, non-expired) grants held by an actor. */
  async getByActor(actorId: string): Promise<CapabilityGrant[]> {
    const now = Date.now()
    return [...this.grants.values()].filter(
      (g) =>
        g.actorId === actorId &&
        g.revokedAt === undefined &&
        (g.expiresAt === undefined || g.expiresAt > now)
    )
  }

  async getAll(): Promise<CapabilityGrant[]> {
    return [...this.grants.values()]
  }

  /** Soft revoke — the grant is retained with a revocation timestamp. */
  async revokeGrant(grantId: string): Promise<void> {
    const grant = this.grants.get(grantId)
    if (grant) {
      grant.revokedAt = Date.now()
    }
  }

  /**
   * Rebuild grant state from the event log after a simulated restart.
   * Capability state must be reconstructible from events alone — this is
   * what AUDIT-005 verifies.
   */
  async rebuildFromEvents(events: Array<{ eventName: string; payload: Record<string, unknown> }>): Promise<void> {
    this.grants.clear()

    for (const event of events) {
      if (/capability\.grant\.(issued|created|granted)/i.test(event.eventName)) {
        const p = event.payload as any
        const grantId = (p.grantId ?? p.grant_id) as string | undefined
        if (!grantId) continue
        this.grants.set(grantId, {
          grantId,
          actorId: (p.actorId ?? p.actor_id) as string,
          capability: (p.capability ?? p.capability_id) as string,
          scope: (p.scope as string) ?? '*',
          grantedBy: (p.grantedBy ?? p.granted_by ?? 'system') as string,
          grantedAt: (p.grantedAt ?? p.granted_at ?? Date.now()) as number,
          expiresAt: (p.expiresAt ?? p.expires_at) as number | undefined,
          constraints: p.constraints,
        })
      }

      if (/capability\.grant\.revoked/i.test(event.eventName)) {
        const p = event.payload as any
        const grantId = (p.grantId ?? p.grant_id) as string | undefined
        const grant = grantId ? this.grants.get(grantId) : undefined
        if (grant) grant.revokedAt = (p.revokedAt ?? p.revoked_at ?? Date.now()) as number
      }
    }
  }

  reset(): void {
    this.grants.clear()
  }
}
