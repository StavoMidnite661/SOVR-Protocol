// ============================================================
// SOVR Authority Module — Shared Types
// Phase 10B.1: Type definitions for compiler-generated authority
// registry artifacts consumed by the runtime.
// ============================================================

export interface IntegrityBlock {
  algorithm: 'SHA256';
  hash: string;
  generated_by: { compiler_version: string };
  timestamp: string;
}

export interface CommandRegistryEntry {
  abi: string;
  command_name: string;
  source_domain: string;
  domain: string;
  aggregate: string;
  version: string;
  issuer: { actor_types?: string[]; minimum_capability?: string };
  authorization_requirements: Record<string, unknown>;
  required_payload: Array<string | object>;
  resulting_events: { success?: string[]; failure?: string[] };
  validation_rule_ids: string[];
  constitutional_gates: Record<string, unknown>;
  execution_gates: Array<Record<string, unknown>>;
  lifecycle: unknown;
  lifecycle_exempt: boolean;
  lifecycle_exempt_reason?: string;
  lifecycle_exempt_governance_ref?: string;
  [key: string]: unknown;
}

export interface CommandLifecycleCoverage {
  schema_version: string;
  fail_on_uncovered: boolean;
  machine_coverage_rule: string;
  lifecycle_exemptions: Record<string, any>;
}

export interface CommandRegistry {
  abi: string;
  kind: 'commands';
  entry_count: number;
  entries: Record<string, CommandRegistryEntry>;
  command_lifecycle_coverage?: CommandLifecycleCoverage;
  integrity: IntegrityBlock;
}

export interface EventRegistryEntry {
  abi: string;
  event_name: string;
  aggregate: string;
  source_domain: string;
  aggregate_id_field?: string;
  projection_effect?: { target: string; operation: string };
  version: string;
  [key: string]: unknown;
}

export interface EventEnvelope {
  abi: string;
  description?: string;
  fields: Record<string, unknown>;
}

export interface EventRegistry {
  abi: string;
  kind: 'events';
  entry_count: number;
  entries: Record<string, EventRegistryEntry>;
  event_envelope?: EventEnvelope;
  integrity: IntegrityBlock;
}

export interface ConstitutionEntry {
  version: string;
  status: string;
  hash: string;
  system: Record<string, unknown>;
  invariants: Record<string, any>;
  conflict_resolution: Record<string, unknown>;
  authority: Record<string, unknown>;
}

export interface ConstitutionRegistry {
  abi: string;
  kind: 'constitution';
  entry_count: number;
  entries: { constitution: ConstitutionEntry };
  integrity: IntegrityBlock;
}

export interface CapabilityRegistry {
  abi: string;
  kind: 'capabilities';
  entry_count: number;
  entries: Record<string, Record<string, unknown>>;
  integrity: IntegrityBlock;
}

export interface AuthorityRegistryLoader {
  loadCommands(): CommandRegistry;
  loadEvents(): EventRegistry;
  loadConstitution(): ConstitutionRegistry;
  loadCapabilities(): CapabilityRegistry;
}
