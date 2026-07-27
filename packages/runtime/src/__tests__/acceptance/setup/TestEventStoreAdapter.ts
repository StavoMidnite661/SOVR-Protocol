/**
 * TestEventStoreAdapter — in-memory, append-only event store for the
 * Directive XXV acceptance harness.
 *
 * Surface required by AcceptanceTestHarness:
 *   append(event)
 *   getAllEvents()
 *   getEventsSince(index)
 *   getApprovalCount(aggregateId, role)
 *   getComplianceHolds(aggregateId)
 */

export type TestEvent = {
  eventId: string
  eventName: string
  aggregateId: string
  actorId: string
  payload: Record<string, unknown>
  timestamp: string
}

export class TestEventStoreAdapter {
  private events: TestEvent[] = []

  append(event: TestEvent): void {
    this.events.push(event)
  }

  getAllEvents(): TestEvent[] {
    return [...this.events]
  }

  /** Events appended after `index` — used to attach evidence to a rejection. */
  getEventsSince(index: number): TestEvent[] {
    return this.events.slice(index)
  }

  /** Current length, captured before execution to bound getEventsSince(). */
  get length(): number {
    return this.events.length
  }

  getEventsForAggregate(aggregateId: string): TestEvent[] {
    return this.events.filter((e) => e.aggregateId === aggregateId)
  }

  /**
   * APPROVAL_QUORUM gate support. Counts distinct approvers that recorded an
   * approval for this aggregate in the given role.
   */
  getApprovalCount(aggregateId: string, role?: string): number {
    const approvers = new Set<string>()
    for (const e of this.events) {
      if (e.aggregateId !== aggregateId) continue
      if (!/approv/i.test(e.eventName)) continue
      if (role) {
        const eventRole = (e.payload?.role ?? e.payload?.approver_role) as string | undefined
        if (eventRole !== role) continue
      }
      approvers.add((e.payload?.approver_id as string) ?? e.actorId)
    }
    return approvers.size
  }

  /**
   * COMPLIANCE_HOLD_ABSENT gate support. Returns active hold types for the
   * aggregate — a hold is active until a matching release event is seen.
   */
  getComplianceHolds(aggregateId: string): string[] {
    const active = new Set<string>()
    for (const e of this.events) {
      if (e.aggregateId !== aggregateId) continue
      const holdType =
        (e.payload?.hold_type as string) ?? (e.payload?.holdType as string) ?? 'GENERIC'
      if (/hold\.(placed|created|applied)|compliance\.hold/i.test(e.eventName)) {
        active.add(holdType)
      }
      if (/hold\.(released|cleared|lifted)/i.test(e.eventName)) {
        active.delete(holdType)
      }
    }
    return [...active]
  }

  reset(): void {
    this.events = []
  }
}
