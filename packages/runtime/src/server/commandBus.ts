// ============================================================
// Command Bus — identity/capability/policy gates then KernelExecutor.
// Sole execution authority: compiled registries → KernelExecutor.
// ============================================================

import { EventStore, EventEnvelope } from './eventStore.js';
import { CapabilityEngine } from './capabilityEngine.js';
import { ProjectionEngine } from './projectionEngine.js';
import {
  StateRegistry,
  AtomicCommit,
  InstructionEvaluator,
  KernelExecutor,
  TransitionResult,
  AuthorityBoundaryEnforcer,
  ExecutionGateEnforcer,
  TimeWindowGate,
  AmountWithinLimitGate,
  CapabilityBoundaryEnforcer,
  StateSovereigntyEnforcer,
  SagaCompensationEnforcer,
  ConstitutionalSupremacyEnforcer,
} from '../execution/index.js';
import { registerAssertionHandlers } from '../boot/assertion-registry.js';
import { PostgreSQLEventStore } from '../adapters/postgres-event-store.js';
import { JsonRegistryLoader } from '../authority/authority-loader.js';
import { CommandAuthority } from '../authority/command-authority.js';
import { EventAuthority } from '../authority/event-authority.js';
import { ConstitutionAuthority } from '../authority/constitution-authority.js';
import type { MachineRegistry } from '../authority/types.js';

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

