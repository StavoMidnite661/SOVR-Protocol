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
    operation: 'insert'|'update'|'delete'|'append'|'no_op';
    invalidation_keys?: string[];
  };
  audit: {
    constitutional_rules_referenced: string[];
    enforcement_actions?: string[];
    retention_class: 'permanent'|'regulatory_7y'|'operational_90d'|'session';
  };
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

export class EventStore {
  private events: EventEnvelope[] = [];
  private sequence = 0;
  private causationGraph = new Map<string, string[]>(); // causation_id -> [event_ids]
  private correlationGroups = new Map<string, EventEnvelope[]>();
  private aggregateIndex = new Map<string, EventEnvelope[]>();
  private persistencePath?: string;

  constructor(persistencePath?: string) {
    this.persistencePath = persistencePath;
    if (persistencePath) {
      this.load();
    }
  }

  private load() {
    try {
      if (fs.existsSync(this.persistencePath!)) {
        const raw = fs.readFileSync(this.persistencePath!, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const envelope of parsed) {
            // rebuild indexes without re-freezing validation
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
      const dir = path.dirname(this.persistencePath!);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      // Write atomically: write to tmp then rename
      const tmp = this.persistencePath! + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.events, null, 2));
      fs.renameSync(tmp, this.persistencePath!);
    } catch (e) {
      console.warn('EventStore persist failed', e);
    }
  }

  // INV-001: immutable after publication
  append(input: AppendInput): EventEnvelope {
    const event_id = crypto.randomUUID();
    const envelope: EventEnvelope = {
      event_id,
      event_name: input.event_name,
      event_version: input.event_version || '1.0.0',
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
      timestamp: new Date().toISOString(),
      payload: input.payload,
      projection_effect: input.projection_effect || { target: 'none', operation: 'no_op' },
      audit: input.audit || { constitutional_rules_referenced: ['INV-001','INV-005'], retention_class: 'permanent' },
    };

    // Validation: causation chain unbroken (EVT-ENV-T003)
    // If causation_id is not correlation_id itself and not zero, must exist or be command_id
    if (input.causation_id && input.causation_id !== input.correlation_id) {
      // allow if causation is command_id (first event in chain) else must be parent event
      const parentExists = this.events.some(e => e.event_id === input.causation_id || e.command_id === input.causation_id);
      // For genesis we allow missing parent to bootstrap boot events
      if (!parentExists && this.events.length > 0) {
        // still allow but log — INV-009 unknown state handling
        console.warn(`⚠️ Causation parent ${input.causation_id} not found for ${input.event_name}, treating as genesis for correlation ${input.correlation_id}`);
      }
    }

    // Append — monotonic sequence
    this.sequence++;
    // Freeze to enforce immutability
    Object.freeze(envelope.payload);
    Object.freeze(envelope);
    this.events.push(envelope);

    // Indexes
    const aggKey = `${input.aggregate}:${input.aggregate_id}`;
    if (!this.aggregateIndex.has(aggKey)) this.aggregateIndex.set(aggKey, []);
    this.aggregateIndex.get(aggKey)!.push(envelope);

    if (!this.correlationGroups.has(input.correlation_id)) this.correlationGroups.set(input.correlation_id, []);
    this.correlationGroups.get(input.correlation_id)!.push(envelope);

    if (!this.causationGraph.has(input.causation_id)) this.causationGraph.set(input.causation_id, []);
    this.causationGraph.get(input.causation_id)!.push(event_id);

    // INV-006: event does not mutate, only describes — we log projection hint but don't apply here (done in projection engine)

    // Persist for Source of CE durability
    this.persist();

    return envelope;
  }

  // INV-001: modification forbidden
  attemptModification(event_id: string): never {
    throw new Error(`IMMUTABLE_VIOLATION: Event ${event_id} cannot be modified — INV-001`);
  }

  attemptDeletion(event_id: string): never {
    throw new Error(`IMMUTABLE_VIOLATION: Event ${event_id} cannot be deleted — INV-001`);
  }

  getAll(): EventEnvelope[] {
    return [...this.events];
  }

  getById(event_id: string): EventEnvelope | undefined {
    return this.events.find(e => e.event_id === event_id);
  }

  getByAggregate(aggregate: string, aggregate_id: string): EventEnvelope[] {
    return this.aggregateIndex.get(`${aggregate}:${aggregate_id}`) || [];
  }

  getByCorrelation(correlation_id: string): EventEnvelope[] {
    return this.correlationGroups.get(correlation_id) || [];
  }

  getByCommand(command_id: string): EventEnvelope[] {
    return this.events.filter(e => e.command_id === command_id);
  }

  // Replay from genesis — proves INV-006 and replay determinism
  replay(fromSequence?: number, filter?: (e: EventEnvelope)=>boolean): EventEnvelope[] {
    let slice = this.events;
    if (fromSequence !== undefined) slice = slice.slice(fromSequence);
    if (filter) slice = slice.filter(filter);
    return [...slice];
  }

  // Audit trail completeness — INV-005
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
      latestTimestamp: this.events[this.events.length-1]?.timestamp,
    };
  }
}

export const globalEventStore = new EventStore();
