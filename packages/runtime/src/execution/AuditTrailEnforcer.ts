/**
 * AuditTrailEnforcer — INV-005 (Audit Trail Completeness)
 *
 * Constitutional requirement:
 *   Every event emission must carry a complete audit envelope.
 *   Missing audit fields = event rejected BEFORE the store write.
 *
 * This is a proactive gate, not an observer. It is invoked by
 * EventStoreEnforcementWrapper.append() ahead of any persistence,
 * so a non-compliant event can never reach durable storage.
 *
 * Field names follow the compiled envelope contract in
 * generated/registries/envelopes.registry.json (snake_case, flat
 * envelope — NOT a nested `metadata` object).
 */

export interface AuditEnforcementResult {
  allowed: boolean
  invariant: string
  reason?: string
  failClosed: boolean
}

/**
 * Envelope fields required for an event to be auditable.
 * Derived from the `event_envelope` entry of the compiled envelope registry.
 */
const REQUIRED_AUDIT_FIELDS = [
  'event_name',
  'aggregate_id',
  'actor_id',
  'correlation_id',
  'command_id',
] as const

export class AuditTrailEnforcer {
  /**
   * @param requireSelfReference when true, the event must name INV-005 in
   *   audit.constitutional_rules_referenced. Defaults to false: the compiled
   *   corpus legitimately emits events citing other invariants, and rejecting
   *   those would fail-closed on constitutionally valid traffic.
   */
  constructor(private readonly requireSelfReference: boolean = false) {}

  enforce(event: any): AuditEnforcementResult {
    if (!event || typeof event !== 'object') {
      return {
        allowed: false,
        invariant: 'INV-005',
        reason: 'Event is not an object — cannot verify audit completeness',
        failClosed: true,
      }
    }

    const missing = REQUIRED_AUDIT_FIELDS.filter((field) => {
      const value = event[field]
      return value === undefined || value === null || value === ''
    })

    if (missing.length > 0) {
      return {
        allowed: false,
        invariant: 'INV-005',
        reason: `Event missing required audit fields: ${missing.join(', ')}`,
        failClosed: true,
      }
    }

    // The audit block itself must exist and cite at least one constitutional rule.
    const audit = event.audit
    if (!audit || typeof audit !== 'object') {
      return {
        allowed: false,
        invariant: 'INV-005',
        reason: 'Event missing audit block',
        failClosed: true,
      }
    }

    const refs = audit.constitutional_rules_referenced
    if (!Array.isArray(refs) || refs.length === 0) {
      return {
        allowed: false,
        invariant: 'INV-005',
        reason:
          'Event audit block missing constitutional_rules_referenced — ' +
          'every event must cite the rules it was evaluated under',
        failClosed: true,
      }
    }

    if (this.requireSelfReference && !refs.includes('INV-005')) {
      return {
        allowed: false,
        invariant: 'INV-005',
        reason: 'Event does not reference INV-005 in constitutional_rules_referenced',
        failClosed: true,
      }
    }

    return { allowed: true, invariant: 'INV-005', failClosed: false }
  }
}
