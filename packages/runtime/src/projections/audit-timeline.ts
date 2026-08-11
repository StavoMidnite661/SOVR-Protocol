import type { Projection } from '../server/projectionEngine.js';
import type { EventEnvelope } from '../server/eventStore.js';

export function createAuditTimeline(): Projection {
  const state = new Map<string, any>();
  return {
    name: 'audit_timeline',
    description: 'Complete chronological audit trail across all domains',
    sourceEvents: ['*'],
    state,
    buildFromGenesis(events) {
      state.clear();
      for (const e of events) this.handleEvent(e);
    },
    handleEvent(event: EventEnvelope) {
      state.set(event.event_id, {
        event_id: event.event_id,
        event_name: event.event_name,
        source_domain: event.source_domain,
        aggregate: event.aggregate,
        aggregate_id: event.aggregate_id,
        actor_id: event.actor_id,
        actor_type: event.identity_context?.actor_type,
        capability_id: event.capability_id,
        command_id: event.command_id,
        policy_decision_id: event.policy_decision_id,
        retention_class: event.audit?.retention_class,
        timestamp: event.timestamp,
        triggering_command: event.triggering_command,
      });
    },
  };
}
