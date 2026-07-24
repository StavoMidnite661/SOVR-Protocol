// ============================================================
// SOVR Runtime — YAML/IR State Machine Interpreter
// Executes protocol state transitions deterministically from the
// compiled IR state_machine nodes, with source YAML fallback for
// v0.2 IR nodes that only carry source references.
// ============================================================

import fs from 'fs';
import yaml from 'js-yaml';
import { VELASTEvaluator } from './vel-ast-evaluator.js';

export interface CompiledIR {
  nodes?: Array<Record<string, any>>;
  edges?: Array<Record<string, any>>;
  meta?: Record<string, any>;
}

export interface StateDefinition {
  description?: string;
  allowed_commands?: string[];
  entry_actions?: string[];
  exit_actions?: string[];
  [key: string]: any;
}

export interface TransitionDefinition {
  trigger?: string;
  command?: string;
  condition?: string;
  emitted_events?: string[];
  invalid?: boolean;
  from?: string;
  to?: string;
  [key: string]: any;
}

export interface StateMachineDefinition {
  id: string;
  name: string;
  domain: string;
  aggregate: string;
  initialState: string;
  finalStates: string[];
  states: Record<string, StateDefinition>;
  transitions: Record<string, TransitionDefinition>;
  sourceFile?: string;
  sourceRef?: string;
  version?: string;
}

export interface TransitionContext {
  /** Boolean guard facts keyed by the YAML condition string. */
  conditions?: Record<string, boolean>;
  /** Additional deterministic facts usable by guard checks. */
  facts?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TransitionInput {
  machine?: string;
  domain?: string;
  aggregate?: string;
  aggregateId?: string;
  currentState?: string;
  trigger: string;
  context?: TransitionContext;
}

export interface TransitionResult {
  accepted: boolean;
  machineId?: string;
  machineName?: string;
  domain?: string;
  aggregate?: string;
  aggregateId?: string;
  transitionName?: string;
  trigger: string;
  fromState?: string;
  toState?: string;
  emittedEvents: string[];
  entryActions: string[];
  exitActions: string[];
  isFinal?: boolean;
  reason?: string;
  condition?: string;
}

export interface StateMachineInterpreterOptions {
  /**
   * Default false. When false, non-empty guards must be supplied as deterministic
   * booleans in context.conditions or context.facts. This is the safe mode.
   */
  allowUnresolvedConditions?: boolean;
}

export class StateMachineInterpreter {
  private machinesById = new Map<string, StateMachineDefinition>();
  private machinesByName = new Map<string, StateMachineDefinition>();
  private machinesByDomainAggregate = new Map<string, StateMachineDefinition>();
  private aggregateStates = new Map<string, string>();
  private allowUnresolvedConditions: boolean;
  private guardEvaluator = new VELASTEvaluator();

  constructor(machines: StateMachineDefinition[], options: StateMachineInterpreterOptions = {}) {
    this.allowUnresolvedConditions = options.allowUnresolvedConditions ?? false;
    const sorted = [...machines].sort((a, b) => a.id.localeCompare(b.id));
    for (const machine of sorted) this.register(machine);
  }

  static fromFiles(
    irPath: string,
    stateMachinesYamlPath?: string,
    options: StateMachineInterpreterOptions = {}
  ): StateMachineInterpreter {
    const ir = fs.existsSync(irPath) ? JSON.parse(fs.readFileSync(irPath, 'utf8')) as CompiledIR : { nodes: [] };
    const source = stateMachinesYamlPath && fs.existsSync(stateMachinesYamlPath)
      ? yaml.load(fs.readFileSync(stateMachinesYamlPath, 'utf8')) as any
      : undefined;
    return StateMachineInterpreter.fromIR(ir, source, options);
  }

  static fromIR(
    ir: CompiledIR,
    sourceStateMachines?: any,
    options: StateMachineInterpreterOptions = {}
  ): StateMachineInterpreter {
    const sourceMachines = sourceStateMachines?.state_machines ?? sourceStateMachines ?? {};
    const irNodes = (ir.nodes ?? []).filter(n => n.type === 'state_machine');
    const machines: StateMachineDefinition[] = [];

    for (const node of irNodes) {
      const name = String(node.sourceRef ?? node.name ?? String(node.id ?? '').replace(/^state_machine:/, ''));
      const sourceDef = sourceMachines[name] ?? {};
      const merged = { ...sourceDef, ...node };
      const definition = normalizeMachine(name, merged, node);
      if (definition) machines.push(definition);
    }

    // If an older or partial IR did not contain state_machine nodes, fall back
    // to the source spec so the interpreter remains usable in kernel-working mode.
    if (machines.length === 0) {
      for (const [name, def] of Object.entries(sourceMachines)) {
        const definition = normalizeMachine(String(name), def as any, undefined);
        if (definition) machines.push(definition);
      }
    }

    return new StateMachineInterpreter(machines, options);
  }

