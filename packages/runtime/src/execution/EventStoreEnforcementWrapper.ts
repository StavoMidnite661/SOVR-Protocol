/**
 * EventStoreEnforcementWrapper — Directive XXVII-A
 *
 * Wraps any event store with the INV-005 (audit completeness) and
 * INV-007 (ordering integrity) gates. Every append passes through both
 * enforcers; if either fires, the event is rejected and the store is
 * never written.
 *
 * Call contract (packages/runtime/src/server/index.ts):
 *   eventStore = new EventStoreEnforcementWrapper(eventStore)
 *
 * The wrapper is transparent: unknown methods and properties on the inner
 * store (migrate, getAll, stats, close, …) are forwarded unchanged, so it
 * can wrap both EventStore (JSON) and PostgreSQLEventStore without either
 * knowing it has been wrapped.
 */

import { AuditTrailEnforcer } from './AuditTrailEnforcer.js'
import { EventOrderingEnforcer } from './EventOrderingEnforcer.js'

export class ConstitutionalViolationError extends Error {
  constructor(
    public readonly invariant: string,
    public readonly reason: string
  ) {
    super(`Constitutional violation [${invariant}]: ${reason}`)
    this.name = 'ConstitutionalViolationError'
  }
}

export class EventStoreEnforcementWrapper {
  private readonly auditEnforcer: AuditTrailEnforcer
  private readonly orderingEnforcer: EventOrderingEnforcer

  constructor(
    private readonly inner: any,
    auditEnforcer?: AuditTrailEnforcer,
    orderingEnforcer?: EventOrderingEnforcer
  ) {
    this.auditEnforcer = auditEnforcer ?? new AuditTrailEnforcer()
    this.orderingEnforcer = orderingEnforcer ?? new EventOrderingEnforcer()

    // Forward any inner surface this class does not explicitly implement,
    // preserving `this` binding on the inner store.
    return new Proxy(this, {
      get(target: any, prop: string | symbol, receiver: unknown) {
        if (prop in target) return Reflect.get(target, prop, receiver)
        const value = (target.inner as any)?.[prop]
        return typeof value === 'function' ? value.bind(target.inner) : value
      },
    })
  }

  /**
   * INV-005 then INV-007, both before persistence.
   *
   * Note: the underlying EventStore.append() is synchronous and returns the
   * sealed envelope. Ordering enforcement is async, so this method is async
   * and callers that need the envelope must await it.
   */
  async append(event: any): Promise<any> {
    const auditResult = this.auditEnforcer.enforce(event)
    if (!auditResult.allowed) {
      throw new ConstitutionalViolationError(
        'INV-005',
        auditResult.reason ?? 'Audit trail incomplete'
      )
    }

    const orderResult = await this.orderingEnforcer.enforce(event)
    if (!orderResult.allowed) {
      throw new ConstitutionalViolationError(
        'INV-007',
        orderResult.reason ?? 'Event ordering violation'
      )
    }

    return this.inner.append(event)
  }

  /** Escape hatch for code that needs the unwrapped store. */
  unwrap(): any {
    return this.inner
  }
}