export class CommandBus {
  private commandAuthority!: CommandAuthority;
  private eventAuthority!: EventAuthority;
  private constitutionAuthority!: ConstitutionAuthority;
  private machinesRegistry!: MachineRegistry;
  private stateRegistry!: StateRegistry;
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
    const loader = new JsonRegistryLoader();
    const registries = loader.loadAll();
    this.commandAuthority = new CommandAuthority(registries.commands);
    this.eventAuthority = new EventAuthority(registries.events, registries.events);
    this.constitutionAuthority = new ConstitutionAuthority(registries.constitution);
    this.machinesRegistry = loader.loadMachines();
  }

  private machineNameFor(domain: string, aggregate: string): string | undefined {
    for (const [name, def] of Object.entries(this.machinesRegistry.entries ?? {}) as Array<[string, any]>) {
      if (name === 'abi' || !def || typeof def !== 'object') continue;
      if (def.domain === domain && def.aggregate === aggregate) return String(def.id ?? name);
    }
    return undefined;
  }

  private initialStateFor(domain: string | undefined, aggregate: string): string | undefined {
    if (!domain) return undefined;
    for (const [name, def] of Object.entries(this.machinesRegistry.entries ?? {}) as Array<[string, any]>) {
      if (name === 'abi' || !def || typeof def !== 'object') continue;
      if (def.domain === domain && def.aggregate === aggregate) {
        return def.initial_state ?? def.initialState;
      }
    }
    return undefined;
  }

  private async initializeSpecDrivenExecution() {
    this.stateRegistry = new StateRegistry((domain: any, aggregate: any) => {
      return this.initialStateFor(domain, aggregate);
    }, {
      usePostgres: this.eventStore instanceof PostgreSQLEventStore,
      databaseUrl: this.eventStore instanceof PostgreSQLEventStore ? (this.eventStore as any).databaseUrl : undefined,
    });
    await this.stateRegistry.rebuildFromEventLog(this.eventStore);
    this.atomicCommit = new AtomicCommit();
    this.instructionEvaluator = new InstructionEvaluator();
    registerAssertionHandlers(this.instructionEvaluator, this.stateRegistry, this.eventStore, this.capabilityEngine);

    const authorityEnforcer = new AuthorityBoundaryEnforcer(
      {
        getActorCapabilities: async (actorId: string) => {
          const grants = await this.capabilityEngine.listGrants(actorId);
          return grants.map((g: any) => ({
            grantId: g.capability_id,
            actorId: g.actor_id,
            capability: g.capability_id,
            scope: g.scope_pattern,
            grantedBy: g.granted_by,
            grantedAt: Date.now(),
            expiresAt: g.expires_at ? new Date(g.expires_at).getTime() : undefined,
            revokedAt: g.revoked_at ? new Date(g.revoked_at).getTime() : undefined,
            constraints: g.conditions?.constraints,
          }));
        },
        isSystemActor: (actorId: string) => ['system'].includes(actorId),
      },
      {
        append: async (evt: any) => {
          const result = await this.eventStore.append(evt);
          return { eventId: result.event_id };
        },
      }
    );

    const evaluators: any[] = [];
    if (process.env.SOVR_TEST_XXIII_GATES === 'true') {
      evaluators.push(new TimeWindowGate(), new AmountWithinLimitGate());
    }

    const gateEnforcer = new ExecutionGateEnforcer(evaluators, {
      append: async (evt: any) => {
        const result = await this.eventStore.append(evt);
        return { eventId: result.event_id };
      },
    });

    const capBoundary = new CapabilityBoundaryEnforcer(this.capabilityEngine as any, {
      append: async (e: any) => { const r = await this.eventStore.append(e); return { eventId: r.event_id }; }
    });
    const stateSov = new StateSovereigntyEnforcer(this.stateRegistry);
    const constSup = new ConstitutionalSupremacyEnforcer();
    const sagaComp = new SagaCompensationEnforcer();

    this.kernelExecutor = new KernelExecutor(
      this.instructionEvaluator,
      this.stateRegistry,
      this.atomicCommit,
      this.capabilityEngine,
      this.eventStore,
      authorityEnforcer,
      gateEnforcer,
      capBoundary,
      stateSov,
      constSup,
      sagaComp
    );
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
    const cmdDef = this.commandAuthority.get(commandName);
    return {
      ...cmd,
      command_name: commandName,
      source_domain: cmdDef?.source_domain ?? cmd.source_domain ?? commandName.split('.')[0],
      aggregate: cmdDef?.aggregate ?? cmd.aggregate,
      payload: cmd.payload ?? {},
    };
  }

  private normalizeCommandName(name: string, sourceDomain?: string): string {
    if (this.commandAuthority.has(name)) return name;
    if (sourceDomain) {
      const prefixed = `${sourceDomain}.${name}`;
      if (this.commandAuthority.has(prefixed)) return prefixed;
    }
    return name;
  }

  private buildCommandCoverage(): Map<string, CommandCoverage> {
    const map = new Map<string, CommandCoverage>();
    const exemptions = this.commandAuthority.command_lifecycle_coverage.lifecycle_exemptions;
    for (const [commandName, cmdDef] of Object.entries(this.commandAuthority.commands) as Array<[string, any]>) {
      const domain = cmdDef.source_domain ?? commandName.split('.')[0];
      const aggregate = cmdDef.aggregate;
      const machine = aggregate ? this.machineNameFor(domain, aggregate) : undefined;
      const exemption = exemptions[commandName] ?? (cmdDef.lifecycle_exempt ? cmdDef : undefined);
      map.set(commandName, {
        commandName,
        hasMachine: Boolean(machine),
        isExempt: Boolean(cmdDef.lifecycle_exempt ?? Boolean(exemption)),
        machine,
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

  private identityGate(cmd: CommandEnvelope): GateResult {
    if (!cmd.identity_context?.identity_id || !cmd.identity_context?.actor_id) {
      return { passed: false, reason: 'UNAUTHENTICATED: missing identity_context' };
    }
    const cmdDef = this.commandAuthority.get(cmd.command_name);
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

  private policyGate(cmd: CommandEnvelope): GateResult {
    const decisionId = crypto.randomUUID();
    const amount = Number(cmd.payload?.amount || cmd.payload?.face_value || 0);

    if (amount > 1_000_000 && cmd.identity_context.actor_type === 'ai_agent') {
      return {
        passed: false,
        reason: 'POLICY ESCALATE: amount exceeds agent limit, mandatory escalation per INV-004',
        policy_decision_id: decisionId,
      };
    }

    return { passed: true, policy_decision_id: decisionId };
  }

  private constitutionalGate(cmd: CommandEnvelope): GateResult {
    if (cmd.identity_context.actor_type === 'ai_agent') {
      if (cmd.command_name.includes('capability.grant') || cmd.command_name.includes('capability.bind') || cmd.command_name.includes('trust_anchor.register')) {
        return { passed: false, reason: 'INV-004: ai_agent cannot create/grant financial authority' };
      }
    }
    return { passed: true };
  }

  private async executeUnknownCommand(cmd: CommandEnvelope, policyDecisionId: string): Promise<{ events: EventEnvelope[]; success: boolean; error?: string; eventsEmitted: number }> {
    const ev = await this.eventStore.append({
      event_name: 'system.command.unknown',
      aggregate: cmd.aggregate || 'unknown',
      aggregate_id: cmd.payload?.asset_id || cmd.payload?.order_id || crypto.randomUUID(),
      source_domain: cmd.source_domain || 'unknown',
      command_id: cmd.command_id,
      triggering_command: cmd.command_name,
      causation_id: cmd.correlation_id,
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

  private async materializeAuthorityEffects(cmd: CommandEnvelope): Promise<void> {
    if (cmd.command_name === 'identity.session.create') {
      await this.capabilityEngine.seedCompiledTypeDefaults(cmd.identity_context.actor_id, cmd.identity_context.actor_type);
    }
    if (cmd.command_name === 'governance.capability.grant') {
      await this.capabilityEngine.grant({
        capability_id: String(cmd.payload?.capability_id ?? ''),
        actor_id: String(cmd.payload?.actor_id ?? ''),
        scope_pattern: String(cmd.payload?.scope_pattern ?? '*'),
        granted_by: cmd.identity_context.actor_id,
        expires_at: cmd.payload?.expires_at ?? undefined,
        conditions: cmd.payload?.conditions,
      });
    }
    if (cmd.command_name === 'governance.capability.revoke') {
      await this.capabilityEngine.revoke(String(cmd.payload?.actor_id ?? ''), String(cmd.payload?.capability_id ?? ''));
    }
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

    if (!this.commandAuthority.has(cmd.command_name)) {
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
      if (result.status === 'ACCEPTED') {
        await this.materializeAuthorityEffects(commandForExecution);
      }
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
