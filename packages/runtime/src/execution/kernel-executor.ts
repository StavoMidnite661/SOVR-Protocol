import commandsRegistry from '../../../../generated/registries/commands.registry.json' with { type: 'json' };
import machinesRegistry from '../../../../generated/registries/machines.registry.json' with { type: 'json' };
import validationRegistry from '../../../../generated/registries/validation.registry.json' with { type: 'json' };
import eventsRegistry from '../../../../generated/registries/events.registry.json' with { type: 'json' };
import capabilitiesRegistry from '../../../../generated/registries/capabilities.registry.json' with { type: 'json' };
import executionPlansRegistry from '../../../../generated/registries/execution-plans.registry.json' with { type: 'json' };
import envelopesRegistry from '../../../../generated/registries/envelopes.registry.json' with { type: 'json' };
import { randomUUID } from 'node:crypto';
import { InstructionEvaluator } from './instruction-evaluator.js';
import type { StateRegistry } from './state-registry.js';
import type { AtomicCommit } from './atomic-commit.js';
import type { CapabilityEngine } from '../server/capabilityEngine.js';
import type { CommandEnvelope } from '../server/commandBus.js';
import type { AppendInput, EventEnvelope } from '../server/eventStore.js';

export interface KernelExecutionResult {
  status: 'ACCEPTED' | 'REJECTED';
  commandId: string;
  correlationId: string;
  events: EventEnvelope[];
  eventsEmitted: number;
  transitionResult?: any;
  transitions: any[];
  error?: string;
  error_type?: string;
}

export class KernelValidationError extends Error { constructor(readonly code: string, message: string) { super(message); this.name = 'KernelValidationError'; } }
export class KernelCapabilityViolationError extends Error { constructor(message: string) { super(message); this.name = 'KernelCapabilityViolationError'; } }
export class KernelIdentityViolationError extends Error { constructor(message: string) { super(message); this.name = 'KernelIdentityViolationError'; } }
export class InvalidStateTransitionError extends Error { constructor(message: string) { super(message); this.name = 'InvalidStateTransitionError'; } }

export class KernelExecutor {
  constructor(
    private evaluator: InstructionEvaluator,
    private stateRegistry: StateRegistry,
    private atomicCommit: AtomicCommit,
    private capabilityStore: CapabilityEngine,
    private eventStore: any,
  ) {}

  async execute(request: CommandEnvelope): Promise<KernelExecutionResult> {
    const commandDef = (commandsRegistry as any).entries?.[request.command_name];
    if (!commandDef) throw new KernelValidationError('UNKNOWN_COMMAND', `Unknown command ${request.command_name}`);

    await this.identityCheck(request, commandDef);
    await this.capabilityCheck(request, commandDef);
    await this.evaluateInstructions(request);

    const plan = await this.planTransitionsAndEvents(request, commandDef);
    const commitResult = await this.atomicCommit.execute({
      stateUpdates: plan.transitions.filter(t => t.toState).map(t => ({
        aggregate: t.aggregate,
        id: t.aggregateId,
        state: t.toState,
        domain: t.domain,
        transition: {
          aggregate: t.aggregate,
          aggregateId: t.aggregateId,
          domain: t.domain,
          fromState: t.fromState,
          toState: t.toState,
          trigger: t.trigger,
          machineId: t.machineId,
          machineName: t.machineName,
          transitionName: t.transitionName,
          commandId: request.command_id,
          correlationId: request.correlation_id,
          eventName: t.trigger,
        },
      })),
      events: plan.events,
      stateRegistry: this.stateRegistry,
      eventStore: this.eventStore,
    });

    return {
      status: 'ACCEPTED',
      commandId: request.command_id,
      correlationId: request.correlation_id,
      events: commitResult.events,
      eventsEmitted: commitResult.events.length,
      transitionResult: plan.transitions[0],
      transitions: plan.transitions,
    };
  }

