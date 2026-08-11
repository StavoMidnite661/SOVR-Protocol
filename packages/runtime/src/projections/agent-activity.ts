import type { Projection } from '../server/projectionEngine.js';
import type { EventEnvelope } from '../server/eventStore.js';

export function createAgentActivity(): Projection {
  const state = new Map<string, any>();
  return {
    name: 'agent_activity',
    description: 'Agent execution history and audit envelopes',
    sourceEvents: [
      'agent.registration.approved',
      'agent.execution.started',
      'agent.execution.completed',
      'agent.execution.failed',
      'agent.execution.escalated',
      'agent.capability.bound',
      'agent.capability.revoked',
      'agent.quota.exceeded',
      'agent.concurrency.limit_reached',
    ],
    state,
    buildFromGenesis(events) {
      state.clear();
      for (const e of events) this.handleEvent(e);
    },
    handleEvent(event: EventEnvelope) {
      const key = event.event_id;
      let action = event.event_name;
      let status = 'RECORDED';
      let durationMs: number | undefined;
      let executionId: string | undefined;
      let intentId: string | undefined;
      let modelVersion: string | undefined;
      let policyDecisionId: string | undefined;
      let resourcesChanged: string[] | undefined;
      const executedAt = event.timestamp;
      const agentId = event.payload?.agent_id || event.actor_id;
      const commandId = event.payload?.command_id || event.command_id;

      switch (event.event_name) {
        case 'agent.registration.approved':
          action = 'registration_approved';
          break;
        case 'agent.execution.started':
          action = 'execution_started';
          executionId = event.payload?.execution_id;
          intentId = event.payload?.intent_id;
          modelVersion = event.payload?.model_version;
          policyDecisionId = event.payload?.policy_decision_id;
          resourcesChanged = event.payload?.constitutional_rules;
          status = 'STARTED';
          break;
        case 'agent.execution.completed':
          action = 'execution_completed';
          executionId = event.payload?.execution_id;
          intentId = event.payload?.intent_id;
          modelVersion = event.payload?.model_version;
          policyDecisionId = event.payload?.policy_decision_id;
          durationMs = event.payload?.execution_time_ms;
          resourcesChanged = Object.keys(event.payload?.resources_used || {});
          status = event.payload?.execution_result || 'COMPLETED';
          break;
        case 'agent.execution.failed':
          action = 'execution_failed';
          executionId = event.payload?.execution_id;
          status = 'FAILED';
          break;
        case 'agent.execution.escalated':
          action = 'execution_escalated';
          executionId = event.payload?.execution_id;
          status = 'ESCALATED';
          break;
        case 'agent.capability.bound':
          action = 'capability_bound';
          break;
        case 'agent.capability.revoked':
          action = 'capability_revoked';
          break;
        case 'agent.quota.exceeded':
          action = 'quota_exceeded';
          status = 'QUOTA_EXCEEDED';
          break;
        case 'agent.concurrency.limit_reached':
          action = 'concurrency_limit_reached';
          status = 'CONCURRENCY_LIMIT_REACHED';
          break;
      }

      state.set(key, {
        action,
        agent_id: agentId,
        command_id: commandId,
        duration_ms: durationMs,
        executed_at: executedAt,
        execution_id: executionId,
        intent_id: intentId,
        model_version: modelVersion,
        policy_decision_id: policyDecisionId,
        resources_changed: resourcesChanged,
        status,
      });
    },
  };
}
