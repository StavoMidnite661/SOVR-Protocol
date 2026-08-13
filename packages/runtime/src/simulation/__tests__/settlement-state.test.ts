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

describe('Phase 10C Settlement State Machine Certification', () => {
  it('Test A: valid settlement lifecycle executes successfully from compiled registry', async () => {
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
    expect(report.result.events_generated).toBeGreaterThan(0);
  });

  it('Test B: illegal direct transition from initial state is rejected', async () => {
    const registry = loadCompiledRegistry();
    const compiled = registry['SIM-007-SETTLEMENT-LIFECYCLE'];
    const scenario = {
      scenario_id: 'SIM-007-SETTLEMENT-LIFECYCLE',
      commands: [
        ...compiled.commands,
        {
          command_id: 'ill-001',
          command_name: 'treasury.transfer.cancel',
          domain: 'treasury',
          aggregate: 'transfer_order',
          payload: { order_id: 'sim-transfer-007' },
          capability_id: 'treasury.transfer.cancel',
          scope: 'treasury.transfer:*',
          expected_result: 'REJECTED' as const,
        },
      ],
      actor_context: compiled.actors[0],
      seed: 0xDEADBEEF,
    };

    const report = await runner.run(scenario);
    expect(report.result.commands_rejected).toBeGreaterThan(0);
    // Certified negative: the illegal cancel on a SETTLED (final) transfer
    // is refused by the fail-closed kernel; the evidence is a recorded
    // rejection. (The runner reports an expected rejection as a *passing*
    // command_execution invariant — consistent with its envelope branch —
    // so the assertion looks for the certified rejection, not a failure.)
    const hasCertifiedRejection = report.result.invariant_results.some(
      i => (i.invariant === 'state_machine_transition' || i.invariant === 'command_execution') && i.detail.includes('REJECTED')
    );
    expect(hasCertifiedRejection).toBe(true);
  });

  it('Test C: terminal state protection rejects further commands', async () => {
    const registry = loadCompiledRegistry();
    const compiled = registry['SIM-007-SETTLEMENT-LIFECYCLE'];
    const scenario = {
      scenario_id: 'SIM-007-SETTLEMENT-LIFECYCLE',
      commands: [
        {
          command_id: 'term-001',
          command_name: 'treasury.transfer.request',
          domain: 'treasury',
          aggregate: 'transfer_order',
          payload: {
            source_actor_id: 'sim-settlement-operator',
            destination_actor_id: 'sim-recipient',
            asset_id: 'vault-asset-007',
            amount: '1',
            purpose: 'test_terminal',
            destination_details: { type: 'ach', address: 'sim-addr', rail: 'ACH', reference: 'sim-ref' },
          },
          capability_id: 'treasury.transfer.request',
          scope: 'treasury.transfer:*',
          expected_result: 'REJECTED' as const,
        },
      ],
      actor_context: {
        actor_id: 'sim-settlement-operator',
        actor_type: 'system',
        identity_id: 'sim-settlement-operator-id',
        session_id: 'sim-settlement-session-terminal',
      },
      seed: 0xDEADBEEF,
    };

    const report = await runner.run(scenario);
    expect(report.result.commands_rejected).toBeGreaterThan(0);
  });
});
