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

describe('Phase 10C Economic Event Lineage Certification', () => {
  it('generates economic lineage report with zero orphan events', async () => {
    const registry = loadCompiledRegistry();
    const compiled = registry['SIM-007-SETTLEMENT-LIFECYCLE'];
    const scenario = {
      scenario_id: 'LINEAGE-REPORT-001',
      commands: compiled.commands,
      actor_context: compiled.actors[0],
      lifecycle: { initial_state: 'CREATED', terminal_state: 'VERIFIED' },
      seed: 0xDEADBEEF,
    };

    const report = await runner.run(scenario);
    expect(report.result.success).toBe(true);
    expect(report.result.event_lineage_report).toBeDefined();
    expect(report.result.event_lineage_report?.orphan_events).toBe(0);
    expect(report.result.event_lineage_report?.broken_chains).toBe(0);
  });

  it('generates economic-lineage-report.json with required fields', async () => {
    const registry = loadCompiledRegistry();
    const compiled = registry['SIM-007-SETTLEMENT-LIFECYCLE'];
    const scenario = {
      scenario_id: 'LINEAGE-REPORT-002',
      commands: compiled.commands,
      actor_context: compiled.actors[0],
      lifecycle: { initial_state: 'CREATED', terminal_state: 'VERIFIED' },
      seed: 0xDEADBEEF,
    };

    await runner.run(scenario);
    const reportPath = join(ROOT, 'generated', 'simulation', 'reports', 'LINEAGE-REPORT-002-event-lineage.json');
    const exists = require('fs').existsSync(reportPath);
    expect(exists).toBe(true);

    if (exists) {
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(report.orphan_events).toBe(0);
      expect(report.missing_ledger_entries).toBe(0);
      expect(report.missing_reserve_links).toBe(0);
      expect(report.verified).toBe(true);
    }
  });
});
