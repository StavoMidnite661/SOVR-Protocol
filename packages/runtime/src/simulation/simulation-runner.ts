// ============================================================
// SOVR Financial OS — Simulation Runner
// Executes compiled scenarios against isolated runtime components.
// Produces deterministic, auditable results.
// ============================================================

import { MerkleRootService } from '../audit/MerkleRootService.js';
import { bootstrapSimulation } from './simulation-bootstrap.js';
import { SimulationScenario, SimulationResult, SimulationReport, InvariantResult, SimulationCommand, EventLineageReport, LifecycleValidationResult } from './types.js';
import { KernelExecutor, AuthorityRegistryIntegrityError } from '../execution/kernel-executor.js';
import type { StateRegistry } from '../execution/state-registry.js';
import type { EventStore } from '../server/eventStore.js';
import { CommandEnvelope } from '../server/commandBus.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IntegrityValidator } from '../authority/integrity-validator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../');
const integrityValidator = new IntegrityValidator();

const SUPPORTED_ABI_VERSIONS = ['v1'];

function sortKeys(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: any = {};
    const keys = Object.keys(value).sort();
    for (const k of keys) {
      sorted[k] = sortKeys(value[k]);
    }
    return sorted;
  }
  return value;
}

export class SimulationRunner {
  private merkleRootService = new MerkleRootService();

