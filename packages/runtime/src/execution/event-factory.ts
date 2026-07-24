import { AppendInput } from '../server/eventStore.js';
import type { CommandEnvelope } from '../server/commandBus.js';
import type { TransitionResult } from './state-machine-interpreter.js';

export interface EventFactoryBuildParams {
  eventName: string;
  command: CommandEnvelope;
  aggregate: string;
  aggregateId: string;
  sourceDomain: string;
  actor: CommandEnvelope['identity_context'];
  payload: Record<string, unknown>;
  projectionEffect?: any;
  eventVersion?: string;
  transition?: TransitionResult | TransitionResult[];
}

export class EventFactory {
  constructor(private readonly eventCatalog: any) {}

  build(params: EventFactoryBuildParams): AppendInput {
    const eventDef = this.eventCatalog?.events?.[params.eventName] ?? {};
    const aggregate = eventDef.aggregate ?? params.aggregate;
    const aggregateId = params.aggregateId;
    const sourceDomain = eventDef.source_domain ?? params.sourceDomain;
    const transitionList = params.transition
      ? (Array.isArray(params.transition) ? params.transition : [params.transition])
      : [];
    const stateTransitions = transitionList.map(t => ({
      machine_id: t.machineId,
      machine_name: t.machineName,
      transition_name: t.transitionName,
      domain: t.domain,
      aggregate: t.aggregate,
      aggregate_id: t.aggregateId,
      from_state: t.fromState,
      to_state: t.toState,
      trigger: t.trigger,
      condition: t.condition,
    }));
    const stateTransition = stateTransitions[0];
    const lifecycleExemption = params.command.meta?.lifecycle_exempt ? {
      lifecycle_exempt: true,
      lifecycle_exempt_reason: params.command.meta?.lifecycle_exempt_reason,
      lifecycle_exempt_governance_ref: params.command.meta?.lifecycle_exempt_governance_ref,
    } : undefined;

    return {
      event_name: params.eventName,
      event_version: params.eventVersion ?? eventDef.version ?? '1.0.0',
      aggregate,
      aggregate_id: aggregateId,
      source_domain: sourceDomain,
      command_id: params.command.command_id,
      triggering_command: params.command.command_name,
      causation_id: params.command.command_id,
      correlation_id: params.command.correlation_id,
      actor_id: params.actor.actor_id,
      identity_context: params.actor,
      policy_decision_id: params.command.meta?.policy_decision_id ?? params.command.meta?.policyDecisionId ?? 'policy_decision_unrecorded',
      capability_id: params.command.capability_id,
      payload: {
        ...params.payload,
        [`${aggregate}_id`]: aggregateId,
        ...(eventDef.aggregate_id_field ? { [eventDef.aggregate_id_field]: aggregateId } : {}),
        ...(stateTransition ? { _state_transition: stateTransition, _state_transitions: stateTransitions } : {}),
        ...(lifecycleExemption ? { _lifecycle_exemption: lifecycleExemption } : {}),
      },
      projection_effect: params.projectionEffect ?? eventDef.projection_effect ?? { target: 'none', operation: 'no_op' },
      audit: {
        constitutional_rules_referenced: ['INV-001', 'INV-003', 'INV-005', 'INV-008'],
        enforcement_actions: [
          'guardrail_bus',
          ...(lifecycleExemption ? ['lifecycle_exemption_declared'] : ['state_machine_interpreter']),
          'event_factory',
        ],
        retention_class: 'permanent',
      },
    };
  }
}
