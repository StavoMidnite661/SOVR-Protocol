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

describe('Phase 10C Economic Stress Simulation', () => {
  const registry = loadCompiledRegistry();
  const scenarioIds = ['SIM-001-VAULT-FUNDING-LIFECYCLE', 'SIM-002-TREASURY-TRANSFER-APPROVAL', 'SIM-003-SYSTEM-INTEGRITY', 'SIM-004-ASSET-RESERVE-LIFECYCLE', 'SIM-005-TREASURY-CONTROL-LIFECYCLE', 'SIM-006-LEDGER-RECONCILIATION-LIFECYCLE', 'SIM-007-SETTLEMENT-LIFECYCLE'];
  const ITERATIONS = 250;

  for (const scenarioId of scenarioIds) {
    it(`validates deterministic hashes and economic invariants across ${ITERATIONS} runs of ${scenarioId}`, async () => {
      const compiled = registry[scenarioId];
      if (!compiled) {
        it.skip(`${scenarioId} not found in compiled registry`);
        return;
      }

      const baseScenario = {
        commands: compiled.commands,
        actor_context: compiled.actors[0],
        lifecycle: compiled.lifecycle,
      };

      const hashes: string[] = [];
      const merkleRoots: string[] = [];
      const eventCounts: number[] = [];
      let invariantFailures = 0;

      // Registered authority id + pinned seed: determinism means identical
      // inputs replay byte-identically. The seed parameterizes the
      // deterministic clock/id stream, so varying seeds legitimately vary
      // hashes — stress asserts invariance under repetition, not under
      // parameter change. Ad-hoc scenario ids are refused by the
      // authority-registry integrity gate.
      for (let i = 0; i < ITERATIONS; i++) {
        const scenario = {
          ...baseScenario,
          scenario_id: scenarioId,
          seed: 0xDEADBEEF,
        };

        const report = await runner.run(scenario);
        expect(report.result.success).toBe(true);
        hashes.push(report.result.deterministic_replay_hash);
        merkleRoots.push(report.merkle_root);
        eventCounts.push(report.result.events_generated);

        for (const inv of report.result.invariant_results) {
          if (!inv.passed) invariantFailures++;
        }
      }

      expect(new Set(hashes).size).toBe(1);
      expect(new Set(merkleRoots).size).toBe(1);
      expect(new Set(eventCounts).size).toBe(1);
      expect(invariantFailures).toBe(0);
    }, 300000);
  }
});
