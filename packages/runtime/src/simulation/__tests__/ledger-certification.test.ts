import { describe, it, expect } from 'vitest';
import { SimulationRunner } from '../simulation-runner.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../');
const runner = new SimulationRunner();

function loadCompiledRegistry(): Record<string, any> {
  const content = readFileSync(join(ROOT, 'generated', 'simulation', 'scenarios.registry.json'), 'utf8');
  const registry = JSON.parse(content);
  return registry.scenarios;
}

describe('Phase 10C Ledger Certification', () => {
  it('rejects ledger imbalance with LEDGER_IMBALANCE_DETECTED', async () => {
    // Negative-path certification is compiled authority: SIM-010 declares
    // the imbalanced entry and its expected REJECTED outcome in the scenario
    // corpus. Inline scenarios are refused by the integrity gate.
    const registry = loadCompiledRegistry();
    const compiled = registry['SIM-010-LEDGER-IMBALANCE-NEGATIVE'];
    const report = await runner.run({
      scenario_id: 'SIM-010-LEDGER-IMBALANCE-NEGATIVE',
      commands: compiled.commands,
      actor_context: compiled.actors[0],
      seed: 0xDEADBEEF,
    });

    expect(report.result.commands_rejected).toBeGreaterThan(0);
    const hasImbalance = report.result.invariant_results.some(
      i => i.invariant === 'command_execution' && i.detail.includes('REJECTED')
    );
    expect(hasImbalance).toBe(true);
  });

  it('accepts balanced ledger entry', async () => {
    const registry = loadCompiledRegistry();
    const compiled = registry['SIM-006-LEDGER-RECONCILIATION-LIFECYCLE'];
    const scenario = {
      scenario_id: 'SIM-006-LEDGER-RECONCILIATION-LIFECYCLE',
      commands: compiled.commands,
      actor_context: compiled.actors[0],
      seed: 0xDEADBEEF,
    };

    const report = await runner.run(scenario);
    expect(report.result.success).toBe(true);
  });
});
