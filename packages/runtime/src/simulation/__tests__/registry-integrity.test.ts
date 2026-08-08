import { describe, it, expect } from 'vitest';
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

describe('Phase 10A.1 Registry Tampering Tests', () => {
  it('rejects scenario with tampered command name', async () => {
    const registry = loadRegistry();
    const original = JSON.stringify(registry.scenarios['SIM-001-VAULT-FUNDING-LIFECYCLE'].commands);
    registry.scenarios['SIM-001-VAULT-FUNDING-LIFECYCLE'].commands = [
      {
        command_id: 'tampered-001',
        command_name: 'ledger.destroy',
        domain: 'ledger',
        aggregate: 'journal_entry',
        payload: {},
        capability_id: 'ledger.destroy',
        scope: 'ledger:*',
        expected_result: 'REJECTED',
      },
    ];
    saveRegistry(registry);

    const report = await runner.run({
      scenario_id: 'SIM-001-VAULT-FUNDING-LIFECYCLE',
      commands: registry.scenarios['SIM-001-VAULT-FUNDING-LIFECYCLE'].commands,
      actor_context: { actor_id: 'tampered', actor_type: 'human', identity_id: 'tampered-id', session_id: 'tampered-session' },
      seed: 0xDEADBEEF,
    });

    registry.scenarios['SIM-001-VAULT-FUNDING-LIFECYCLE'].commands = JSON.parse(original);
    saveRegistry(registry);

    expect(report.result.success).toBe(false);
    expect(report.result.error).toMatch(/AUTHORITY_REGISTRY_INTEGRITY_FAILURE/);
  });

  it('rejects scenario with tampered scenario_id', async () => {
    const registry = loadRegistry();
    const originalKey = 'SIM-001-VAULT-FUNDING-LIFECYCLE';
    const tamperedKey = 'TAMPERED-SIM-001';
    registry.scenarios[tamperedKey] = { ...registry.scenarios[originalKey], scenario_id: tamperedKey };
    saveRegistry(registry);

    const report = await runner.run({
      scenario_id: tamperedKey,
      commands: registry.scenarios[tamperedKey].commands,
      actor_context: { actor_id: 'tampered', actor_type: 'human', identity_id: 'tampered-id', session_id: 'tampered-session' },
      seed: 0xDEADBEEF,
    });

    delete registry.scenarios[tamperedKey];
    saveRegistry(registry);

    expect(report.result.success).toBe(false);
    expect(report.result.error).toMatch(/AUTHORITY_REGISTRY_INTEGRITY_FAILURE/);
  });

  it('accepts scenario when registry is intact', async () => {
    const registry = loadRegistry();
    const scenario = registry.scenarios['SIM-001-VAULT-FUNDING-LIFECYCLE'];
    const report = await runner.run({
      scenario_id: scenario.scenario_id,
      commands: scenario.commands,
      actor_context: scenario.actors[0],
      seed: 0xDEADBEEF,
    });

    expect(report.result.error).toBeUndefined();
  });
});
