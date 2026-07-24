import registryManifest from '../../../../generated/registries/registry.manifest.json' with { type: 'json' };
import commandsRegistry from '../../../../generated/registries/commands.registry.json' with { type: 'json' };
import machinesRegistry from '../../../../generated/registries/machines.registry.json' with { type: 'json' };
import capabilitiesRegistry from '../../../../generated/registries/capabilities.registry.json' with { type: 'json' };
import envelopesRegistry from '../../../../generated/registries/envelopes.registry.json' with { type: 'json' };
import projectionsRegistry from '../../../../generated/registries/projections.registry.json' with { type: 'json' };
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InstructionEvaluator } from '../execution/instruction-evaluator.js';
import { ProjectionRuntime } from '../projection/projection-runtime.js';
import { EventStore } from '../server/eventStore.js';

export interface TestResult { name: string; passed: boolean; error?: string; }
export interface SelfTestResult { passed: true; tests: number; results: TestResult[]; }

export class BootSelfTestFailure extends Error {
  constructor(readonly failed: TestResult[]) {
    super(`BootSelfTestFailure: ${failed.map(f => f.name).join(', ')}`);
    this.name = 'BootSelfTestFailure';
  }
}

export class BootSelfTest {
  private readonly registriesDir = join(dirname(fileURLToPath(import.meta.url)), '../../../../generated/registries');

  async run(): Promise<SelfTestResult> {
    const results: TestResult[] = [];
    results.push(await this.testRegistryIntegrity());
    results.push(await this.testInstructionEvaluator());
    results.push(await this.testTransitionTable());
    results.push(await this.testCapabilityRegistry());
    results.push(await this.testEnvelopeBuilder());
    results.push(await this.testEventStore());
    results.push(await this.testProjectionRuntime());
    for (const r of results) console.log(`BootSelfTest ${r.name}: ${r.passed ? 'PASS' : 'FAIL'}`);
    const failed = results.filter(r => !r.passed);
    if (failed.length > 0) throw new BootSelfTestFailure(failed);
    return { passed: true, tests: results.length, results };
  }

  private async testRegistryIntegrity(): Promise<TestResult> {
    const errors: string[] = [];
    for (const [filename, meta] of Object.entries((registryManifest as any).registries ?? {}) as Array<[string, any]>) {
      const registry = this.loadRegistry(filename);
      const actualCount = this.entryCount(registry);
      if (actualCount !== meta.entry_count) {
        errors.push(`${filename}: manifest expects ${meta.entry_count} entries, registry contains ${actualCount}`);
      }
      const actualHash = this.hashRegistry(filename);
      if (actualHash !== meta.sha256) {
        errors.push(`${filename}: manifest SHA256 mismatch — registry may have been tampered`);
      }
    }
    return errors.length > 0
      ? { name: 'RegistryIntegrity', passed: false, error: errors.join('; ') }
      : { name: 'RegistryIntegrity', passed: true };
  }

  private async testInstructionEvaluator(): Promise<TestResult> {
    const evaluator = new InstructionEvaluator();
    const vectors = [
      { node: { abi: 'v1', type: 'EXISTS', field: 'x' }, ctx: { x: 'value' }, expected: true },
      { node: { abi: 'v1', type: 'EXISTS', field: 'x' }, ctx: {}, expected: false },
      { node: { abi: 'v1', type: 'GREATER_THAN', field: 'n', value: 0 }, ctx: { n: 5 }, expected: true },
      { node: { abi: 'v1', type: 'GREATER_THAN', field: 'n', value: 0 }, ctx: { n: -1 }, expected: false },
      { node: { abi: 'v1', type: 'BALANCED_POSTINGS', field: 'postings' }, ctx: { postings: [{ type: 'debit', amount: '100' }, { type: 'credit', amount: '100' }] }, expected: true },
      { node: { abi: 'v1', type: 'BALANCED_POSTINGS', field: 'postings' }, ctx: { postings: [{ type: 'debit', amount: '100' }, { type: 'credit', amount: '50' }] }, expected: false },
    ];
    for (const v of vectors) {
      const result = await evaluator.evaluate(v.node as any, v.ctx as any);
      if (result !== v.expected) {
        return { name: 'InstructionEvaluator', passed: false, error: `Vector failed: ${JSON.stringify(v.node)} expected ${v.expected}` };
      }
    }
    return { name: 'InstructionEvaluator', passed: true };
  }

