import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SimulationRunner } from '../simulation-runner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../');
const runner = new SimulationRunner();

function loadRegistry(): any {
  const content = readFileSync(join(ROOT, 'generated', 'simulation', 'scenarios.registry.json'), 'utf8');
  return JSON.parse(content);
}

function saveRegistry(registry: any): void {
  const content = JSON.stringify(registry, null, 2) + '\n';
  writeFileSync(join(ROOT, 'generated', 'simulation', 'scenarios.registry.json'), content, 'utf8');
}

describe('Phase 10B.1 Registry Version Enforcement', () => {
  it('PASS: accepts abi_version=v1', async () => {
    const registry = loadRegistry();
    registry.abi_version = 'v1';
    saveRegistry(registry);

    const report = await runner.run({
      scenario_id: 'SIM-001-VAULT-FUNDING-LIFECYCLE',
      commands: [
        {
          command_id: 'ver-001',
          command_name: 'vault.asset.register',
          domain: 'vault',
          aggregate: 'asset',
          payload: {
            asset_id: 'ver-asset-001',
            asset_type: 'stablecoin',
            issuer_id: 'ver-issuer',
            ownership_id: 'ver-issuer',
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
      ],
      actor_context: {
        actor_id: 'ver-actor',
        actor_type: 'human',
        identity_id: 'ver-actor-id',
        session_id: 'ver-session',
      },
      seed: 0xDEADBEEF,
    });

    expect(report.result.error).toBeUndefined();
  });

  it('FAIL: rejects abi_version=v2', async () => {
    const registry = loadRegistry();
    registry.abi_version = 'v2';
    saveRegistry(registry);

    const report = await runner.run({
      scenario_id: 'SIM-001-VAULT-FUNDING-LIFECYCLE',
      commands: [
        {
          command_id: 'ver-002',
          command_name: 'vault.asset.register',
          domain: 'vault',
          aggregate: 'asset',
          payload: {
            asset_id: 'ver-asset-002',
            asset_type: 'stablecoin',
            issuer_id: 'ver-issuer',
            ownership_id: 'ver-issuer',
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
      ],
      actor_context: {
        actor_id: 'ver-actor-2',
        actor_type: 'human',
        identity_id: 'ver-actor-2-id',
        session_id: 'ver-session-2',
      },
      seed: 0xCAFEBABE,
    });

    expect(report.result.error).toMatch(/UNSUPPORTED_SIMULATION_REGISTRY_ABI/);
  });

  it('FAIL: rejects missing abi_version', async () => {
    const registry = loadRegistry();
    delete registry.abi_version;
    saveRegistry(registry);

    const report = await runner.run({
      scenario_id: 'SIM-001-VAULT-FUNDING-LIFECYCLE',
      commands: [
        {
          command_id: 'ver-003',
          command_name: 'vault.asset.register',
          domain: 'vault',
          aggregate: 'asset',
          payload: {
            asset_id: 'ver-asset-003',
            asset_type: 'stablecoin',
            issuer_id: 'ver-issuer',
            ownership_id: 'ver-issuer',
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
      ],
      actor_context: {
        actor_id: 'ver-actor-3',
        actor_type: 'human',
        identity_id: 'ver-actor-3-id',
        session_id: 'ver-session-3',
      },
      seed: 0xBAAAAAAD,
    });

    expect(report.result.error).toMatch(/UNSUPPORTED_SIMULATION_REGISTRY_ABI/);
  });

  afterAll(() => {
    const registry = loadRegistry();
    registry.abi_version = 'v1';
    saveRegistry(registry);
  });
});