  async run(scenario: SimulationScenario): Promise<SimulationReport> {
    let registry: any;
    let compiled: any;
    let abiVersion: string | undefined;
    let commandsRegistry: { entries: Record<string, unknown> } = { entries: {} };
    try {
      const registryPath = join(ROOT, 'generated', 'simulation', 'scenarios.registry.json');
      registry = JSON.parse(readFileSync(registryPath, 'utf8'));
      abiVersion = registry.abi_version;

      if (!abiVersion || !SUPPORTED_ABI_VERSIONS.includes(abiVersion)) {
        return this.failureReport(scenario.scenario_id, `UNSUPPORTED_SIMULATION_REGISTRY_ABI: abi_version ${abiVersion ?? 'missing'} not in supported versions ${SUPPORTED_ABI_VERSIONS.join(',')}`);
      }

      integrityValidator.assert(registry, 'simulation/scenarios.registry.json');

      compiled = registry.scenarios?.[scenario.scenario_id];

      if (!compiled) {
        return this.failureReport(scenario.scenario_id, `AUTHORITY_REGISTRY_INTEGRITY_FAILURE: scenario_id ${scenario.scenario_id} not found in compiled simulation registry`);
      }

      const commandNames: Set<string> = new Set((compiled.commands ?? []).map((c: any) => c.command_name));
      commandsRegistry = JSON.parse(readFileSync(join(ROOT, 'generated', 'registries', 'commands.registry.json'), 'utf8'));
      const validCommandNames = new Set(Object.keys(commandsRegistry.entries ?? {}));
      for (const name of commandNames) {
        if (!validCommandNames.has(name)) {
          return this.failureReport(scenario.scenario_id, `AUTHORITY_REGISTRY_INTEGRITY_FAILURE: command ${name} not found in compiler-generated command registry`);
        }
      }
    } catch (e: any) {
      return this.failureReport(scenario.scenario_id, `AUTHORITY_REGISTRY_INTEGRITY_FAILURE: ${e.message}`);
    }

    const startTime = Date.now();
    const bootstrap = await bootstrapSimulation(scenario.seed ?? 0xDEADBEEF);
    const { eventStore, capabilityEngine, kernelExecutor, stateRegistry, stateMachineInterpreter } = bootstrap;

    const invariantResults: InvariantResult[] = [];
    let commandsExecuted = 0;
    let commandsRejected = 0;
    let success = true;
    let error: string | undefined;

    if (scenario.lifecycle && compiled.lifecycle) {
      const lifecycleResult = this.validateLifecycle(scenario.lifecycle, compiled.lifecycle);
      if (!lifecycleResult.initial_state_verified || !lifecycleResult.terminal_state_verified || !lifecycleResult.transitions_valid) {
        return this.failureReport(scenario.scenario_id, `INVALID_STATE_TRANSITION: ${lifecycleResult.error}`);
      }
    }

    const aggregateStates = new Map<string, string>();

    for (const cmd of scenario.commands) {
      try {
        const aggregateId = cmd.aggregate_id ?? cmd.command_id;
        const machine = stateMachineInterpreter.getMachineFor(cmd.domain, cmd.aggregate);
        if (machine) {
          const currentState = aggregateStates.get(aggregateId) ?? machine.initialState;
          const cmdEntry = (commandsRegistry.entries ?? {})[cmd.command_name] as any;
          const successEvent = cmdEntry?.resulting_events?.success?.[0];
          const trigger = successEvent ?? cmd.command_name;
          const transitionResult = stateMachineInterpreter.execute({
            machine: machine.id,
            domain: cmd.domain,
            aggregate: cmd.aggregate,
            aggregateId,
            currentState,
            trigger,
            context: {},
          });

          if (!transitionResult.accepted && !transitionResult.reason?.startsWith('NO_TRANSITION') && transitionResult.reason !== 'FINAL_STATE') {
            commandsRejected++;
            success = false;
            error = `INVALID_STATE_TRANSITION: ${cmd.command_name} rejected by state machine: ${transitionResult.reason}`;
            invariantResults.push({
              invariant: 'state_machine_transition',
              passed: false,
              detail: `${cmd.domain}.${cmd.aggregate}:${currentState} --${trigger}--> ${transitionResult.reason}`,
            });
            continue;
          }

          if (transitionResult.accepted && transitionResult.toState) {
            aggregateStates.set(aggregateId, transitionResult.toState);
          }
        }

        const capabilityId = cmd.capability_id ?? `${cmd.domain}.${cmd.aggregate}.create`;
        const scope = cmd.scope ?? `${cmd.domain}.${cmd.aggregate}:*`;
        const effectiveActor = cmd.actor_context ?? scenario.actor_context;

        if (!cmd.skip_capability_grant) {
          capabilityEngine.grant({
            capability_id: capabilityId,
            actor_id: effectiveActor.actor_id,
            scope_pattern: scope,
            granted_by: 'simulation',
          });
        }

        const envelope: CommandEnvelope = {
          command_id: cmd.command_id,
          command_name: cmd.command_name,
          aggregate: cmd.aggregate,
          source_domain: cmd.domain,
          payload: cmd.payload,
          identity_context: {
            identity_id: effectiveActor.identity_id,
            actor_id: effectiveActor.actor_id,
            actor_type: effectiveActor.actor_type,
            session_id: effectiveActor.session_id ?? scenario.actor_context.session_id ?? `sim-${scenario.scenario_id}`,
          },
          capability_id: capabilityId,
          scope: scope,
          correlation_id: cmd.command_id,
          causation_id: cmd.command_id,
          meta: {},
        };

        const result = await kernelExecutor.execute(envelope);

        if (result.status === 'ACCEPTED') {
          commandsExecuted++;
        } else {
          commandsRejected++;
          if (cmd.expected_result === 'ACCEPTED') {
            success = false;
            error = `Command ${cmd.command_name} rejected unexpectedly: ${result.error ?? result.rejectionReason ?? result.error_type}`;
          }
          invariantResults.push({
            invariant: 'command_execution',
            passed: result.status === 'REJECTED' && cmd.expected_result === 'REJECTED',
            detail: `${cmd.command_name}: ${result.status} — ${result.error ?? result.rejectionReason ?? result.error_type ?? 'no error'}`,
          });
        }
      } catch (e: any) {
        commandsRejected++;
        // Constitutional-gate violations (identity/capability/validation rules
        // such as BALANCED_POSTINGS) are thrown by the kernel rather than
        // returned as REJECTED envelopes. Honor the scenario's declared
        // expectation either way: an expected rejection that throws is still
        // a rejection — nothing was accepted and nothing was committed.
        if (cmd.expected_result === 'REJECTED') {
          invariantResults.push({
            invariant: 'command_execution',
            passed: true,
            detail: `${cmd.command_name}: REJECTED — ${e.message}`,
          });
        } else {
          success = false;
          error = `Command ${cmd.command_name} threw: ${e.message}`;
          invariantResults.push({
            invariant: 'command_execution',
            passed: false,
            detail: `${cmd.command_name}: ${e.message}`,
          });
        }
      }
    }

    const events = eventStore.getAll();
    const merkleResult = this.merkleRootService.compute(events);
    const eventHashes = events.map((e: any) => {
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(JSON.stringify(e)).digest('hex');
    });

    const deterministicReplayHash = this.computeReplayHash(events);
    const eventLineageReport = this.generateEventLineageReport(scenario.scenario_id, events);
    const lifecycleVerified = await this.verifyLifecycleCompletion(scenario, events, aggregateStates, {
      stateRegistry,
      eventStore,
    });

    const simulationResult: SimulationResult = {
      scenario_id: scenario.scenario_id,
      success: success && eventLineageReport.orphan_events === 0 && eventLineageReport.broken_chains === 0 && eventLineageReport.missing_ledger_entries === 0 && eventLineageReport.missing_reserve_links === 0 && lifecycleVerified,
      events_generated: events.length,
      final_state: this.extractFinalState(events),
      invariant_results: invariantResults,
      audit_hash: merkleResult.root_hash,
      event_hashes: eventHashes,
      deterministic_replay_hash: deterministicReplayHash,
      error,
      commands_executed: commandsExecuted,
      commands_rejected: commandsRejected,
      event_lineage_report: eventLineageReport,
      lifecycle_verified: lifecycleVerified,
      registry_abi_version: abiVersion,
    };

    const report: SimulationReport = {
      scenario_id: scenario.scenario_id,
      timestamp: new Date().toISOString(),
      result: simulationResult,
      merkle_root: merkleResult.root_hash,
      event_count: events.length,
      duration_ms: Date.now() - startTime,
    };

    this.persistEventLineageReport(scenario.scenario_id, eventLineageReport);

    return report;
  }

