import fs from 'fs';
import { randomUUID } from 'node:crypto';
import type { EventStore } from '../server/eventStore.js';
import { SagaInstance, SagaRegistry, StepRecord } from './saga-registry.js';
import { SagaPayloadMapper } from './saga-payload-mapper.js';

export interface SagaDefinition {
  id: string;
  saga_id: string;
  domain: string;
  compensation_strategy: string;
  compensation_model: string;
  trigger?: any;
  steps: SagaStepDefinition[];
  final_states?: string[];
}

export interface SagaStepDefinition {
  step: number;
  step_id: string;
  name: string;
  step_type: string;
  command?: string | null;
  domain?: string;
  target_domain?: string;
  compensation_command?: string | null;
  required_capability?: string;
  required_scope?: string;
  payload_mapping?: Record<string, any>;
  compensation_payload_mapping?: Record<string, any>;
  timeout_ms?: number;
  timeout_seconds?: number;
  on_failure?: string;
  on_timeout?: string;
  produces_events?: string[];
}

export interface SagaContext {
  actor?: { identity_id?: string; actor_id?: string; actor_type?: string; session_id?: string };
  payload?: Record<string, any>;
  commandBus?: any;
  stepPayloads?: Record<string, any>;
  capabilities?: Record<string, string>;
  scopes?: Record<string, string>;
  simulateFailureAtStep?: number;
  dryRun?: boolean;
  expiration?: string;
  journal_id?: string;
  transaction_id?: string;
}

export interface SagaStartParams {
  sagaName: string;
  correlationId: string;
  initiatingCommand?: any;
  context: SagaContext;
}

export interface SagaAdvanceResult { instance: SagaInstance; state: SagaInstance['currentState']; }
export interface CompensationResult { instance: SagaInstance; compensated: boolean; }

export class SagaInterpreter {
  private definitions = new Map<string, SagaDefinition>();
  private payloadMapper = new SagaPayloadMapper();

  constructor(
    definitions: SagaDefinition[],
    private readonly registry: SagaRegistry,
    private readonly eventStore: EventStore,
  ) {
    for (const def of definitions) {
      this.definitions.set(def.saga_id, def);
      this.definitions.set(def.id, def);
    }
  }

  static fromIR(irPath: string, registry: SagaRegistry, eventStore: EventStore): SagaInterpreter {
    const ir = JSON.parse(fs.readFileSync(irPath, 'utf8'));
    const definitions = (ir.nodes ?? []).filter((n: any) => n.type === 'saga') as SagaDefinition[];
    return new SagaInterpreter(definitions, registry, eventStore);
  }

  listSagas(): SagaDefinition[] {
    return [...new Set(this.definitions.values())].sort((a, b) => a.saga_id.localeCompare(b.saga_id));
  }

  async start(params: SagaStartParams): Promise<SagaInstance> {
    const definition = this.definitions.get(params.sagaName);
    if (!definition) throw new Error(`SAGA_DEFINITION_NOT_FOUND: ${params.sagaName}`);

    const now = new Date().toISOString();
    const instance = this.registry.create({
      sagaId: randomUUID(),
      sagaName: definition.saga_id,
      correlationId: params.correlationId,
      currentStep: 0,
      currentState: 'RUNNING',
      completedSteps: [],
      failedSteps: [],
      compensationSteps: [],
      context: params.context,
      startedAt: now,
      updatedAt: now,
    });

    await this.emitSagaEvent('saga.started', instance, { saga: definition.saga_id, initiatingCommand: params.initiatingCommand?.command_name ?? params.initiatingCommand?.commandName });

    for (const step of definition.steps) {
      try {
        const result = await this.executeStep(instance, step, params.context);
        instance.completedSteps.push(result);
        instance.currentStep = step.step;
        await this.emitSagaEvent(`saga.step.${step.step}.completed`, instance, { step, result });
      } catch (error: any) {
        const failed: StepRecord = { step: step.step, stepId: step.step_id, name: step.name, command: step.command, state: 'FAILED', events: [], error: error?.message ?? String(error) };
        instance.failedSteps.push(failed);
        instance.currentStep = step.step;
        instance.currentState = 'FAILED';
        this.registry.update(instance.sagaId, instance);
        await this.emitSagaEvent(`saga.step.${step.step}.failed`, instance, { step, error: failed.error });
        return (await this.compensate({ sagaId: instance.sagaId, reason: failed.error ?? 'step_failed', context: params.context })).instance;
      }
    }

    instance.currentState = 'COMPLETED';
    instance.updatedAt = new Date().toISOString();
    this.registry.update(instance.sagaId, instance);
    await this.emitSagaEvent('saga.completed', instance, { completedSteps: instance.completedSteps.length });
    return instance;
  }

  async advance(params: { sagaId: string; stepResult: any; context: SagaContext }): Promise<SagaAdvanceResult> {
    const instance = await this.getState(params.sagaId);
    this.registry.update(params.sagaId, { currentStep: instance.currentStep + 1 });
    return { instance: await this.getState(params.sagaId), state: instance.currentState };
  }

