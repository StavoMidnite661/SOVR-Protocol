// ============================================================
// Command Bus — 7-Stage Constitutional Pipeline + Guardrail Bus
// INV-008: No command executes without identity + capability + scope + policy
// INV-002: Double-entry balance check
// INV-003: Authority boundary
// INV-004: Agent cannot create financial authority
// INV-005: Audit trail completeness
// INV-010: No autonomous bypass
// PRODUCTION: required_payload actually validated; unknown commands
// produce failure events; null-payload events are not silently dropped.
// ============================================================

import { EventStore, EventEnvelope, AppendInput } from './eventStore.js';
import { CapabilityEngine } from './capabilityEngine.js';
import { ProjectionEngine } from './projectionEngine.js';
import {
  ExecutionContext,
  GuardrailCommandBus,
  StateMachineInterpreter,
  StateRegistry,
  EventFactory,
  AtomicCommit,
  AtomicCommitFailureError,
  InstructionEvaluator,
  KernelExecutor,
  TransactionEffects,
  TransitionResult,
} from '../execution/index.js';
import { registerAssertionHandlers } from '../boot/assertion-registry.js';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export interface CommandEnvelope {
  command_id: string;
  command_name: string;
  aggregate: string;
  source_domain: string;
  payload: any;
  identity_context: {
    identity_id: string;
    actor_id: string;
    actor_type: string;
    session_id?: string;
    agent_id?: string;
    model_version?: string;
  };
  capability_id: string;
  scope: string;
  correlation_id: string;
  causation_id: string;
  meta?: any;
}

export interface GateResult { passed: boolean; reason?: string; policy_decision_id?: string; }

export class ConstitutionalViolationError extends Error {
  constructor(readonly violations: string[]) {
    super(`ConstitutionalViolationError: ${violations.join('; ')}`);
    this.name = 'ConstitutionalViolationError';
  }
}

export class InvalidStateTransitionError extends Error {
  constructor(
    readonly aggregate: string,
    readonly aggregateId: string,
    readonly currentState: string,
    readonly trigger: string,
    readonly reason?: string,
  ) {
    super(`InvalidStateTransitionError: ${aggregate}:${aggregateId} in ${currentState} does not accept ${trigger}${reason ? ` (${reason})` : ''}`);
    this.name = 'InvalidStateTransitionError';
  }
}

export class UncoveredCommandError extends Error {
  constructor(readonly commandName: string) {
    super(`UncoveredCommandError: Command ${commandName} has no state machine coverage and is not declared lifecycle_exempt`);
    this.name = 'UncoveredCommandError';
  }
}

interface CommandCoverage {
  commandName: string;
  hasMachine: boolean;
  isExempt: boolean;
  machine?: string;
  exemption?: any;
}

interface PlannedEvent {
  eventName: string;
  aggregate: string;
  aggregateId: string;
  sourceDomain: string;
  payload: Record<string, unknown>;
  projectionEffect: any;
  transitions: TransitionResult[];
}

interface ExecutionPlan {
  events: PlannedEvent[];
  transitions: TransitionResult[];
  effects: TransactionEffects;
}

export class CommandBus {
  private commandCatalog: any;
  private eventCatalog: any;
  private constitution: any;
  private guardrailBus!: GuardrailCommandBus;
  private stateMachineInterpreter!: StateMachineInterpreter;
  private stateRegistry!: StateRegistry;
  private eventFactory!: EventFactory;
  private atomicCommit!: AtomicCommit;
  private instructionEvaluator!: InstructionEvaluator;
  private kernelExecutor!: KernelExecutor;
  private commandCoverage = new Map<string, CommandCoverage>();
  private readyPromise: Promise<void>;
  private initialized = false;

  constructor(
    private protocolRoot: string,
    private eventStore: EventStore,
    private capabilityEngine: CapabilityEngine,
    private projectionEngine: ProjectionEngine
  ) {
    this.loadCatalogs();
    this.readyPromise = this.initializeSpecDrivenExecution();
  }

