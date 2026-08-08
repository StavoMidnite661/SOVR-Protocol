// ============================================================
// SOVR Financial OS — Controlled Simulation Engine
// Phase 10A: Deterministic, isolated, no production adapters.
// ============================================================

import { randomUUID } from 'node:crypto';
import { EventStore, EventEnvelope, AppendInput } from '../server/eventStore.js';
import { MerkleRootService } from '../audit/MerkleRootService.js';

export interface SimulationScenario {
  scenario_id: string;
  commands: SimulationCommand[];
  initial_state?: Record<string, unknown>;
  actor_context: {
    actor_id: string;
    actor_type: string;
    identity_id: string;
    session_id?: string;
  };
  seed?: number;
  lifecycle?: {
    initial_state: string;
    terminal_state: string;
  };
}

export interface SimulationCommand {
  command_id: string;
  command_name: string;
  domain: string;
  aggregate: string;
  payload: Record<string, unknown>;
  capability_id?: string;
  scope?: string;
  expected_result?: 'ACCEPTED' | 'REJECTED';
  expected_error_type?: string;
  skip_capability_grant?: boolean;
}

export interface InvariantResult {
  invariant: string;
  passed: boolean;
  detail: string;
}

export interface SimulationResult {
  scenario_id: string;
  success: boolean;
  events_generated: number;
  final_state: Record<string, unknown>;
  invariant_results: InvariantResult[];
  audit_hash: string;
  event_hashes: string[];
  deterministic_replay_hash: string;
  error?: string;
  commands_executed: number;
  commands_rejected: number;
  event_lineage_report?: EventLineageReport;
  lifecycle_verified?: boolean;
  registry_abi_version?: string;
}

export interface SimulationReport {
  scenario_id: string;
  timestamp: string;
  result: SimulationResult;
  merkle_root: string;
  event_count: number;
  duration_ms: number;
}

export interface EventLineageReport {
  scenario: string;
  events: Array<{
    event_id: string;
    command_id: string;
    correlation_id: string;
    causation_id: string;
    economic_context?: {
      asset_id?: string;
      reserve_id?: string;
      ledger_account?: string;
      settlement_id?: string;
    };
  }>;
  orphan_events: number;
  broken_chains: number;
  missing_ledger_entries: number;
  missing_reserve_links: number;
}

export interface LifecycleValidationResult {
  initial_state_verified: boolean;
  terminal_state_verified: boolean;
  transitions_valid: boolean;
  error?: string;
}
