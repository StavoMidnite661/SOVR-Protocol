import { describe, it, expect } from 'vitest';
import { SimulationRunner } from '../simulation-runner.js';

const runner = new SimulationRunner();

describe('Phase 10A.1 Capability Boundary Validation', () => {
  it('rejects ai_agent actor for vault.asset.register (human-only)', async () => {
    const report = await runner.run({
      scenario_id: 'SIM-001-VAULT-FUNDING-LIFECYCLE',
      commands: [
        {
          command_id: 'cap-001',
          command_name: 'vault.asset.register',
          domain: 'vault',
          aggregate: 'asset',
          payload: {
            asset_id: 'cap-boundary-asset',
            asset_type: 'stablecoin',
            issuer_id: 'ai-agent',
            ownership_id: 'ai-agent',
            custody_provider: 'sovr_internal',
            custody_location: 'sovr_internal_vault_1',
            native_unit: 'wei',
            precision: 18,
            valuation_source: 'internal',
            reserve_ratio: '1.0',
            face_value: '1000',
            quantity: '1000',
          },
          capability_id: 'vault.asset.create',
          scope: 'vault.asset:*',
          expected_result: 'REJECTED',
        },
      ],
      actor_context: {
        actor_id: 'ai-agent',
        actor_type: 'ai_agent',
        identity_id: 'ai-agent-identity',
        session_id: 'ai-agent-session',
      },
      seed: 0xDEADBEEF,
    });

    console.log('CAP-BOUNDARY-001 report:', JSON.stringify({
      success: report.result.success,
      executed: report.result.commands_executed,
      rejected: report.result.commands_rejected,
      error: report.result.error,
      invariant_results: report.result.invariant_results,
    }, null, 2));

    expect(report.result.commands_rejected).toBeGreaterThan(0);
  });

  it('rejects actor_type mismatch for system command', async () => {
    const report = await runner.run({
      scenario_id: 'SIM-002-TREASURY-TRANSFER-APPROVAL',
      commands: [
        {
          command_id: 'cap-002',
          command_name: 'treasury.transfer.execute',
          domain: 'treasury',
          aggregate: 'transfer_order',
          payload: {
            transfer_order_id: 'nonexistent-transfer',
          },
          capability_id: 'treasury.transfer.execute',
          scope: 'treasury.transfer:*',
          expected_result: 'REJECTED',
        },
      ],
      actor_context: {
        actor_id: 'human-actor',
        actor_type: 'human',
        identity_id: 'human-identity',
        session_id: 'human-session',
      },
      seed: 0xDEADBEEF,
    });

    console.log('CAP-BOUNDARY-002 report:', JSON.stringify({
      success: report.result.success,
      executed: report.result.commands_executed,
      rejected: report.result.commands_rejected,
      error: report.result.error,
      invariant_results: report.result.invariant_results,
    }, null, 2));

    expect(report.result.commands_rejected).toBeGreaterThan(0);
  });
});