  private loadCatalogs() {
    try {
      this.commandCatalog = yaml.load(fs.readFileSync(path.join(this.protocolRoot, '03_command-catalog.yaml'), 'utf8')) as any;
      this.eventCatalog = yaml.load(fs.readFileSync(path.join(this.protocolRoot, '04_event-catalog.yaml'), 'utf8')) as any;
      this.constitution = yaml.load(fs.readFileSync(path.join(this.protocolRoot, '01_constitution.yaml'), 'utf8')) as any;
    } catch (e) {
      // Fail-closed: if catalogs cannot be loaded, we cannot enforce INV-008.
      // The empty catalogs will cause every command to be rejected with VALIDATION errors.
      console.error('CommandBus catalog load FAILED — running in fail-closed mode:', e);
      this.commandCatalog = { commands: {} };
      this.eventCatalog = { events: {}, event_envelope: { fields: {} } };
    }
  }

  private async initializeSpecDrivenExecution() {
    this.guardrailBus = new GuardrailCommandBus();
    this.stateMachineInterpreter = StateMachineInterpreter.fromFiles(
      path.join(this.protocolRoot, 'generated', 'sovr-ir.json'),
    );
    this.stateRegistry = new StateRegistry((domain, aggregate) => {
      const machine = domain ? this.stateMachineInterpreter.getMachineFor(domain, aggregate) : undefined;
      return machine?.initialState;
    });
    await this.stateRegistry.rebuildFromEventLog(this.eventStore);
    this.eventFactory = new EventFactory(this.eventCatalog);
    this.atomicCommit = new AtomicCommit();
    this.instructionEvaluator = new InstructionEvaluator();
    registerAssertionHandlers(this.instructionEvaluator, this.stateRegistry, this.eventStore, this.capabilityEngine);
    this.kernelExecutor = new KernelExecutor(this.instructionEvaluator, this.stateRegistry, this.atomicCommit, this.capabilityEngine, this.eventStore);
    this.commandCoverage = this.buildCommandCoverage();
    this.initialized = true;
  }

  async ready(): Promise<void> {
    await this.readyPromise;
  }

  stateRegistryStatus() {
    return this.stateRegistry.getRebuildStatus();
  }

  isReady(): boolean {
    return this.initialized && this.stateRegistry.isReady();
  }

  private gate(cmd: CommandEnvelope, name: string, fn: () => GateResult): GateResult {
    const r = fn();
    if (!r.passed) console.log(`⛔ ${name} rejected: ${r.reason}`);
    return r;
  }

  private normalizeCommandEnvelope(cmd: CommandEnvelope): CommandEnvelope {
    const commandName = this.normalizeCommandName(cmd.command_name, cmd.source_domain);
    const cmdDef = this.commandCatalog.commands?.[commandName];
    return {
      ...cmd,
      command_name: commandName,
      source_domain: cmdDef?.source_domain ?? cmd.source_domain ?? commandName.split('.')[0],
      aggregate: cmdDef?.aggregate ?? cmd.aggregate,
      payload: cmd.payload ?? {},
    };
  }

  private normalizeCommandName(name: string, sourceDomain?: string): string {
    if (this.commandCatalog.commands?.[name]) return name;
    if (sourceDomain) {
      const prefixed = `${sourceDomain}.${name}`;
      if (this.commandCatalog.commands?.[prefixed]) return prefixed;
    }
    return name;
  }

  private buildCommandCoverage(): Map<string, CommandCoverage> {
    const map = new Map<string, CommandCoverage>();
    const exemptions = this.commandCatalog.command_lifecycle_coverage?.lifecycle_exemptions ?? {};
    for (const [commandName, cmdDef] of Object.entries(this.commandCatalog.commands ?? {}) as Array<[string, any]>) {
      const domain = cmdDef.source_domain ?? commandName.split('.')[0];
      const aggregate = cmdDef.aggregate;
      const machine = aggregate ? this.stateMachineInterpreter.getMachineFor(domain, aggregate) : undefined;
      const exemption = exemptions[commandName] ?? (cmdDef.lifecycle_exempt ? cmdDef : undefined);
      map.set(commandName, {
        commandName,
        hasMachine: Boolean(machine),
        isExempt: Boolean(exemption?.lifecycle_exempt ?? cmdDef.lifecycle_exempt),
        machine: machine?.name,
        exemption,
      });
    }
    return map;
  }

