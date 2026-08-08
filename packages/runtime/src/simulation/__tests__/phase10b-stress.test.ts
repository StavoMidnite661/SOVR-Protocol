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

describe('Phase 10B Deterministic Stress Simulation', () => {
  const registry = loadCompiledRegistry();
  const scenarioIds = Object.keys(registry);
  const ITERATIONS = 100;

  for (const scenarioId of scenarioIds) {
    it(`produces identical deterministic hash across ${ITERATIONS} runs of ${scenarioId}`, async () => {
      const compiled = registry[scenarioId];
      const scenario = {
        scenario_id: compiled.scenario_id,
        commands: compiled.commands,
        actor_context: compiled.actors[0],
        seed: 0xDEADBEEF,
      };

      const hashes: string[] = [];
      const merkleRoots: string[] = [];
      const eventCounts: number[] = [];
      const projectionHashes: string[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const report = await runner.run(scenario);
        expect(report.result.success).toBe(true);
        hashes.push(report.result.deterministic_replay_hash);
        merkleRoots.push(report.merkle_root);
        eventCounts.push(report.result.events_generated);
        projectionHashes.push(report.result.audit_hash);
      }

      expect(new Set(hashes).size).toBe(1);
      expect(new Set(merkleRoots).size).toBe(1);
      expect(new Set(eventCounts).size).toBe(1);
      expect(new Set(projectionHashes).size).toBe(1);
    }, 120000);
  }
});