  private async identityCheck(request: CommandEnvelope, commandDef: any): Promise<void> {
    if (!request.identity_context?.identity_id || !request.identity_context?.actor_id) throw new KernelIdentityViolationError('missing identity_context');
    const allowed = commandDef.issuer?.actor_types ?? [];
    if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(request.identity_context.actor_type)) {
      throw new KernelIdentityViolationError(`actor_type ${request.identity_context.actor_type} not allowed for ${request.command_name}`);
    }
  }

  private async capabilityCheck(request: CommandEnvelope, commandDef: any): Promise<void> {
    const required = commandDef.authorization_requirements?.capability ?? commandDef.issuer?.minimum_capability ?? request.capability_id;
    if (required === 'system.internal' && request.identity_context.actor_type === 'system') return;
    const ok = this.capabilityStore.check(request.identity_context.actor_id, request.capability_id || required, request.scope);
    if (!ok) throw new KernelCapabilityViolationError(`capability denied: ${request.capability_id || required}`);
  }

  private async evaluateInstructions(request: CommandEnvelope): Promise<void> {
    const key = `${request.command_name.replace(/\./g, '_')}_rules`;
    const validation = (validationRegistry as any).entries?.[key];
    const rules = [...(validation?.rules ?? [])].sort((a: any, b: any) => Number(b.type === 'BALANCED_POSTINGS') - Number(a.type === 'BALANCED_POSTINGS'));
    for (const rule of rules) {
      const passed = await this.evaluator.evaluate(rule, {
        payload: request.payload,
        command: request,
        context: request.meta ?? {},
        stateRegistry: this.stateRegistry,
        eventStore: this.eventStore,
        capabilityStore: this.capabilityStore,
      });
      if (!passed) throw new KernelValidationError(rule.error_code ?? 'VALIDATION_FAILED', rule.error_message ?? `Validation failed for ${request.command_name}`);
    }
  }

  private async planTransitionsAndEvents(request: CommandEnvelope, commandDef: any): Promise<{ transitions: any[]; events: AppendInput[] }> {
    const eventNames = commandDef.resulting_events?.success ?? [];
    const transitions: any[] = [];
    const events: AppendInput[] = [];
    for (const eventName of eventNames) {
      const eventDef = (eventsRegistry as any).entries?.[eventName];
      if (!eventDef) continue;
      const aggregate = eventDef.aggregate ?? commandDef.aggregate;
      const aggregateId = this.resolveAggregateId(request, eventDef, aggregate);
      const transition = await this.findTransition(eventName, eventDef.source_domain ?? commandDef.domain, aggregate, aggregateId, request);
      if (transition) transitions.push(transition);
      events.push(this.buildEnvelope(eventName, eventDef, request, aggregate, aggregateId, transition ? [transition] : []));
    }
    return { transitions, events };
  }

  private async findTransition(eventName: string, domain: string, aggregate: string, aggregateId: string, request: CommandEnvelope): Promise<any | undefined> {
    const machineEntry = Object.values((machinesRegistry as any).entries ?? {}).find((m: any) => m.domain === domain && m.aggregate === aggregate) as any;
    if (!machineEntry) return undefined;

    const hasState = this.stateRegistry.hasState(aggregate, aggregateId, domain);
    if (!hasState) {
      return {
        machineId: machineEntry.id,
        machineName: machineEntry.id?.replace(/^state_machine:/, ''),
        domain,
        aggregate,
        aggregateId,
        fromState: 'INIT',
        toState: machineEntry.initial_state,
        target: machineEntry.initial_state,
        trigger: eventName,
        transitionName: `INIT_to_${machineEntry.initial_state}`,
      };
    }

    const currentState = await this.stateRegistry.getState(aggregate, aggregateId, domain);
    const transition = this.lookupTransition(machineEntry, currentState, eventName);
    if (!transition) {
      const finalStates = Array.isArray(machineEntry.final_states) ? machineEntry.final_states : [];
      const finalMessage = finalStates.includes(currentState) ? 'Final state does not accept commands' : 'Command not allowed from this state';
      throw new InvalidStateTransitionError(`${machineEntry.id ?? machineEntry.machine_id}: state ${currentState} does not accept ${request.command_name} (${eventName}) — ${finalMessage}`);
    }
    return {
      machineId: machineEntry.id,
      machineName: machineEntry.id?.replace(/^state_machine:/, ''),
      domain,
      aggregate,
      aggregateId,
      fromState: transition.from,
      toState: transition.to,
      target: transition.to,
      trigger: eventName,
      transitionName: transition.name,
    };
  }

  private lookupTransition(machineEntry: any, currentState: string, eventName: string): { name: string; from: string; to: string } | undefined {
    const transitions = machineEntry.transitions ?? {};
    if (Array.isArray(transitions)) {
      for (const t of transitions) {
        const trigger = t.trigger ?? t.event ?? t.command;
        if (t.from === currentState && trigger === eventName) return { name: `${t.from}_to_${t.to}`, from: t.from, to: t.to };
      }
      return undefined;
    }
    for (const [name, t] of Object.entries(transitions) as Array<[string, any]>) {
      if (name === 'abi') continue;
      const endpoints = this.transitionEndpoints(name, t);
      const trigger = t?.trigger ?? t?.event ?? t?.command;
      if (endpoints && endpoints.from === currentState && trigger === eventName) return { name, from: endpoints.from, to: endpoints.to };
    }
    return undefined;
  }

  private transitionEndpoints(name: string, transition: any): { from: string; to: string } | undefined {
    if (transition?.from && transition?.to) return { from: String(transition.from), to: String(transition.to) };
    const marker = '_to_';
    const idx = name.indexOf(marker);
    if (idx === -1) return undefined;
    return { from: name.slice(0, idx), to: name.slice(idx + marker.length) };
  }

  private resolveAggregateId(request: CommandEnvelope, eventDef: any, aggregate: string): string {
    const field = eventDef.aggregate_id_field || `${aggregate}_id`;
    return String(request.payload?.[field] ?? request.payload?.[`${aggregate}_id`] ?? request.payload?.asset_id ?? request.payload?.reservation_id ?? request.payload?.journal_id ?? request.payload?.order_id ?? randomUUID());
  }

  private buildEnvelope(eventName: string, eventDef: any, request: CommandEnvelope, aggregate: string, aggregateId: string, transitions: any[]): AppendInput {
    return {
      event_name: eventName,
      event_version: String(eventDef.version ?? '1.0.0'),
      aggregate,
      aggregate_id: aggregateId,
      source_domain: String(eventDef.source_domain ?? request.source_domain),
      command_id: request.command_id,
      triggering_command: request.command_name,
      causation_id: request.command_id,
      correlation_id: request.correlation_id,
      actor_id: request.identity_context.actor_id,
      identity_context: request.identity_context,
      policy_decision_id: request.meta?.policy_decision_id ?? 'policy_decision_unrecorded',
      capability_id: request.capability_id,
      payload: {
        ...request.payload,
        [`${aggregate}_id`]: aggregateId,
        ...(eventDef.aggregate_id_field ? { [eventDef.aggregate_id_field]: aggregateId } : {}),
        ...(transitions[0] ? { _state_transition: transitions[0], _state_transitions: transitions } : {}),
      },
      projection_effect: eventDef.projection_effect ?? { target: 'none', operation: 'no_op' },
      audit: {
        constitutional_rules_referenced: eventDef.constitutional_refs ?? ['INV-001', 'INV-005', 'INV-008'],
        enforcement_actions: ['kernel_executor', 'instruction_evaluator', 'atomic_commit'],
        retention_class: eventDef.retention_class ?? 'permanent',
      },
    };
  }
}