  getCommandCoverage(commandName: string): CommandCoverage {
    return this.commandCoverage.get(commandName) ?? {
      commandName,
      hasMachine: false,
      isExempt: false,
    };
  }

  // Gate 1: Identity verification
  private identityGate(cmd: CommandEnvelope): GateResult {
    if (!cmd.identity_context?.identity_id || !cmd.identity_context?.actor_id) {
      return { passed: false, reason: 'UNAUTHENTICATED: missing identity_context' };
    }
    const cmdDef = this.commandCatalog.commands[cmd.command_name];
    if (cmdDef?.issuer?.actor_types && Array.isArray(cmdDef.issuer.actor_types)) {
      if (!cmdDef.issuer.actor_types.includes(cmd.identity_context.actor_type)) {
        return {
          passed: false,
          reason: `UNAUTHORIZED ACTOR TYPE: ${cmd.identity_context.actor_type} not in ${cmdDef.issuer.actor_types.join(',')}`,
        };
      }
    }
    return { passed: true };
  }

  // Gate 2+3: Capability + Scope
  private capabilityGate(cmd: CommandEnvelope): GateResult {
    if (cmd.capability_id === 'system.internal' && cmd.identity_context.actor_type === 'system') {
      return { passed: true };
    }
    const ok = this.capabilityEngine.check(cmd.identity_context.actor_id, cmd.capability_id, cmd.scope);
    if (!ok) {
      return {
        passed: false,
        reason: `CAPABILITY DENIED: ${cmd.identity_context.actor_id} lacks ${cmd.capability_id} scoped to ${cmd.scope}`,
      };
    }
    return { passed: true };
  }

  // Gate 4: Policy evaluation (deterministic pure function)
  private policyGate(cmd: CommandEnvelope): GateResult {
    const decisionId = crypto.randomUUID();
    const amount = Number(cmd.payload?.amount || cmd.payload?.face_value || 0);

    // INV-004: ai_agent cannot issue large-value commands (>1M) without escalation
    if (amount > 1_000_000 && cmd.identity_context.actor_type === 'ai_agent') {
      return {
        passed: false,
        reason: 'POLICY ESCALATE: amount exceeds agent limit, mandatory escalation per INV-004',
        policy_decision_id: decisionId,
      };
    }

    return { passed: true, policy_decision_id: decisionId };
  }

  // Additional constitutional checks not yet covered by generated GuardrailBus.
  private constitutionalGate(cmd: CommandEnvelope): GateResult {
    // INV-004: agent cannot grant authority
    if (cmd.identity_context.actor_type === 'ai_agent') {
      if (cmd.command_name.includes('capability.grant') || cmd.command_name.includes('capability.bind') || cmd.command_name.includes('trust_anchor.register')) {
        return { passed: false, reason: 'INV-004: ai_agent cannot create/grant financial authority' };
      }
    }
    return { passed: true };
  }

  /** Gate 6: Real required_payload validation. Returns the first missing field or null. */
  private validateRequiredPayload(cmd: CommandEnvelope): { ok: true } | { ok: false; missing: string } {
    const cmdDef = this.commandCatalog.commands[cmd.command_name];
    if (!cmdDef) return { ok: true }; // unknown command handled in executeUnknownCommand
    const required: string[] = (cmdDef.required_payload || []).filter((x: any) => typeof x === 'string');
    for (const field of required) {
      if (cmd.payload?.[field] === undefined && (cmd.payload?.payload?.[field] === undefined)) {
        return { ok: false, missing: field };
      }
    }
    return { ok: true };
  }

