// ============================================================
// SOVR Event Store — Source of Canonical Events (CE)
// Append-only, immutable, causation chain, correlation grouping
// INV-001: Every state change requires immutable event
// INV-005: Every financial action produces auditable trail
// INV-006: Events describe, don't mutate — projections interpret
// ============================================================

import fs from 'fs';
import path from 'path';

export interface EventEnvelope {
  event_id: string;
  event_name: string;
  event_version: string;
  schema_version: string;
  aggregate: string;
  aggregate_id: string;
  source_domain: string;
  command_id: string;
  triggering_command: string;
  causation_id: string;
  correlation_id: string;
  actor_id: string;
  identity_context: {
    identity_id: string;
    actor_type: string;
    session_id?: string;
    agent_id?: string;
    model_version?: string;
    delegation_chain?: string[];
  };
  policy_decision_id: string;
  capability_id: string;
  timestamp: string;
  payload: Record<string, any>;
  projection_effect: {
    target: string;
    operation: 'insert' | 'update' | 'delete' | 'append' | 'no_op';
    invalidation_keys?: string[];
  };
  audit: {
    constitutional_rules_referenced: string[];
    enforcement_actions?: string[];
    retention_class: 'permanent' | 'regulatory_7y' | 'operational_90d' | 'session';
  };
  retention_metadata?: {
    archived_at?: string;
    legal_hold?: boolean;
    expiry?: string;
  };
  actor_chain?: string[];
}

interface AppendInput {
  event_name: string;
  aggregate: string;
  aggregate_id: string;
  source_domain: string;
  command_id: string;
  triggering_command: string;
  causation_id: string;
  correlation_id: string;
  actor_id: string;
  identity_context: any;
  policy_decision_id: string;
  capability_id: string;
  payload: any;
  projection_effect: any;
  audit: any;
  event_version?: string;
}

export type EventPublisher = (envelope: EventEnvelope) => Promise<void>;

export class EventStore {
  private events: EventEnvelope[] = [];
  private sequence = 0;
  private causationGraph = new Map<string, string[]>();
  private correlationGroups = new Map<string, EventEnvelope[]>();
  private aggregateIndex = new Map<string, EventEnvelope[]>();
  private persistencePath?: string;
  private publisher?: EventPublisher;
  // When true (default), genesis-like events whose causation parent is not in the store
  // are accepted with a warning. When false, append() throws. Production should use strict mode.
  private strictCausation: boolean;

  constructor(persistencePath?: string, opts: { strictCausation?: boolean } = {}) {
    this.persistencePath = persistencePath;
    this.strictCausation = opts.strictCausation ?? false; // we tolerate genesis bootstraps
    if (persistencePath) this.load();
  }

  /** Register an external publisher (e.g. Kafka producer + Redis stream + WebSocket fan-out). */
  setPublisher(publisher: EventPublisher): void {
    this.publisher = publisher;
  }

