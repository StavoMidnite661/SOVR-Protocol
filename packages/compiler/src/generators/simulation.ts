import { SOVR_IR } from '../ir/types.js';
import { GeneratedFile } from './typescript.js';
import { canonicalJson, sha256 } from '../utils/hash.js';
import { ParsedProtocol } from '../pipeline/parse.js';

export interface SimulationScenarioCompiled {
  scenario_id: string;
  name: string;
  version: string;
  amendment?: string;
  description: string;
  actors: Array<{
    actor_id: string;
    actor_type: string;
    identity_id: string;
    session_id?: string;
  }>;
  initial_state?: Record<string, unknown>;
  lifecycle?: {
    initial_state: string;
    terminal_state: string;
  };
  commands: Array<{
    command_id: string;
    command_name: string;
    domain: string;
    aggregate: string;
    payload: Record<string, unknown>;
    capability_id?: string;
    scope?: string;
    expected_result?: string;
    expected_error_type?: string;
  }>;
  expected_events?: Array<{
    event_name: string;
    aggregate_id?: string;
  }>;
  expected_failures?: Array<{
    command_id: string;
    error_type: string;
  }>;
  invariants?: Array<{
    invariant: string;
    required?: boolean;
  }>;
  source_file: string;
  compiled_at: string;
  integrity_hash?: string;
  integrity?: {
    algorithm: 'SHA256';
    hash: string;
    generated_by: { compiler_version: string };
    timestamp: string;
  };
}

export interface SimulationRegistry {
  abi_version: string;
  scenarios: Record<string, SimulationScenarioCompiled>;
  entry_count: number;
  integrity: {
    algorithm: 'SHA256';
    hash: string;
    generated_by: { compiler_version: string };
    timestamp: string;
  };
}

export function generateSimulationRegistry(parsed: ParsedProtocol): GeneratedFile[] {
  const simulationDir = 'governance/simulation/scenarios';
  const scenarios: Record<string, SimulationScenarioCompiled> = {};

  for (const file of parsed.files) {
    if (!file.relativePath.includes('governance/simulation/scenarios') || !file.relativePath.endsWith('.yaml')) continue;

    const raw = file.parsed;
    if (!raw || typeof raw !== 'object' || !raw.scenario_id) continue;

    const scenario: SimulationScenarioCompiled = {
      scenario_id: raw.scenario_id,
      name: raw.name ?? raw.scenario_id,
      version: raw.version ?? '1.0.0',
      amendment: raw.amendment,
      description: raw.description ?? '',
      actors: (() => {
        const list = raw.actors ?? (raw.actor_context ? [raw.actor_context] : []);
        return list.map((a: any) => ({
          actor_id: a.actor_id,
          actor_type: a.actor_type,
          identity_id: a.identity_id,
          session_id: a.session_id,
        }));
      })(),
      initial_state: raw.initial_state,
      lifecycle: raw.lifecycle,
      commands: (raw.commands ?? []).map((cmd: any) => ({
        command_id: cmd.command_id,
        command_name: cmd.command_name,
        domain: cmd.domain,
        aggregate: cmd.aggregate,
        payload: cmd.payload ?? {},
        capability_id: cmd.capability_id,
        scope: cmd.scope,
        expected_result: cmd.expected_result,
        expected_error_type: cmd.expected_error_type,
      })),
      expected_events: raw.expected_events,
      expected_failures: raw.expected_failures,
      invariants: raw.invariants,
      source_file: file.relativePath,
      compiled_at: new Date().toISOString(),
    };

    const hashPayload = { ...scenario };
    delete (hashPayload as any).integrity_hash;
    delete (hashPayload as any).integrity;
    delete (hashPayload as any).compiled_at;
    scenario.integrity = {
      algorithm: 'SHA256',
      hash: sha256(canonicalJson(hashPayload)),
      generated_by: { compiler_version: '0.6.0' },
      timestamp: new Date().toISOString(),
    };

    delete (scenario as any).integrity_hash;

    scenarios[scenario.scenario_id] = scenario;
  }

  const regHashPayload = { ...{ abi_version: 'v1', scenarios, entry_count: Object.keys(scenarios).length } };
  const regIntegrity = {
    algorithm: 'SHA256' as const,
    hash: sha256(canonicalJson(regHashPayload)),
    generated_by: { compiler_version: '0.6.0' },
    timestamp: new Date().toISOString(),
  };

  const registry: SimulationRegistry = {
    abi_version: 'v1',
    scenarios,
    entry_count: Object.keys(scenarios).length,
    integrity: regIntegrity,
  };

  const content = canonicalJson(registry) + '\n';
  const file: GeneratedFile = {
    path: 'simulation/scenarios.registry.json',
    content,
    sha256: sha256(content),
    sourceRefs: Object.values(scenarios).map(s => s.source_file),
  };

  return [file];
}
