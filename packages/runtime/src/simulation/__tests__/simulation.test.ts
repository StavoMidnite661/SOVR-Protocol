import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SimulationRunner } from '../simulation-runner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../');
const runner = new SimulationRunner();

function loadCompiledRegistry(): Record<string, any> {
  const content = readFileSync(join(ROOT, 'generated', 'simulation', 'scenarios.registry.json'), 'utf8');
  const registry = JSON.parse(content);
  return registry.scenarios;
}

describe('Phase 10A Simulation Scenarios', () => {
  const registry = loadCompiledRegistry();
  const scenarioIds = Object.keys(registry);

  for (const scenarioId of scenarioIds) {
    it(`executes ${scenarioId} from compiled registry`, async () => {
      const compiled = registry[scenarioId];
      const scenario = {
        scenario_id: compiled.scenario_id,
        name: compiled.name,
        commands: compiled.commands,
        actor_context: compiled.actors[0],
        seed: 0xDEADBEEF,
      };

      const report = await runner.run(scenario);

      console.log(`REPORT ${scenarioId}:`, JSON.stringify({
        success: report.result.success,
        events: report.result.events_generated,
        executed: report.result.commands_executed,
        rejected: report.result.commands_rejected,
        error: report.result.error,
        invariant_results: report.result.invariant_results,
      }, null, 2));

      expect(report.result.success).toBe(true);
      // Negative-certification scenarios (every command expects REJECTED)
      // legitimately emit zero events — nothing was accepted. Their
      // certification evidence is a certified rejection, not an event log.
      const allNegative = compiled.commands.length > 0 && compiled.commands.every((c: any) => c.expected_result === 'REJECTED');
      if (allNegative) {
        expect(report.result.commands_rejected).toBeGreaterThan(0);
        expect(report.result.invariant_results.some((i: any) => i.passed && i.detail.includes('REJECTED'))).toBe(true);
      } else {
        expect(report.result.events_generated).toBeGreaterThan(0);
      }
      expect(report.result.audit_hash).toBeTruthy();
      expect(report.result.deterministic_replay_hash).toBeTruthy();
    });
  }
});

