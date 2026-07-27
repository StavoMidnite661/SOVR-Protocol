/**
 * EventOrderingEnforcer — INV-007 (Event Ordering Integrity)
 *
 * Constitutional requirement:
 *   Events within an aggregate stream must be strictly monotonic.
 *   Out-of-order or duplicate sequence numbers are rejected at the
 *   store boundary, before the write.
 *
 * Invoked by EventStoreEnforcementWrapper.append() after INV-005.
 *
 * The tracker is pluggable so the same enforcer serves the in-memory
 * JSON store (dev) and PostgreSQL (production).
 */

export interface OrderingEnforcementResult {
  allowed: boolean
  invariant: string
  reason?: string
  failClosed: boolean
}

export interface SequenceTracker {
  getLastSequence(streamId: string): Promise<number | null>
  setLastSequence(streamId: string, sequence: number): Promise<void>
}

/**
 * Default in-process tracker. Monotonicity is enforced per aggregate stream
 * for the lifetime of the process; durable ordering is additionally
 * guaranteed by the event store's own primary key.
 */
export class InMemorySequenceTracker implements SequenceTracker {
  private readonly sequences = new Map<string, number>()

  async getLastSequence(streamId: string): Promise<number | null> {
    return this.sequences.has(streamId) ? this.sequences.get(streamId)! : null
  }

  async setLastSequence(streamId: string, sequence: number): Promise<void> {
    this.sequences.set(streamId, sequence)
  }

  reset(): void {
    this.sequences.clear()
  }
}

export class EventOrderingEnforcer {
  private readonly tracker: SequenceTracker

  constructor(tracker?: SequenceTracker) {
    this.tracker = tracker ?? new InMemorySequenceTracker()
  }

  async enforce(event: any): Promise<OrderingEnforcementResult> {
    // Stream identity is the aggregate stream; sequence is optional in the
    // compiled envelope, so absence is not a violation — the store assigns
    // ordering. When present, it MUST be strictly monotonic.
    const streamId: string | undefined =
      event?.stream_id ?? event?.aggregate_id ?? undefined

    const rawSequence = event?.sequence ?? event?.stream_sequence
    if (rawSequence === undefined || rawSequence === null) {
      return { allowed: true, invariant: 'INV-007', failClosed: false }
    }

    if (!streamId) {
      return {
        allowed: false,
        invariant: 'INV-007',
        reason: 'Event carries a sequence but no aggregate_id/stream_id to order it within',
        failClosed: true,
      }
    }

    const sequence = Number(rawSequence)
    if (!Number.isInteger(sequence) || sequence < 1) {
      return {
        allowed: false,
        invariant: 'INV-007',
        reason: `Invalid sequence "${rawSequence}" for stream ${streamId} — must be a positive integer`,
        failClosed: true,
      }
    }

    const last = await this.tracker.getLastSequence(streamId)

    if (last === null) {
      if (sequence !== 1) {
        return {
          allowed: false,
          invariant: 'INV-007',
          reason: `First event in stream ${streamId} must have sequence 1, got ${sequence}`,
          failClosed: true,
        }
      }
      await this.tracker.setLastSequence(streamId, sequence)
      return { allowed: true, invariant: 'INV-007', failClosed: false }
    }

    if (sequence !== last + 1) {
      return {
        allowed: false,
        invariant: 'INV-007',
        reason:
          `Stream ${streamId}: expected sequence ${last + 1}, got ${sequence}. ` +
          'Out-of-order or duplicate event rejected.',
        failClosed: true,
      }
    }

    await this.tracker.setLastSequence(streamId, sequence)
    return { allowed: true, invariant: 'INV-007', failClosed: false }
  }
}