  private validateLifecycle(scenarioLifecycle: any, compiledLifecycle: any): LifecycleValidationResult {
    if (!scenarioLifecycle?.initial_state || !scenarioLifecycle?.terminal_state) {
      return { initial_state_verified: false, terminal_state_verified: false, transitions_valid: false, error: 'Lifecycle declaration missing initial_state or terminal_state' };
    }
    if (!compiledLifecycle?.initial_state || !compiledLifecycle?.terminal_state) {
      return { initial_state_verified: false, terminal_state_verified: false, transitions_valid: false, error: 'Compiled registry missing lifecycle definition' };
    }
    if (scenarioLifecycle.initial_state !== compiledLifecycle.initial_state) {
      return { initial_state_verified: false, terminal_state_verified: false, transitions_valid: false, error: `initial_state mismatch: scenario=${scenarioLifecycle.initial_state} compiled=${compiledLifecycle.initial_state}` };
    }
    if (scenarioLifecycle.terminal_state !== compiledLifecycle.terminal_state) {
      return { initial_state_verified: false, terminal_state_verified: false, transitions_valid: false, error: `terminal_state mismatch: scenario=${scenarioLifecycle.terminal_state} compiled=${compiledLifecycle.terminal_state}` };
    }
    return { initial_state_verified: true, terminal_state_verified: true, transitions_valid: true };
  }