describe('Phase 10A Failure Injections', () => {
  it('Test A: invalid capability is rejected', async () => {
    const report = await runner.run({
      scenario_id: 'SIM-001-VAULT-FUNDING-LIFECYCLE',
      commands: [
        {
          command_id: 'fail-a-001',
          command_name: 'vault.asset.register',
          domain: 'vault',
          aggregate: 'asset',
          payload: {
            asset_id: 'fail-asset-001',
            asset_type: 'stablecoin',
            issuer_id: 'fail-issuer',
            ownership_id: 'fail-issuer',
            custody_provider: 'sovr_internal',
            custody_location: 'sovr_internal_vault_1',
            native_unit: 'wei',
            precision: 18,
            valuation_source: 'internal',
            reserve_ratio: '1.0',
            face_value: '1000',
            quantity: '1000',
          },
          capability_id: 'nonexistent.capability',
          scope: 'vault.asset:*',
          expected_result: 'REJECTED',
          skip_capability_grant: true,
        },
      ],
      actor_context: {
        actor_id: 'fail-actor',
        actor_type: 'human',
        identity_id: 'fail-actor-id',
        session_id: 'fail-session',
      },
      seed: 0xDEADBEEF,
    });

    expect(report.result.commands_rejected).toBeGreaterThan(0);
    expect(report.result.invariant_results.some(i => i.invariant === 'command_execution' && i.passed)).toBe(true);
  });

  it('Test B: missing capability causes rejection', async () => {
    const report = await runner.run({
      scenario_id: 'SIM-001-VAULT-FUNDING-LIFECYCLE',
      commands: [
        {
          command_id: 'fail-b-001',
          command_name: 'vault.asset.register',
          domain: 'vault',
          aggregate: 'asset',
          payload: {
            asset_id: 'fail-asset-002',
            asset_type: 'stablecoin',
            issuer_id: 'fail-issuer',
            ownership_id: 'fail-issuer',
            custody_provider: 'sovr_internal',
            custody_location: 'sovr_internal_vault_1',
            native_unit: 'wei',
            precision: 18,
            valuation_source: 'internal',
            reserve_ratio: '1.0',
            face_value: '1000',
            quantity: '1000',
          },
          capability_id: 'vault.asset.create',
          scope: 'vault.asset:*',
          expected_result: 'ACCEPTED',
        },
        {
          command_id: 'fail-b-002',
          command_name: 'vault.asset.register',
          domain: 'vault',
          aggregate: 'asset',
          payload: {
            asset_id: 'fail-asset-003',
            asset_type: 'stablecoin',
            issuer_id: 'fail-issuer',
            ownership_id: 'fail-issuer',
            custody_provider: 'sovr_internal',
            custody_location: 'sovr_internal_vault_1',
            native_unit: 'wei',
            precision: 18,
            valuation_source: 'internal',
            reserve_ratio: '1.0',
            face_value: '1000',
            quantity: '1000',
          },
          capability_id: 'vault.asset.update',
          scope: 'vault.asset:*',
          expected_result: 'REJECTED',
          skip_capability_grant: true,
        },
      ],
      actor_context: {
        actor_id: 'fail-actor-b',
        actor_type: 'human',
        identity_id: 'fail-actor-b-id',
        session_id: 'fail-session-b',
      },
      seed: 0xBAAAAAAD,
    });

    expect(report.result.commands_executed).toBeGreaterThan(0);
    expect(report.result.commands_rejected).toBeGreaterThan(0);
  });

  it('Test C: amount exceeds gate is rejected', async () => {
    const report = await runner.run({
      scenario_id: 'SIM-002-TREASURY-TRANSFER-APPROVAL',
      commands: [
        {
          command_id: 'fail-c-001',
          command_name: 'treasury.transfer.request',
          domain: 'treasury',
          aggregate: 'transfer_order',
          payload: {
            source_actor_id: 'fail-actor-c',
            destination_actor_id: 'fail-recipient',
            asset_id: 'vault-asset-001',
            amount: '9999',
            purpose: 'test_oversized',
            destination_details: {
              type: 'ach',
              address: 'sim-address',
              rail: 'ACH',
              reference: 'sim-ref-c',
            },
          },
          capability_id: 'treasury.transfer.request',
          scope: 'treasury.transfer:*',
          expected_result: 'REJECTED',
        },
      ],
      actor_context: {
        actor_id: 'fail-actor-c',
        actor_type: 'human',
        identity_id: 'fail-actor-c-id',
        session_id: 'fail-session-c',
      },
      seed: 0xCAFEBABE,
    });

    expect(report.result.commands_rejected).toBeGreaterThan(0);
  });

  it('Test D: invalid state transition is rejected', async () => {
    const report = await runner.run({
      scenario_id: 'SIM-002-TREASURY-TRANSFER-APPROVAL',
      commands: [
        {
          command_id: 'fail-d-001',
          command_name: 'treasury.transfer.execute',
          domain: 'treasury',
          aggregate: 'transfer_order',
          payload: {
            transfer_order_id: 'nonexistent-transfer',
          },
          capability_id: 'treasury.transfer.execute',
          scope: 'treasury.transfer:*',
          expected_result: 'REJECTED',
        },
      ],
      actor_context: {
        actor_id: 'fail-actor-d',
        actor_type: 'system',
        identity_id: 'fail-actor-d-id',
        session_id: 'fail-session-d',
      },
      seed: 0xCAFEBABE,
    });

    expect(report.result.commands_rejected).toBeGreaterThan(0);
  });
});

describe('Phase 10A Deterministic Replay', () => {
  it('produces identical replay hashes across runs', async () => {
    const registry = loadCompiledRegistry();
    const compiled = registry['SIM-001-VAULT-FUNDING-LIFECYCLE'];
    const scenario = {
      scenario_id: 'REPLAY-1',
      commands: compiled.commands,
      actor_context: compiled.actors[0],
      seed: 0xDEADBEEF,
    };

    const first = await runner.run(scenario);
    const second = await runner.run({ ...scenario, scenario_id: 'REPLAY-2' });

    expect(first.result.deterministic_replay_hash).toBe(second.result.deterministic_replay_hash);
  });
});

describe('Phase 10A Merkle Audit', () => {
  it('generates consistent merkle root for a scenario', async () => {
    const registry = loadCompiledRegistry();
    const compiled = registry['SIM-001-VAULT-FUNDING-LIFECYCLE'];
    const scenario = {
      scenario_id: 'SIM-001-VAULT-FUNDING-LIFECYCLE',
      commands: compiled.commands,
      actor_context: compiled.actors[0],
      seed: 0xDEADBEEF,
    };

    const report = await runner.run(scenario);

    expect(report.merkle_root).toBeTruthy();
    expect(report.merkle_root).toHaveLength(64);
    expect(report.result.events_generated).toBeGreaterThan(0);
  });
});

describe('Phase 10A Compiler Authority', () => {
  it('simulation registry exists and is generated by compiler', async () => {
    const registry = loadCompiledRegistry();
    expect(registry).toBeDefined();
    expect(Object.keys(registry).length).toBeGreaterThan(0);
  });

  it('compiled scenario preserves YAML scenario_id', async () => {
    const registry = loadCompiledRegistry();
    const firstKey = Object.keys(registry)[0];
    expect(firstKey).toBeTruthy();
    expect(registry[firstKey].scenario_id).toBe(firstKey);
  });
});
