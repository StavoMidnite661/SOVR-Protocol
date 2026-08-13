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

describe('Phase 10C Deterministic Settlement Replay', () => {
  it('runs SIM-007 100 times and produces identical hashes', async () => {
    const registry = loadCompiledRegistry();
    const compiled = registry['SIM-007-SETTLEMENT-LIFECYCLE'];
    // Authority-registry integrity: the runner only accepts scenario ids
    // compiled into generated/simulation/scenarios.registry.json; ad-hoc ids
    // are correctly refused. Determinism is asserted on identical inputs:
    // same registered scenario + same seed must replay byte-identically.
    // (The seed salts the deterministic clock/id stream, so per-iteration
    // seeds would produce different hashes by design — that was never a
    // determinism violation, only a stale test construction.)
    const baseScenario = {
      commands: compiled.commands,
      actor_context: compiled.actors[0],
      lifecycle: compiled.lifecycle,
    };

    const hashes: string[] = [];
    for (let i = 0; i < 100; i++) {
      const scenario = {
        ...baseScenario,
        scenario_id: 'SIM-007-SETTLEMENT-LIFECYCLE',
        seed: 0xDEADBEEF,
      };
      const report = await runner.run(scenario);
      expect(report.result.success).toBe(true);
      hashes.push(report.result.deterministic_replay_hash);
    }

    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(1);
  });
});