  private buildExecutionContext(cmd: CommandEnvelope, policyDecisionId: string): ExecutionContext<CommandEnvelope> {
    return {
      identity: {
        identityId: cmd.identity_context.identity_id,
        actorId: cmd.identity_context.actor_id,
        actorType: cmd.identity_context.actor_type as any,
        trustLevel: 'HIGH',
        sessionId: cmd.identity_context.session_id ?? 'unknown',
      },
      policyDecision: { decisionId: policyDecisionId, decision: 'ALLOW', deterministicHash: `policy:${policyDecisionId}` },
      capabilities: [{ capabilityId: cmd.capability_id, scopePattern: cmd.scope }],
      correlationId: cmd.correlation_id,
      causationId: cmd.causation_id,
      traceId: cmd.meta?.traceId ?? cmd.correlation_id,
      auditContext: { retentionClass: 'permanent', constitutionalRules: ['INV-001', 'INV-002', 'INV-003', 'INV-005', 'INV-008'] },
      command: cmd,
      commandId: cmd.command_id,
      constitutionalGates: { identity: true, capability: true, scope: true, policy: true },
    };
  }

  private async executeUnknownCommand(cmd: CommandEnvelope, policyDecisionId: string): Promise<{ events: EventEnvelope[]; success: boolean; error?: string; eventsEmitted: number }> {
    const ev = this.eventStore.append({
      event_name: 'system.command.unknown',
      aggregate: cmd.aggregate || 'unknown',
      aggregate_id: cmd.payload?.asset_id || cmd.payload?.order_id || crypto.randomUUID(),
      source_domain: cmd.source_domain || 'unknown',
      command_id: cmd.command_id,
      triggering_command: cmd.command_name,
      causation_id: cmd.causation_id,
      correlation_id: cmd.correlation_id,
      actor_id: cmd.identity_context.actor_id,
      identity_context: cmd.identity_context,
      policy_decision_id: policyDecisionId,
      capability_id: cmd.capability_id,
      payload: { attempted_command: cmd.command_name, reason: 'unknown_command' },
      projection_effect: { target: 'none', operation: 'no_op' },
      audit: { constitutional_rules_referenced: ['INV-008'], retention_class: 'permanent' },
    });
    return { success: false, error: `Unknown command ${cmd.command_name}`, events: [ev], eventsEmitted: 1 };
  }

  private commandSuccessEvents(cmd: CommandEnvelope): string[] {
    const cmdDef = this.commandCatalog.commands[cmd.command_name];
    return cmdDef?.resulting_events?.success || cmdDef?.produces_events || [];
  }

  private resolveEventAggregateId(cmd: CommandEnvelope, eventDef: any, aggregate: string): string {
    const payload = cmd.payload ?? {};
    const field = eventDef?.aggregate_id_field || `${aggregate}_id`;
    return String(
      payload[field]
      ?? payload[`${aggregate}_id`]
      ?? payload.asset_id
      ?? payload.reservation_id
      ?? payload.order_id
      ?? payload.entry_id
      ?? payload.journal_id
      ?? payload.identity_id
      ?? crypto.randomUUID()
    );
  }

  private resolveMachineAggregateId(cmd: CommandEnvelope, aggregate: string, fallback?: string): string | undefined {
    const payload = cmd.payload ?? {};
    return payload[`${aggregate}_id`]
      ?? (aggregate === 'asset' ? payload.asset_id : undefined)
      ?? (aggregate === 'reservation' ? payload.reservation_id : undefined)
      ?? (aggregate === 'journal_entry' ? (payload.entry_id ?? payload.journal_id) : undefined)
      ?? fallback;
  }

  private transitionConditionsForTriggers(triggers: string[]): Record<string, boolean> {
    const conditions: Record<string, boolean> = {};
    const trivial = new Set(['', 'none', 'always', 'true', 'n/a', 'not_applicable']);
    for (const machine of this.stateMachineInterpreter.listMachines()) {
      for (const transition of Object.values(machine.transitions) as any[]) {
        const trigger = transition?.trigger ?? transition?.command;
        if (!triggers.includes(trigger)) continue;
        const condition = String(transition?.condition ?? '').trim();
        if (!condition || trivial.has(condition.toLowerCase())) continue;
        conditions[condition] = true;
      }
    }
    return conditions;
  }

