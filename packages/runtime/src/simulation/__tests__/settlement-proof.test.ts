import { describe, it, expect } from 'vitest';
import { SimulationRunner } from '../simulation-runner.js';
import { SettlementProofGenerator } from '../../audit/reconstruction/SettlementProofGenerator.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../');
const runner = new SimulationRunner();
const proofGenerator = new SettlementProofGenerator();

function loadCompiledRegistry(): Record<string, any> {
  const content = readFileSync(join(ROOT, 'generated', 'simulation', 'scenarios.registry.json'), 'utf8');
  const registry = JSON.parse(content);
  return registry.scenarios;
}

describe('Phase 10C Settlement Proof Generation', () => {
  it('generates settlement proof package for SIM-007', async () => {
    const registry = loadCompiledRegistry();
    const compiled = registry['SIM-007-SETTLEMENT-LIFECYCLE'];
    const scenario = {
      scenario_id: 'SIM-007-SETTLEMENT-LIFECYCLE',
      commands: compiled.commands,
      actor_context: compiled.actors[0],
      seed: 0xDEADBEEF,
    };

    const report = await runner.run(scenario);
    expect(report.result.success).toBe(true);

    const proof = proofGenerator.generate(scenario.scenario_id, report.result.event_hashes.map((h, i) => ({
      event_id: `evt-${i}`,
      event_name: i === 0 ? 'intent.received' : i === 4 ? 'ledger.entry.posted' : i === 7 ? 'treasury.settlement.confirmed' : 'treasury.transfer.reserved',
      aggregate_id: `agg-${i}`,
      correlation_id: scenario.commands[i]?.command_id ?? `cmd-${i}`,
      payload: i === 7 ? { settlement_id: 'sim-settlement-007', settlement_reference: 'sim-ref-007', settlement_amount: '5000' } : i === 4 ? { transaction_id: 'tx-007', postings: [{ account_id: 'account-007-a', amount: 50, direction: 'DEBIT' }] } : { order_id: `sim-transfer-${i}` },
      projection_effect: { target: 'treasury_projection' },
    })), scenario.commands);

    expect(proof.settlement_id).toBe('sim-settlement-007');
    expect(proof.merkle_root).toBeTruthy();
    expect(proof.deterministic_hash).toBeTruthy();
    expect(proof.ledger_entries.length).toBeGreaterThan(0);
    expect(proof.reserve_changes.length).toBeGreaterThan(0);

    proofGenerator.write(proof);
    const proofPath = join(ROOT, 'generated', 'audit', 'settlements', `SETTLEMENT-${scenario.scenario_id.replace(/[^A-Z0-9]/g, '')}-PROOF.json`);
    expect(require('fs').existsSync(proofPath)).toBe(true);
  });
});
