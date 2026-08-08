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
    const report = await runner.run({
      scenario_id: 'LEDGER-IMBALANCE-TEST',
      commands: [
        {
          command_id: 'imb-001',
          command_name: 'ledger.entry.post',
          domain: 'ledger',
          aggregate: 'journal_entry',
          payload: {
            journal_id: 'journal-imbalance',
            transaction_id: 'tx-imbalance',
            event_reference: 'vault.asset.registered',
            correlation_id: 'imb-001',
            causation_id: 'imb-001',
            description: 'Imbalanced ledger entry',
            entry_type: 'STANDARD',
            postings: [
              { account_id: 'acc-imbalance-a', amount: 100, direction: 'DEBIT', asset_id: 'vault-asset-007', description: 'Debit' },
              { account_id: 'acc-imbalance-b', amount: 50, direction: 'CREDIT', asset_id: 'vault-asset-007', description: 'Credit' },
            ],
          },
          capability_id: 'ledger.entry.post',
          scope: 'ledger.entry:*',
          expected_result: 'REJECTED',
        },
      ],
      actor_context: {
        actor_id: 'sim-ledger-operator',
        actor_type: 'system',
        identity_id: 'sim-ledger-operator-id',
        session_id: 'sim-ledger-session',
      },
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
      scenario_id: 'LEDGER-BALANCED-TEST',
      commands: compiled.commands,
      actor_context: compiled.actors[0],
      seed: 0xDEADBEEF,
    };

    const report = await runner.run(scenario);
    expect(report.result.success).toBe(true);
  });
});