  private hasTransitionTrigger(machine: any, trigger: string): boolean {
    return Object.values(machine.transitions ?? {}).some((t: any) => (t?.trigger ?? t?.command) === trigger);
  }

  private syntheticInitialTransition(machine: any, aggregateId: string, trigger: string): TransitionResult {
    const toState = machine.initialState;
    const toDef = machine.states?.[toState] ?? {};
    return {
      accepted: true,
      machineId: machine.id,
      machineName: machine.name,
      domain: machine.domain,
      aggregate: machine.aggregate,
      aggregateId,
      transitionName: `INIT_to_${toState}`,
      trigger,
      fromState: 'INIT',
      toState,
      emittedEvents: [trigger],
      entryActions: [...(toDef.entry_actions ?? [])],
      exitActions: [],
      isFinal: machine.finalStates.includes(toState),
      condition: 'initial_state',
    };
  }

  private async resolveTransitionsForEvent(cmd: CommandEnvelope, eventName: string, eventDef: any, aggregate: string, aggregateId: string, sourceDomain: string): Promise<TransitionResult[]> {
    const transitions: TransitionResult[] = [];
    const context = {
      command: cmd,
      actor: cmd.identity_context,
      conditions: {
        ...this.transitionConditionsForTriggers([eventName, cmd.command_name]),
        ...(cmd.payload?.conditions ?? {}),
      },
      facts: {
        ...(cmd.payload?.facts ?? {}),
      },
    };

    const primaryMachine = this.stateMachineInterpreter.getMachineFor(sourceDomain, aggregate);
    if (primaryMachine) {
      if (this.stateRegistry.hasState(aggregate, aggregateId, sourceDomain)) {
        const currentState = await this.stateRegistry.getState(aggregate, aggregateId, sourceDomain);
        const result = this.stateMachineInterpreter.execute({
          domain: sourceDomain,
          aggregate,
          aggregateId,
          currentState,
          trigger: eventName,
          context,
        });
        if (!result.accepted) {
          throw new InvalidStateTransitionError(aggregate, aggregateId, currentState, eventName, result.reason);
        }
        transitions.push(result);
      } else {
        transitions.push(this.syntheticInitialTransition(primaryMachine, aggregateId, eventName));
      }
    }

    for (const machine of this.stateMachineInterpreter.listMachines()) {
      if (machine.domain !== sourceDomain || machine.aggregate === aggregate) continue;
      if (!this.hasTransitionTrigger(machine, eventName)) continue;
      const relatedId = this.resolveMachineAggregateId(cmd, machine.aggregate);
      if (!relatedId) continue;
      if (!this.stateRegistry.hasState(machine.aggregate, relatedId, sourceDomain)) {
        continue;
      }
      const currentState = await this.stateRegistry.getState(machine.aggregate, relatedId, sourceDomain);
      const result = this.stateMachineInterpreter.execute({
        domain: sourceDomain,
        aggregate: machine.aggregate,
        aggregateId: relatedId,
        currentState,
        trigger: eventName,
        context,
      });
      if (!result.accepted) {
        throw new InvalidStateTransitionError(machine.aggregate, relatedId, currentState, eventName, result.reason);
      }
      transitions.push(result);
    }

    return transitions;
  }

  private extractJournalEntries(cmd: CommandEnvelope): Array<{ debits: number; credits: number }> | undefined {
    if (cmd.command_name !== 'ledger.entry.post') return undefined;
    const postings = Array.isArray(cmd.payload?.postings) ? cmd.payload.postings : [];
    if (postings.length === 0) return undefined;
    const debits = postings
      .filter((p: any) => String(p.direction ?? p.type ?? '').toUpperCase() === 'DEBIT')
      .reduce((a: number, p: any) => a + Number(p.amount || 0), 0);
    const credits = postings
      .filter((p: any) => String(p.direction ?? p.type ?? '').toUpperCase() === 'CREDIT')
      .reduce((a: number, p: any) => a + Number(p.amount || 0), 0);
    return [{ debits, credits }];
  }