  async compensate(params: { sagaId: string; reason: string; context: SagaContext }): Promise<CompensationResult> {
    const instance = await this.getState(params.sagaId);
    const definition = this.definitions.get(instance.sagaName)!;
    instance.currentState = 'COMPENSATING';
    this.registry.update(instance.sagaId, instance);
    await this.emitSagaEvent('saga.compensating', instance, { reason: params.reason });

    const completed = [...instance.completedSteps].reverse();
    for (const completedStep of completed) {
      const stepDef = definition.steps.find(s => s.step === completedStep.step);
      if (!stepDef?.compensation_command) continue;
      const record = await this.executeCompensation(instance, stepDef, params.context);
      instance.compensationSteps.push(record);
      await this.emitSagaEvent(`saga.compensation.step.${stepDef.step}.completed`, instance, { step: stepDef, compensation: record });
    }

    instance.currentState = 'COMPENSATED';
    instance.updatedAt = new Date().toISOString();
    this.registry.update(instance.sagaId, instance);
    await this.emitSagaEvent('saga.compensated', instance, { reason: params.reason, compensationSteps: instance.compensationSteps.length });
    return { instance, compensated: true };
  }

  async getState(sagaId: string): Promise<SagaInstance> {
    const instance = this.registry.get(sagaId);
    if (!instance) throw new Error(`SAGA_NOT_FOUND: ${sagaId}`);
    return instance;
  }

  private async executeStep(instance: SagaInstance, step: SagaStepDefinition, context: SagaContext): Promise<StepRecord> {
    if (!step.command) {
      return { step: step.step, stepId: step.step_id, name: step.name, command: step.command, state: 'COMPLETED', events: step.produces_events ?? [] };
    }
    if (!context.commandBus) throw new Error('SAGA_COMMAND_BUS_REQUIRED');
    const payload = context.stepPayloads?.[step.command]
      ?? this.payloadMapper.map({
        sagaId: instance.sagaId,
        correlationId: instance.correlationId,
        sagaName: instance.sagaName,
        step,
        sagaPayload: context.payload ?? {},
        sagaContext: context,
        previousStepResults: instance.completedSteps,
      });
    const result = await this.submitCommand(step.command, step, context, instance, payload);
    if (result.status !== 'ACCEPTED') throw new Error(result.error ?? `saga step ${step.step} failed`);
    return { step: step.step, stepId: step.step_id, name: step.name, command: step.command, state: 'COMPLETED', events: result.events ?? [], result } as any;
  }

  private async executeCompensation(instance: SagaInstance, step: SagaStepDefinition, context: SagaContext): Promise<StepRecord> {
    if (!step.compensation_command) {
      return { step: step.step, stepId: step.step_id, name: step.name, command: step.compensation_command, state: 'SKIPPED', events: [] };
    }
    if (!context.commandBus) throw new Error('SAGA_COMMAND_BUS_REQUIRED');
    const originalStepResult = instance.completedSteps.find(s => s.step === step.step);
    const payload = context.stepPayloads?.[step.compensation_command]
      ?? this.payloadMapper.mapCompensation({
        sagaId: instance.sagaId,
        correlationId: instance.correlationId,
        sagaName: instance.sagaName,
        step,
        sagaPayload: context.payload ?? {},
        sagaContext: context,
        previousStepResults: instance.completedSteps,
        originalStepResult,
      });
    const result = await this.submitCommand(step.compensation_command, step, context, instance, payload, true);
    return { step: step.step, stepId: step.step_id, name: step.name, command: step.compensation_command, state: result.status === 'ACCEPTED' ? 'COMPENSATED' : 'FAILED', events: result.events ?? [], error: result.error, result } as any;
  }

  private async submitCommand(commandName: string, step: SagaStepDefinition, context: SagaContext, instance: SagaInstance, payload: Record<string, any>, compensation = false): Promise<any> {
    const domain = commandName.split('.')[0];
    const aggregate = commandName.split('.')[1] ?? step.target_domain ?? domain;
    const systemActor = { identity_id: 'system', actor_id: 'system', actor_type: 'system', session_id: `saga:${instance.sagaId}` };
    return context.commandBus.submit({
      command_id: randomUUID(),
      command_name: commandName,
      aggregate,
      source_domain: domain,
      payload: { ...payload, saga_id: instance.sagaId, saga_compensation: compensation },
      identity_context: context.actor?.actor_type === 'system' ? context.actor : systemActor,
      capability_id: context.capabilities?.[commandName] ?? step.required_capability ?? 'system.internal',
      scope: context.scopes?.[commandName] ?? step.required_scope ?? '*',
      correlation_id: instance.correlationId,
      causation_id: instance.sagaId,
      meta: { saga_id: instance.sagaId, saga_step: step.step, saga_compensation: compensation },
    });
  }

  private async emitSagaEvent(eventName: string, instance: SagaInstance, payload: Record<string, any>): Promise<void> {
    await Promise.resolve(this.eventStore.append({
      event_name: eventName,
      aggregate: 'saga_instance',
      aggregate_id: instance.sagaId,
      source_domain: 'kernel',
      command_id: randomUUID(),
      triggering_command: 'saga.interpreter',
      causation_id: instance.correlationId,
      correlation_id: instance.correlationId,
      actor_id: instance.context?.actor?.actor_id ?? 'saga',
      identity_context: instance.context?.actor ?? { identity_id: 'saga', actor_type: 'system', session_id: 'saga' },
      policy_decision_id: randomUUID(),
      capability_id: 'system.internal',
      payload: { sagaId: instance.sagaId, sagaName: instance.sagaName, state: instance.currentState, ...payload },
      projection_effect: { target: 'none', operation: 'no_op' },
      audit: { constitutional_rules_referenced: ['INV-001', 'INV-005', 'INV-008'], enforcement_actions: ['saga_interpreter'], retention_class: 'permanent' },
    }));
  }
}
