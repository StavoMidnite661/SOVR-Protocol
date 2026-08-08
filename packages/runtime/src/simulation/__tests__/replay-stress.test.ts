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

describe('Phase 10A.1 Deterministic Replay Stress Test', () => {
  it('produces identical results across 100 runs', async () => {
    const registry = loadCompiledRegistry();
    const compiled = registry['SIM-001-VAULT-FUNDING-LIFECYCLE'];
    const scenario = {
      scenario_id: 'REPLAY-STRESS',
      commands: compiled.commands,
      actor_context: compiled.actors[0],
      seed: 0xDEADBEEF,
    };

    const hashes: string[] = [];
    for (let i = 0; i < 100; i++) {
      const report = await runner.run(scenario);
      hashes.push(report.result.deterministic_replay_hash);
    }

    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(1);
  });
});
