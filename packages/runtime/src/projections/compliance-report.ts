import type { Projection } from '../server/projectionEngine.js';
import type { EventEnvelope } from '../server/eventStore.js';

export function createComplianceReport(): Projection {
  const state = new Map<string, any>();
  const GLOBAL = 'global';
  return {
    name: 'compliance_report',
    description: 'Regulatory compliance metrics and violations',
    sourceEvents: ['*'],
    state,
    buildFromGenesis(events) {
      state.clear();
      for (const e of events) this.handleEvent(e);
    },
    handleEvent(event: EventEnvelope) {
      if (!state.has(GLOBAL)) {
        state.set(GLOBAL, {
          compliance_rate_pct: '100.00',
          most_common_denial_reasons: [] as string[],
          total_agent_violations: 0,
          total_escalations: 0,
          total_policy_denials: 0,
          total_reconciliation_discrepancies: 0,
        });
      }
      const entry = state.get(GLOBAL)!;
      const totalEvents = event.audit?.constitutional_rules_referenced?.length || 0;
      switch (event.event_name) {
        case 'policy.evaluation.denied':
          entry.total_policy_denials += 1;
          const reason = event.payload?.reason || 'UNKNOWN';
          if (!entry.most_common_denial_reasons.includes(reason)) {
            entry.most_common_denial_reasons.push(reason);
          }
          break;
        case 'agent.execution.escalated':
          entry.total_escalations += 1;
          break;
        case 'payment.reconciliation.discrepancy':
          entry.total_reconciliation_discrepancies += 1;
          break;
      }
      const denials = entry.total_policy_denials;
      const total = denials + entry.total_escalations + entry.total_reconciliation_discrepancies + entry.total_agent_violations;
      entry.compliance_rate_pct = total === 0 ? '100.00' : String(((total - denials) / total) * 100).substring(0, 5);
    },
  };
}
