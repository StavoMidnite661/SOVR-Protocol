import type { Projection } from '../server/projectionEngine.js';
import type { EventEnvelope } from '../server/eventStore.js';

export function createPolicyDecisions(): Projection {
  const state = new Map<string, any>();
  return {
    name: 'policy_decisions',
    description: 'Policy evaluation history and outcomes',
    sourceEvents: [
      'policy.evaluation.completed',
      'policy.evaluation.denied',
      'policy.evaluation.escalated',
      'policy.evaluation.deferred',
      'policy.escalation.created',
      'policy.escalation.resolved',
      'policy.rule.activated',
      'policy.rule.deactivated',
    ],
    state,
    buildFromGenesis(events) {
      state.clear();
      for (const e of events) this.handleEvent(e);
    },
    handleEvent(event: EventEnvelope) {
      const policyDecisionId = event.payload?.policy_decision_id || event.event_id;
      const actorId = event.payload?.actor_id || event.actor_id;
      const commandEvaluated = event.payload?.command_name || event.triggering_command;
      switch (event.event_name) {
        case 'policy.evaluation.completed':
        case 'policy.evaluation.denied':
        case 'policy.evaluation.escalated':
        case 'policy.evaluation.deferred': {
          const decisionMap: Record<string, string> = {
            'policy.evaluation.completed': 'ALLOW',
            'policy.evaluation.denied': 'DENY',
            'policy.evaluation.escalated': 'ESCALATE',
            'policy.evaluation.deferred': 'DEFER',
          };
          state.set(policyDecisionId, {
            policy_decision_id: policyDecisionId,
            actor_id: actorId,
            command_evaluated: commandEvaluated,
            decision: decisionMap[event.event_name] || 'UNKNOWN',
            denied_reasons: event.payload?.denied_reasons || event.payload?.reason || [],
            evaluated_at: event.timestamp,
            rules_evaluated: event.payload?.rules_applied || event.payload?.rules_evaluated || [],
          });
          break;
        }
        case 'policy.escalation.created': {
          const escalationId = event.payload?.escalation_id || event.event_id;
          state.set(escalationId, {
            policy_decision_id: escalationId,
            actor_id: actorId,
            command_evaluated: commandEvaluated,
            decision: 'ESCALATE',
            denied_reasons: [event.payload?.reason],
            evaluated_at: event.timestamp,
            rules_evaluated: [],
          });
          break;
        }
        case 'policy.escalation.resolved': {
          const existing = state.get(policyDecisionId);
          if (existing) {
            existing.decision = 'RESOLVED';
            existing.denied_reasons = existing.denied_reasons || [];
          }
          break;
        }
        case 'policy.rule.activated': {
          const ruleId = event.payload?.rule_id || event.event_id;
          state.set(ruleId, {
            policy_decision_id: ruleId,
            actor_id: actorId,
            command_evaluated: 'RULE_ACTIVATED',
            decision: 'ALLOW',
            denied_reasons: [],
            evaluated_at: event.timestamp,
            rules_evaluated: [ruleId],
          });
          break;
        }
        case 'policy.rule.deactivated': {
          const ruleId = event.payload?.rule_id || event.event_id;
          const existing = state.get(ruleId);
          if (existing) existing.decision = 'DEACTIVATED';
          break;
        }
      }
    },
  };
}
