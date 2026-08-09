import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LedgerAdapter } from '../ledger-adapter.js';
import { TigerBeetleClient } from '../tigerbeetle-client.js';
import { AccountMapper } from '../account-mapper.js';
import { TransferMapper } from '../transfer-mapper.js';
import { ShadowLedgerAdapter } from '../shadow-ledger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../../');

describe('Phase 10D Shadow Ledger Execution', () => {
  const config = {
    tigerbeetleBinaryPath: 'D:/sovr-financial-os-protocol-v1.0.0/Tigerbeetle/tigerbeetle.exe',
    clusterFile: 'D:/sovr-financial-os-protocol-v1.0.0/Tigerbeetle/data/0/cluster.tigerbeetle',
    dataDirectory: 'D:/sovr-financial-os-protocol-v1.0.0/Tigerbeetle/data',
    port: 8080,
    readOnly: true,
    writeEnabled: false,
  };

  const schemaPath = 'D:/sovr-financial-os-protocol-v1.0.0/SOVR-Protocol/governance/tigerbeetle/SOVR_ACCOUNT_SCHEMA.json';

  it('Test A: SIM-007 produces deterministic ledger intents without writing', async () => {
    const client = new TigerBeetleClient(config);
    const mapper = new AccountMapper({ schemaPath });
    const transferMapper = new TransferMapper();
    const adapter = new LedgerAdapter(client, mapper, transferMapper, config);
    const shadow = new ShadowLedgerAdapter(adapter);

    const registryPath = join(ROOT, 'generated', 'simulation', 'scenarios.registry.json');
    const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
    const compiled = registry.scenarios['SIM-007-SETTLEMENT-LIFECYCLE'];

    const events = compiled.commands.map((cmd: any, i: number) => ({
      event_id: `evt-${i}`,
      event_name: i === 0 ? 'intent.received' : i === 7 ? 'treasury.settlement.confirmed' : 'treasury.transfer.reserved',
      aggregate_id: `agg-${i}`,
      correlation_id: cmd.command_id,
      payload: i === 7
        ? {
            settlement_id: 'sim-settlement-007',
            settlement_reference: 'sim-ref-007',
            settlement_amount: '5000',
            postings: [
              { account_id: 'SOVR-ACCOUNT-000003', amount: 5000, direction: 'DEBIT' },
              { account_id: 'SOVR-ACCOUNT-000004', amount: 5000, direction: 'CREDIT' },
            ],
          }
        : {
            order_id: `sim-transfer-${i}`,
            postings: [
              { account_id: 'SOVR-ACCOUNT-000001', amount: 50, direction: 'DEBIT' },
              { account_id: 'SOVR-ACCOUNT-000002', amount: 50, direction: 'CREDIT' },
            ],
          },
    }));

    const result = await shadow.shadowExecute('SIM-007', events, compiled.commands);

    expect(result.verified).toBe(true);
    expect(result.expected_tigerbeetle_operations.length).toBeGreaterThan(0);
    expect(result.status).toBe('SHADOW_ONLY');
  });

  it('Test B: shadow adapter blocks writes', async () => {
    const shadow = new ShadowLedgerAdapter(null as any);
    expect(shadow.isWriteEnabled()).toBe(false);
  });

  it('Test C: shadow execution output persists to generated/audit', async () => {
    const client = new TigerBeetleClient(config);
    const mapper = new AccountMapper({ schemaPath });
    const transferMapper = new TransferMapper();
    const adapter = new LedgerAdapter(client, mapper, transferMapper, config);
    const shadow = new ShadowLedgerAdapter(adapter);

    const registryPath = join(ROOT, 'generated', 'simulation', 'scenarios.registry.json');
    const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
    const compiled = registry.scenarios['SIM-007-SETTLEMENT-LIFECYCLE'];
    const events = compiled.commands.map((cmd: any, i: number) => ({
      event_id: `evt-shadow-${i}`,
      event_name: i === 7 ? 'treasury.settlement.confirmed' : 'treasury.transfer.reserved',
      aggregate_id: `agg-shadow-${i}`,
      correlation_id: cmd.command_id,
      payload: i === 7
        ? {
            settlement_id: 'sim-settlement-007',
            settlement_reference: 'sim-ref-007',
            settlement_amount: '5000',
            postings: [
              { account_id: 'SOVR-ACCOUNT-000003', amount: 5000, direction: 'DEBIT' },
              { account_id: 'SOVR-ACCOUNT-000004', amount: 5000, direction: 'CREDIT' },
            ],
          }
        : {
            order_id: `sim-transfer-${i}`,
            postings: [
              { account_id: 'SOVR-ACCOUNT-000001', amount: 50, direction: 'DEBIT' },
              { account_id: 'SOVR-ACCOUNT-000002', amount: 50, direction: 'CREDIT' },
            ],
          },
    }));

    await shadow.shadowExecute('SIM-007-SHADOW', events, compiled.commands);
    const outputPath = join(ROOT, 'generated', 'audit', 'tigerbeetle-shadow-execution.json');
    const content = readFileSync(outputPath, 'utf8');
    const output = JSON.parse(content);
    expect(output.scenario_id).toBe('SIM-007-SHADOW');
    expect(output.status).toBe('SHADOW_ONLY');
  });
});