  private async testTransitionTable(): Promise<TestResult> {
    const expectedMachines = this.manifestEntryCount('machines.registry.json');
    const actualMachines = this.entryCount(machinesRegistry);
    if (actualMachines !== expectedMachines) {
      return { name: 'TransitionTable', passed: false, error: `Manifest expects ${expectedMachines} machines, registry contains ${actualMachines}` };
    }
    const vaultMachine = (machinesRegistry as any).entries?.vault_asset_lifecycle;
    if (!vaultMachine) {
      return { name: 'TransitionTable', passed: false, error: 'vault_asset_lifecycle not found — registry may be corrupt' };
    }
    if (vaultMachine.initial_state !== 'REGISTERED') {
      return { name: 'TransitionTable', passed: false, error: 'vault_asset_lifecycle initial REGISTERED state not found or incorrect — registry may be corrupt' };
    }
    return { name: 'TransitionTable', passed: true };
  }

  private async testCapabilityRegistry(): Promise<TestResult> {
    const expected = this.manifestEntryCount('capabilities.registry.json');
    const actual = this.entryCount(capabilitiesRegistry);
    if (actual !== expected) {
      return { name: 'CapabilityRegistry', passed: false, error: `Manifest expects ${expected} capabilities, registry contains ${actual}` };
    }
    if (actual <= 0) return { name: 'CapabilityRegistry', passed: false, error: 'Capability registry is empty' };
    return { name: 'CapabilityRegistry', passed: true };
  }

  private async testEnvelopeBuilder(): Promise<TestResult> {
    const expected = this.manifestEntryCount('envelopes.registry.json');
    const actual = this.entryCount(envelopesRegistry);
    if (actual !== expected) {
      return { name: 'EnvelopeBuilder', passed: false, error: `Manifest expects ${expected} envelopes, registry contains ${actual}` };
    }
    const envelope = (envelopesRegistry as any).entries?.event_envelope;
    return envelope ? { name: 'EnvelopeBuilder', passed: true } : { name: 'EnvelopeBuilder', passed: false, error: 'event envelope missing' };
  }

  private async testEventStore(): Promise<TestResult> {
    const store = new EventStore();
    store.append({ event_name: 'self.test', aggregate: 'self', aggregate_id: 'self', source_domain: 'kernel', command_id: 'cmd', triggering_command: 'boot.self_test', causation_id: 'cmd', correlation_id: 'corr', actor_id: 'system', identity_context: { identity_id: 'system', actor_type: 'system' }, policy_decision_id: 'policy', capability_id: 'system.internal', payload: {}, projection_effect: { target: 'none', operation: 'no_op' }, audit: { constitutional_rules_referenced: ['INV-001'], retention_class: 'operational_90d' } });
    return store.stats().totalEvents === 1 ? { name: 'EventStore', passed: true } : { name: 'EventStore', passed: false, error: 'append failed' };
  }

  private async testProjectionRuntime(): Promise<TestResult> {
    const expected = this.manifestEntryCount('projections.registry.json');
    const actual = this.entryCount(projectionsRegistry);
    if (actual !== expected) {
      return { name: 'ProjectionRuntime', passed: false, error: `Manifest expects ${expected} projections, registry contains ${actual}` };
    }
    const pr = new ProjectionRuntime(new EventStore());
    return pr.registryCount() === expected ? { name: 'ProjectionRuntime', passed: true } : { name: 'ProjectionRuntime', passed: false, error: `ProjectionRuntime sees ${pr.registryCount()} projections; manifest expects ${expected}` };
  }

  private manifestEntryCount(filename: string): number {
    const meta = (registryManifest as any).registries?.[filename];
    if (!meta) throw new Error(`registry.manifest.json missing ${filename}`);
    return Number(meta.entry_count);
  }

  private loadRegistry(filename: string): any {
    return JSON.parse(readFileSync(join(this.registriesDir, filename), 'utf8'));
  }

  private hashRegistry(filename: string): string {
    return createHash('sha256').update(readFileSync(join(this.registriesDir, filename))).digest('hex');
  }

  private entryCount(registry: any): number {
    return Number(registry.entry_count ?? Object.keys(registry.entries ?? {}).length);
  }
}
