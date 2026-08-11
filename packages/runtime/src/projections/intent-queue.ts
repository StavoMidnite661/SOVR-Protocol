import type { Projection } from '../server/projectionEngine.js';
import type { EventEnvelope } from '../server/eventStore.js';

export function createIntentQueue(): Projection {
  const state = new Map<string, any>();
  return {
    name: 'intent_queue',
    description: 'Active intents and their processing states',
    sourceEvents: [
      'intent.enriching.started',
      'intent.enriching.completed',
      'intent.enriching.failed',
      'intent.validation.completed',
      'intent.multi_step.step_completed',
      'intent.multi_step.completed',
      'intent.multi_step.failed',
    ],
    state,
    buildFromGenesis(events) {
      state.clear();
      for (const e of events) this.handleEvent(e);
    },
    handleEvent(event: EventEnvelope) {
      const intentId = event.payload?.intent_id || event.aggregate_id;
      const actorId = event.payload?.actor_id || event.actor_id;
      const created = event.timestamp;
      switch (event.event_name) {
        case 'intent.enriching.started': {
          state.set(intentId, {
            intent_id: intentId,
            actor_id: actorId,
            intent_type: event.payload?.intent_type || 'unknown',
            state: 'ENRICHING',
            created_at: created,
            enrichment_complete: false,
            ambiguity_score: event.payload?.ambiguity_score,
            total_steps: event.payload?.total_steps,
            current_step: 0,
          });
          break;
        }
        case 'intent.enriching.completed': {
          const existing = state.get(intentId);
          if (existing) {
            existing.enrichment_complete = true;
            existing.state = 'ENRICHED';
            existing.ambiguity_score = event.payload?.ambiguity_score ?? existing.ambiguity_score;
          }
          break;
        }
        case 'intent.enriching.failed': {
          const existing = state.get(intentId);
          if (existing) existing.state = 'ENRICHMENT_FAILED';
          break;
        }
        case 'intent.validation.completed': {
          const existing = state.get(intentId);
          if (existing) {
            existing.state = 'VALIDATED';
            existing.ambiguity_score = event.payload?.ambiguity_score ?? existing.ambiguity_score;
          }
          break;
        }
        case 'intent.multi_step.step_completed': {
          const existing = state.get(intentId);
          if (existing) {
            existing.current_step = (existing.current_step || 0) + 1;
            existing.state = 'STEP_COMPLETED';
          }
          break;
        }
        case 'intent.multi_step.completed': {
          const existing = state.get(intentId);
          if (existing) {
            existing.state = 'COMPLETED';
            existing.current_step = existing.total_steps;
          }
          break;
        }
        case 'intent.multi_step.failed': {
          const existing = state.get(intentId);
          if (existing) existing.state = 'FAILED';
          break;
        }
      }
    },
  };
}
