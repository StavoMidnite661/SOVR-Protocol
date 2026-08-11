import type { Projection } from '../server/projectionEngine.js';
import type { EventEnvelope } from '../server/eventStore.js';

export function createGovernanceDashboard(): Projection {
  const state = new Map<string, any>();
  const GLOBAL = 'global';
  return {
    name: 'governance_dashboard',
    description: 'Governance metrics, escalations, and amendments',
    sourceEvents: [
      'policy.escalation.created',
      'policy.escalation.resolved',
      'agent.execution.escalated',
      'payment.reconciliation.discrepancy',
      'hybrid.reorg.detected',
      'hybrid.reorg.resolved',
    ],
    state,
    buildFromGenesis(events) {
      state.clear();
      for (const e of events) this.handleEvent(e);
    },
    handleEvent(event: EventEnvelope) {
      if (!state.has(GLOBAL)) {
        state.set(GLOBAL, {
          active_discrepancies: 0,
          active_escalations: 0,
          active_reorgs: 0,
          agent_escalations_today: 0,
          average_resolution_time_ms: 0,
          pending_resolutions: 0,
          resolved_today: 0,
        });
      }
      const entry = state.get(GLOBAL)!;
      const today = new Date().toISOString().split('T')[0];
      const eventDate = event.timestamp.split('T')[0];
      switch (event.event_name) {
        case 'policy.escalation.created':
          entry.active_escalations += 1;
          entry.pending_resolutions += 1;
          break;
        case 'policy.escalation.resolved':
          entry.active_escalations = Math.max(0, entry.active_escalations - 1);
          entry.pending_resolutions = Math.max(0, entry.pending_resolutions - 1);
          if (eventDate === today) entry.resolved_today += 1;
          const resolvedAt = event.payload?.resolved_at || event.timestamp;
          const submittedAt = event.payload?.submitted_at || event.timestamp;
          const duration = new Date(resolvedAt).getTime() - new Date(submittedAt).getTime();
          entry.average_resolution_time_ms = Math.round((entry.average_resolution_time_ms + duration) / 2);
          break;
        case 'agent.execution.escalated':
          if (eventDate === today) entry.agent_escalations_today += 1;
          break;
        case 'payment.reconciliation.discrepancy':
          entry.active_discrepancies += 1;
          break;
        case 'hybrid.reorg.detected':
          entry.active_reorgs += 1;
          break;
        case 'hybrid.reorg.resolved':
          entry.active_reorgs = Math.max(0, entry.active_reorgs - 1);
          break;
      }
    },
  };
}