  listMachines(): StateMachineDefinition[] {
    return [...this.machinesById.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  getMachine(idOrName: string): StateMachineDefinition | undefined {
    return this.machinesById.get(idOrName)
      ?? this.machinesByName.get(idOrName)
      ?? this.machinesById.get(`state_machine:${idOrName}`);
  }

  getMachineFor(domain: string, aggregate: string): StateMachineDefinition | undefined {
    return this.machinesByDomainAggregate.get(`${domain}:${aggregate}`);
  }

  getCurrentState(machineIdOrName: string, aggregateId: string): string | undefined {
    const machine = this.getMachine(machineIdOrName);
    if (!machine) return undefined;
    return this.aggregateStates.get(this.aggregateKey(machine, aggregateId)) ?? machine.initialState;
  }

  /** Stateless deterministic transition. The caller supplies currentState. */
  execute(input: TransitionInput): TransitionResult {
    const machine = this.resolveMachine(input);
    if (!machine) {
      return rejected(input, 'STATE_MACHINE_NOT_FOUND');
    }

    const currentState = input.currentState ?? machine.initialState;
    if (!machine.states[currentState]) {
      return rejected(input, `UNKNOWN_STATE: ${currentState}`, machine, currentState);
    }
    if (machine.finalStates.includes(currentState)) {
      return rejected(input, `FINAL_STATE: ${currentState}`, machine, currentState);
    }

    const candidates = this.findTransitions(machine, currentState, input.trigger);
    if (candidates.length === 0) {
      return rejected(input, `NO_TRANSITION: ${currentState} --${input.trigger}--> ?`, machine, currentState);
    }

    const failedReasons: string[] = [];
    for (const candidate of candidates) {
      if (candidate.transition.invalid === true) {
        failedReasons.push(`${candidate.name}: transition marked invalid`);
        continue;
      }
      const guard = this.evaluateCondition(candidate.transition.condition, input.context ?? {});
      if (!guard.passed) {
        failedReasons.push(`${candidate.name}: ${guard.reason}`);
        continue;
      }

      const toState = candidate.to;
      const fromDef = machine.states[currentState] ?? {};
      const toDef = machine.states[toState] ?? {};
      return {
        accepted: true,
        machineId: machine.id,
        machineName: machine.name,
        domain: machine.domain,
        aggregate: machine.aggregate,
        aggregateId: input.aggregateId,
        transitionName: candidate.name,
        trigger: input.trigger,
        fromState: currentState,
        toState,
        emittedEvents: [...(candidate.transition.emitted_events ?? [])],
        entryActions: [...(toDef.entry_actions ?? [])],
        exitActions: [...(fromDef.exit_actions ?? [])],
        isFinal: machine.finalStates.includes(toState),
        condition: candidate.transition.condition,
      };
    }

    return rejected(input, `CONDITION_FAILED: ${failedReasons.join('; ')}`, machine, currentState);
  }

  /** Stateful helper for aggregate instances. State is in-memory and deterministic. */
  transitionAggregate(input: TransitionInput & { aggregateId: string }): TransitionResult {
    const machine = this.resolveMachine(input);
    if (!machine) return rejected(input, 'STATE_MACHINE_NOT_FOUND');
    const key = this.aggregateKey(machine, input.aggregateId);
    const currentState = input.currentState ?? this.aggregateStates.get(key) ?? machine.initialState;
    const result = this.execute({ ...input, currentState });
    if (result.accepted && result.toState) this.aggregateStates.set(key, result.toState);
    return result;
  }

  resetAggregate(machineIdOrName: string, aggregateId: string, state?: string): void {
    const machine = this.getMachine(machineIdOrName);
    if (!machine) throw new Error(`STATE_MACHINE_NOT_FOUND: ${machineIdOrName}`);
    const next = state ?? machine.initialState;
    if (!machine.states[next]) throw new Error(`UNKNOWN_STATE: ${next}`);
    this.aggregateStates.set(this.aggregateKey(machine, aggregateId), next);
  }

  private register(machine: StateMachineDefinition): void {
    this.machinesById.set(machine.id, machine);
    this.machinesByName.set(machine.name, machine);
    this.machinesByDomainAggregate.set(`${machine.domain}:${machine.aggregate}`, machine);
  }

  private resolveMachine(input: TransitionInput): StateMachineDefinition | undefined {
    if (input.machine) return this.getMachine(input.machine);
    if (input.domain && input.aggregate) return this.getMachineFor(input.domain, input.aggregate);
    return undefined;
  }

  private findTransitions(machine: StateMachineDefinition, currentState: string, trigger: string): Array<{ name: string; from: string; to: string; transition: TransitionDefinition }> {
    const found: Array<{ name: string; from: string; to: string; transition: TransitionDefinition }> = [];
    for (const [name, transition] of Object.entries(machine.transitions)) {
      const endpoints = transitionEndpoints(name, transition);
      if (!endpoints) continue;
      const transitionTrigger = transition.trigger ?? transition.command;
      if (endpoints.from === currentState && transitionTrigger === trigger) {
        found.push({ name, from: endpoints.from, to: endpoints.to, transition });
      }
    }
    found.sort((a, b) => a.name.localeCompare(b.name));
    return found;
  }

  private evaluateCondition(condition: string | undefined, context: TransitionContext): { passed: boolean; reason?: string } {
    const raw = (condition ?? '').trim();
    if (!raw || ['always', 'true', 'none', 'n/a', 'not_applicable'].includes(raw.toLowerCase())) {
      return { passed: true };
    }

    const parsed = this.guardEvaluator.tryParse(raw);
    if (parsed.error || !parsed.ast) {
      if (this.allowUnresolvedConditions) return { passed: true, reason: `condition ${raw} parse failed but allowed by interpreter option` };
      return { passed: false, reason: `CONDITION_PARSE_ERROR: ${parsed.error}` };
    }

    const passed = this.guardEvaluator.evaluate(parsed.ast, context);
    if (passed) return { passed: true, reason: `condition ${raw} evaluated true` };
    if (this.allowUnresolvedConditions) return { passed: true, reason: `condition ${raw} evaluated false but allowed by interpreter option` };
    return { passed: false, reason: `CONDITION_FALSE: ${raw}` };
  }

  private aggregateKey(machine: StateMachineDefinition, aggregateId: string): string {
    return `${machine.id}:${aggregateId}`;
  }
}

function normalizeMachine(name: string, input: any, irNode?: Record<string, any>): StateMachineDefinition | undefined {
  const domain = input.domain ?? irNode?.domain;
  const aggregate = input.aggregate ?? irNode?.aggregate;
  const states = input.states ?? irNode?.states;
  const transitions = input.transitions ?? irNode?.transitions ?? {};
  const initialState = input.initial_state ?? input.initialState ?? irNode?.initialState;
  if (!domain || !aggregate || !states || !initialState) return undefined;

  return {
    id: String(irNode?.id ?? input.id ?? `state_machine:${name}`),
    name,
    domain: String(domain),
    aggregate: String(aggregate),
    initialState: String(initialState),
    finalStates: Array.isArray(input.final_states) ? input.final_states.map(String)
      : Array.isArray(input.finalStates) ? input.finalStates.map(String)
      : [],
    states: states as Record<string, StateDefinition>,
    transitions: transitions as Record<string, TransitionDefinition>,
    sourceFile: String(irNode?.sourceFile ?? input.sourceFile ?? '05_state-machines.yaml'),
    sourceRef: String(irNode?.sourceRef ?? input.sourceRef ?? name),
    version: String(irNode?.version ?? input.version ?? '1.0.0'),
  };
}

function transitionEndpoints(name: string, transition: TransitionDefinition): { from: string; to: string } | undefined {
  if (transition.from && transition.to) return { from: String(transition.from), to: String(transition.to) };
  const marker = '_to_';
  const idx = name.indexOf(marker);
  if (idx === -1) return undefined;
  return {
    from: name.slice(0, idx),
    to: name.slice(idx + marker.length),
  };
}

function lookupBoolean(key: string, context: TransitionContext): boolean | undefined {
  const direct = context[key];
  if (typeof direct === 'boolean') return direct;
  const conditionValue = context.conditions?.[key];
  if (typeof conditionValue === 'boolean') return conditionValue;
  const factValue = context.facts?.[key];
  if (typeof factValue === 'boolean') return factValue;
  return undefined;
}

function rejected(input: TransitionInput, reason: string, machine?: StateMachineDefinition, currentState?: string): TransitionResult {
  return {
    accepted: false,
    machineId: machine?.id,
    machineName: machine?.name,
    domain: machine?.domain ?? input.domain,
    aggregate: machine?.aggregate ?? input.aggregate,
    aggregateId: input.aggregateId,
    trigger: input.trigger,
    fromState: currentState,
    emittedEvents: [],
    entryActions: [],
    exitActions: [],
    reason,
  };
}