  private async planExecution(cmd: CommandEnvelope, coverage: CommandCoverage): Promise<ExecutionPlan> {
    const successEvents = this.commandSuccessEvents(cmd);
    const plannedEvents: PlannedEvent[] = [];
    const transitions: TransitionResult[] = [];

    for (const eventName of successEvents) {
      const eventDef = this.eventCatalog.events?.[eventName];
      if (!eventDef) {
        plannedEvents.push({
          eventName: 'system.event.definition_missing',
          aggregate: cmd.aggregate,
          aggregateId: cmd.payload?.asset_id || cmd.payload?.order_id || crypto.randomUUID(),
          sourceDomain: cmd.source_domain,
          payload: { missing_event: eventName, command: cmd.command_name },
          projectionEffect: { target: 'none', operation: 'no_op' },
          transitions: [],
        });
        continue;
      }

      const aggregate = eventDef.aggregate ?? cmd.aggregate;
      const sourceDomain = eventDef.source_domain ?? cmd.source_domain;
      const aggregateId = this.resolveEventAggregateId(cmd, eventDef, aggregate);
      const eventTransitions = coverage.isExempt
        ? []
        : await this.resolveTransitionsForEvent(cmd, eventName, eventDef, aggregate, aggregateId, sourceDomain);
      transitions.push(...eventTransitions);
      plannedEvents.push({
        eventName,
        aggregate,
        aggregateId,
        sourceDomain,
        payload: { ...cmd.payload, [`${aggregate}_id`]: aggregateId },
        projectionEffect: eventDef.projection_effect ?? { target: 'none', operation: 'no_op' },
        transitions: eventTransitions,
      });
    }

    const effects: TransactionEffects = {
      emittedEvents: plannedEvents.map(e => ({ eventName: e.eventName, payload: e.payload })),
      mutations: transitions.map(t => ({
        table: 'state_registry',
        key: `${t.domain}:${t.aggregate}:${t.aggregateId}`,
        oldValue: t.fromState,
        newValue: t.toState,
      })),
      journalEntries: this.extractJournalEntries(cmd),
    };

    return { events: plannedEvents, transitions, effects };
  }

  private async persistPlan(cmd: CommandEnvelope, plan: ExecutionPlan): Promise<EventEnvelope[]> {
    const eventInputs: AppendInput[] = plan.events.map(planned => this.eventFactory.build({
      eventName: planned.eventName,
      command: cmd,
      aggregate: planned.aggregate,
      aggregateId: planned.aggregateId,
      sourceDomain: planned.sourceDomain,
      actor: cmd.identity_context,
      payload: planned.payload,
      projectionEffect: planned.projectionEffect,
      transition: planned.transitions,
    }));

    const stateUpdates = plan.transitions
      .filter(t => t.aggregate && t.aggregateId && t.domain && t.toState)
      .map(transition => ({
        domain: transition.domain,
        aggregate: transition.aggregate!,
        id: transition.aggregateId!,
        state: transition.toState!,
        transition: {
          domain: transition.domain,
          aggregate: transition.aggregate!,
          aggregateId: transition.aggregateId!,
          fromState: transition.fromState ?? 'UNKNOWN',
          toState: transition.toState!,
          trigger: transition.trigger,
          machineId: transition.machineId,
          machineName: transition.machineName,
          transitionName: transition.transitionName,
          commandId: cmd.command_id,
          correlationId: cmd.correlation_id,
          eventName: transition.trigger,
        },
      }));

    const result = await this.atomicCommit.execute({
      stateUpdates,
      events: eventInputs,
      stateRegistry: this.stateRegistry,
      eventStore: this.eventStore,
    });

    for (const envelope of result.events) {
      this.projectionEngine.handleEvent(envelope);
    }

    return result.events;
  }