  private async verifyLifecycleCompletion(
    scenario: SimulationScenario,
    events: any[],
    aggregateStates: Map<string, string>,
    bootstrap: { stateRegistry: StateRegistry; eventStore: EventStore },
  ): Promise<boolean> {
    if (!scenario.lifecycle?.terminal_state) return true;
    const terminalState = scenario.lifecycle.terminal_state;
    for (const state of aggregateStates.values()) {
      if (state === terminalState) {
        return true;
      }
    }
    // Honest verification against committed truth: the pre-check tracking map
    // cannot observe machine states born at the initial state (creation events
    // synthesize INIT→initial inside the kernel, bypassing interpreter-tracked
    // transitions). Rebuild aggregate states from the event log (INV-001) using
    // the kernel-recorded transition receipts and check those.
    try {
      await bootstrap.stateRegistry.rebuildFromEventLog(bootstrap.eventStore);
      const seen = new Set<string>();
      for (const e of events) {
        const key = `${e.source_domain}|${e.aggregate}|${e.aggregate_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const st = await bootstrap.stateRegistry
          .getState(String(e.aggregate), String(e.aggregate_id), String(e.source_domain))
          .catch(() => undefined);
        if (st === terminalState) return true;
      }
    } catch {
      // If the log cannot be rebuilt, lifecycle verification remains unproven.
    }
    return false;
  }

  private persistEventLineageReport(scenarioId: string, report: EventLineageReport): void {
    const reportsDir = join(ROOT, 'generated', 'simulation', 'reports');
    try {
      mkdirSync(reportsDir, { recursive: true });
    } catch {
      // directory may already exist
    }
    const output = {
      scenario_id: scenarioId,
      events: report.events,
      orphan_events: report.orphan_events,
      broken_chains: report.broken_chains,
      missing_ledger_entries: report.missing_ledger_entries,
      missing_reserve_links: report.missing_reserve_links,
      verified: report.orphan_events === 0 && report.broken_chains === 0 && report.missing_ledger_entries === 0 && report.missing_reserve_links === 0,
    };
    writeFileSync(join(reportsDir, `${scenarioId}-event-lineage.json`), JSON.stringify(output, null, 2) + '\n');
  }

  private generateEventLineageReport(scenarioId: string, events: any[]): EventLineageReport {
    const report: EventLineageReport = {
      scenario: scenarioId,
      events: events.map(e => ({
        event_id: e.event_id,
        command_id: e.command_id,
        correlation_id: e.correlation_id,
        causation_id: e.causation_id,
        economic_context: {
          asset_id: e.payload?.asset_id ?? e.payload?.assetId,
          reserve_id: e.payload?.reservation_id ?? e.payload?.reserve_id,
          ledger_account: e.payload?.account_id ?? e.payload?.accountId,
          settlement_id: e.payload?.settlement_id ?? e.payload?.settlementId,
        },
      })),
      orphan_events: 0,
      broken_chains: 0,
      missing_ledger_entries: 0,
      missing_reserve_links: 0,
    };

    const commandIds = new Set(events.map(e => e.command_id).filter(Boolean));
    const eventIds = new Set(events.map(e => e.event_id));

    for (const e of events) {
      if (!e.command_id) {
        report.orphan_events++;
      }
      if (e.causation_id && e.causation_id !== e.correlation_id) {
        const parentExists = eventIds.has(e.causation_id) || commandIds.has(e.causation_id);
        if (!parentExists) {
          report.broken_chains++;
        }
      }
      const name = e.event_name;
      if (name === 'ledger.entry.posted') {
        const postings = Array.isArray(e.payload?.postings) ? e.payload.postings : [];
        const hasAccount = postings.some((p: any) => p.account_id || p.accountId);
        if (postings.length > 0 && !hasAccount) {
          report.missing_ledger_entries++;
        }
      }
      if (name === 'treasury.transfer.reserved' || name === 'treasury.transfer.settled') {
        const hasReserve = e.payload?.reservation_id || e.payload?.reserve_id || e.payload?.order_id;
        if (!hasReserve) {
          report.missing_reserve_links++;
        }
      }
    }

    return report;
  }

  private failureReport(scenarioId: string, error: string): SimulationReport {
    return {
      scenario_id: scenarioId,
      timestamp: new Date().toISOString(),
      result: {
        scenario_id: scenarioId,
        success: false,
        events_generated: 0,
        final_state: {},
        invariant_results: [],
        audit_hash: '',
        event_hashes: [],
        deterministic_replay_hash: '',
        error,
        commands_executed: 0,
        commands_rejected: 0,
        event_lineage_report: {
          scenario: scenarioId,
          events: [],
          orphan_events: 0,
          broken_chains: 0,
          missing_ledger_entries: 0,
          missing_reserve_links: 0,
        },
        lifecycle_verified: false,
        registry_abi_version: 'unknown',
      },
      merkle_root: '',
      event_count: 0,
      duration_ms: 0,
    };
  }

  private computeReplayHash(events: any[]): string {
    const crypto = require('crypto');
    const data = events.map(e => `${e.event_name}:${e.aggregate_id}:${e.correlation_id}`).join('|');
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private extractFinalState(events: any[]): Record<string, unknown> {
    const state: Record<string, unknown> = {};
    for (const e of events) {
      if (e.projection_effect?.target && e.projection_effect.target !== 'none') {
        state[e.projection_effect.target] = {
          event_name: e.event_name,
          aggregate_id: e.aggregate_id,
          timestamp: e.timestamp,
        };
      }
    }
    return state;
  }
}