  private load() {
    try {
      if (this.persistencePath && fs.existsSync(this.persistencePath)) {
        const raw = fs.readFileSync(this.persistencePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const envelope of parsed) {
            // Backfill spec fields if loading an older envelope shape
            if (envelope.schema_version === undefined) envelope.schema_version = '1.0.0';
            if (envelope.actor_chain === undefined) envelope.actor_chain = [];
            if (envelope.retention_metadata === undefined) envelope.retention_metadata = { legal_hold: envelope.audit?.retention_class === 'permanent' || false };
            this.events.push(envelope);
            this.sequence++;
            const aggKey = `${envelope.aggregate}:${envelope.aggregate_id}`;
            if (!this.aggregateIndex.has(aggKey)) this.aggregateIndex.set(aggKey, []);
            this.aggregateIndex.get(aggKey)!.push(envelope);
            if (!this.correlationGroups.has(envelope.correlation_id)) this.correlationGroups.set(envelope.correlation_id, []);
            this.correlationGroups.get(envelope.correlation_id)!.push(envelope);
            if (!this.causationGraph.has(envelope.causation_id)) this.causationGraph.set(envelope.causation_id, []);
            this.causationGraph.get(envelope.causation_id)!.push(envelope.event_id);
          }
          console.log(`📚 EventStore loaded ${this.events.length} events from ${this.persistencePath} — Source of CE restored`);
        }
      }
    } catch (e) {
      console.warn(`Failed to load event store from ${this.persistencePath}`, e);
    }
  }

  private persist() {
    if (!this.persistencePath) return;
    try {
      const dir = path.dirname(this.persistencePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const tmp = this.persistencePath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.events, null, 2));
      fs.renameSync(tmp, this.persistencePath);
    } catch (e) {
      console.warn('EventStore persist failed', e);
    }
  }

  append(input: AppendInput): EventEnvelope {
    const event_id = crypto.randomUUID();
    const now = new Date().toISOString();
    const envelope: EventEnvelope = {
      event_id,
      event_name: input.event_name,
      event_version: input.event_version || '1.0.0',
      schema_version: '1.0.0',
      aggregate: input.aggregate,
      aggregate_id: input.aggregate_id,
      source_domain: input.source_domain,
      command_id: input.command_id,
      triggering_command: input.triggering_command,
      causation_id: input.causation_id,
      correlation_id: input.correlation_id,
      actor_id: input.actor_id,
      identity_context: input.identity_context,
      policy_decision_id: input.policy_decision_id,
      capability_id: input.capability_id,
      timestamp: now,
      payload: input.payload,
      projection_effect: input.projection_effect || { target: 'none', operation: 'no_op' },
      audit: input.audit || { constitutional_rules_referenced: ['INV-001', 'INV-005'], retention_class: 'permanent' },
      actor_chain: input.identity_context?.delegation_chain ?? [],
      retention_metadata: { legal_hold: input.audit?.retention_class === 'permanent' || false },
    };

    // Validate causation: if the parent event/event_id is not found and we have other events,
    // either warn (tolerant) or throw (strict). The genesis case (no events yet) is always tolerated.
    if (input.causation_id && input.causation_id !== input.correlation_id) {
      const parentExists = this.events.some(e => e.event_id === input.causation_id || e.command_id === input.causation_id);
      if (!parentExists && this.events.length > 0) {
        if (this.strictCausation) {
          throw new Error(`CAUSATION_BROKEN: parent ${input.causation_id} not found for event ${input.event_name} (correlation ${input.correlation_id})`);
        }
        console.warn(`⚠️ Causation parent ${input.causation_id} not found for ${input.event_name}, treating as genesis for correlation ${input.correlation_id}`);
      }
    }

    this.sequence++;
    // Ensure optional fields are present (not undefined) for spec compliance — set BEFORE freeze
    if (envelope.actor_chain === undefined) (envelope as any).actor_chain = [];
    if (envelope.retention_metadata === undefined) (envelope as any).retention_metadata = { legal_hold: false };
    Object.freeze(envelope.payload);
    Object.freeze(envelope);
    this.events.push(envelope);

    const aggKey = `${input.aggregate}:${input.aggregate_id}`;
    if (!this.aggregateIndex.has(aggKey)) this.aggregateIndex.set(aggKey, []);
    this.aggregateIndex.get(aggKey)!.push(envelope);
    if (!this.correlationGroups.has(input.correlation_id)) this.correlationGroups.set(input.correlation_id, []);
    this.correlationGroups.get(input.correlation_id)!.push(envelope);
    if (!this.causationGraph.has(input.causation_id)) this.causationGraph.set(input.causation_id, []);
    this.causationGraph.get(input.causation_id)!.push(event_id);

    this.persist();

    // External publish (fire-and-forget but errors are logged by the publisher wrapper)
    if (this.publisher) {
      Promise.resolve(this.publisher(envelope)).catch((e) => {
        console.warn(`Event publisher failed for ${envelope.event_name}:`, (e as Error).message);
      });
    }

    return envelope;
  }

  attemptModification(event_id: string): never {
    throw new Error(`IMMUTABLE_VIOLATION: Event ${event_id} cannot be modified — INV-001`);
  }
  attemptDeletion(event_id: string): never {
    throw new Error(`IMMUTABLE_VIOLATION: Event ${event_id} cannot be deleted — INV-001`);
  }

  getAll(): EventEnvelope[] { return [...this.events]; }
  getById(event_id: string): EventEnvelope | undefined { return this.events.find(e => e.event_id === event_id); }
  getByAggregate(aggregate: string, aggregate_id: string): EventEnvelope[] { return this.aggregateIndex.get(`${aggregate}:${aggregate_id}`) || []; }
  getByCorrelation(correlation_id: string): EventEnvelope[] { return this.correlationGroups.get(correlation_id) || []; }
  getByCommand(command_id: string): EventEnvelope[] { return this.events.filter(e => e.command_id === command_id); }
  getByActor(actor_id: string): EventEnvelope[] { return this.events.filter(e => e.actor_id === actor_id); }

  replay(fromSequence?: number, filter?: (e: EventEnvelope) => boolean): EventEnvelope[] {
    let slice = this.events;
    if (fromSequence !== undefined) slice = slice.slice(fromSequence);
    if (filter) slice = slice.filter(filter);
    return [...slice];
  }

  auditTrailForCommand(command_id: string) {
    const evs = this.getByCommand(command_id);
    const complete = evs.length > 0 && evs.every(e => e.audit && e.identity_context && e.policy_decision_id);
    return { events: evs, isComplete: complete };
  }

  stats() {
    return {
      totalEvents: this.events.length,
      sequences: this.sequence,
      aggregates: this.aggregateIndex.size,
      correlations: this.correlationGroups.size,
      latestTimestamp: this.events[this.events.length - 1]?.timestamp,
    };
  }
}
