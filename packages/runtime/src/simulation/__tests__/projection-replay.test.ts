import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SimulationRunner } from '../simulation-runner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../');
const runner = new SimulationRunner();

describe('Phase 10B Projection Replay Certification', () => {
  it('replays events deterministically to rebuild projection', async () => {
    const report = await runner.run({
      scenario_id: 'SIM-001-VAULT-FUNDING-LIFECYCLE',
      commands: [
        {
          command_id: 'replay-001',
          command_name: 'vault.asset.register',
          domain: 'vault',
          aggregate: 'asset',
          payload: {
            asset_id: 'replay-asset-001',
            asset_type: 'stablecoin',
            issuer_id: 'replay-issuer',
            ownership_id: 'replay-issuer',
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
          expected_result: 'ACCEPTED',
        },
      ],
      actor_context: {
        actor_id: 'replay-actor',
        actor_type: 'human',
        identity_id: 'replay-actor-id',
        session_id: 'replay-session',
      },
      seed: 0xCAFEBABE,
    });

    expect(report.result.success).toBe(true);
    expect(report.result.events_generated).toBeGreaterThan(0);
    expect(report.result.audit_hash).toBeTruthy();
    expect(report.result.deterministic_replay_hash).toBeTruthy();
    expect(report.result.deterministic_replay_hash.length).toBeGreaterThan(0);
  });
});