  async submit(cmdInput: CommandEnvelope): Promise<{ status: 'ACCEPTED' | 'REJECTED'; commandId: string; correlationId: string; events: EventEnvelope[]; gates: any; error?: string; error_type?: string; eventsEmitted?: number; transitionResult?: TransitionResult; transitions?: TransitionResult[] }> {
    await this.ready();
    const cmd = this.normalizeCommandEnvelope(cmdInput);
    const gates: any = {};

    const g1 = this.gate(cmd, 'gate1_identity', () => this.identityGate(cmd));
    gates.identity = g1;
    if (!g1.passed) return { status: 'REJECTED', commandId: cmd.command_id, correlationId: cmd.correlation_id, events: [], gates, error: g1.reason };

    const g2 = this.gate(cmd, 'gate2_capability_scope', () => this.capabilityGate(cmd));
    gates.capability_scope = g2;
    if (!g2.passed) return { status: 'REJECTED', commandId: cmd.command_id, correlationId: cmd.correlation_id, events: [], gates, error: g2.reason };

    const g4 = this.gate(cmd, 'gate4_policy', () => this.policyGate(cmd));
    gates.policy = g4;
    if (!g4.passed) return { status: 'REJECTED', commandId: cmd.command_id, correlationId: cmd.correlation_id, events: [], gates, error: g4.reason };

    if (!this.commandCatalog.commands[cmd.command_name]) {
      const result = await this.executeUnknownCommand(cmd, g4.policy_decision_id!);
      return { status: 'REJECTED', commandId: cmd.command_id, correlationId: cmd.correlation_id, events: result.events, gates, error: result.error, eventsEmitted: result.eventsEmitted };
    }

    const coverage = this.getCommandCoverage(cmd.command_name);
    if (!coverage.hasMachine && !coverage.isExempt) {
      const uncovered = new UncoveredCommandError(cmd.command_name);
      return { status: 'REJECTED', commandId: cmd.command_id, correlationId: cmd.correlation_id, events: [], gates, error: uncovered.message, error_type: uncovered.name, eventsEmitted: 0 };
    }

    const commandForExecution: CommandEnvelope = coverage.isExempt
      ? { ...cmd, meta: { ...(cmd.meta ?? {}), lifecycle_exempt: true, lifecycle_exempt_reason: coverage.exemption?.lifecycle_exempt_reason, lifecycle_exempt_governance_ref: coverage.exemption?.lifecycle_exempt_governance_ref, policy_decision_id: g4.policy_decision_id } }
      : { ...cmd, meta: { ...(cmd.meta ?? {}), policy_decision_id: g4.policy_decision_id } };

    const g5 = this.gate(commandForExecution, 'gate5_constitutional', () => this.constitutionalGate(commandForExecution));
    gates.constitutional = g5;
    if (!g5.passed) return { status: 'REJECTED', commandId: commandForExecution.command_id, correlationId: commandForExecution.correlation_id, events: [], gates, error: g5.reason };

    try {
      const result = await this.kernelExecutor.execute(commandForExecution) as any;
      for (const event of result.events) this.projectionEngine.handleEvent(event);
      return { ...result, gates };
    } catch (error: any) {
      const raw = error?.message ?? String(error);
      const normalized = raw.includes('INV_002') || raw.includes('postings must balance')
        ? `ConstitutionalViolationError: INV-002 VIOLATION: ${raw}`
        : (error?.name === 'KernelValidationError' && String((error as any).code ?? '').startsWith('MISSING_'))
          ? `VALIDATION: required field '${String((error as any).code).replace(/^MISSING_/, '').toLowerCase()}' is missing`
          : raw;
      const errorType = normalized.includes('INV-002') ? 'ConstitutionalViolationError' : (error?.name ?? 'KernelExecutionError');
      return { status: 'REJECTED', commandId: commandForExecution.command_id, correlationId: commandForExecution.correlation_id, events: [], gates, error: normalized, error_type: errorType, eventsEmitted: 0 };
    }
  }

}
