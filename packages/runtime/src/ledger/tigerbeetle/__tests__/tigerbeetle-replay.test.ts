import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LedgerAdapter } from '../ledger-adapter.js';
import { TigerBeetleClient } from '../tigerbeetle-client.js';
import { AccountMapper } from '../account-mapper.js';
import { TransferMapper } from '../transfer-mapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../../');

describe('Phase 10D Deterministic Ledger Replay', () => {
  const config = {
    tigerbeetleBinaryPath: 'D:/sovr-financial-os-protocol-v1.0.0/Tigerbeetle/tigerbeetle.exe',
    clusterFile: 'D:/sovr-financial-os-protocol-v1.0.0/Tigerbeetle/data/0/cluster.tigerbeetle',
    dataDirectory: 'D:/sovr-financial-os-protocol-v1.0.0/Tigerbeetle/data',
    port: 8080,
    readOnly: true,
    writeEnabled: false,
  };

  const schemaPath = 'D:/sovr-financial-os-protocol-v1.0.0/SOVR-Protocol/governance/tigerbeetle/SOVR_ACCOUNT_SCHEMA.json';

  function buildEvents(replayIndex: number): any[] {
    const registryPath = join(ROOT, 'generated', 'simulation', 'scenarios.registry.json');
    const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
    const compiled = registry.scenarios['SIM-007-SETTLEMENT-LIFECYCLE'];
    return compiled.commands.map((cmd: any, i: number) => ({
      event_id: `evt-replay-${i}`,
      event_name: i === 7 ? 'treasury.settlement.confirmed' : 'treasury.transfer.reserved',
      aggregate_id: `agg-${i}`,
      correlation_id: cmd.command_id,
      payload: i === 7
        ? { settlement_id: 'sim-settlement-007', settlement_reference: 'sim-ref-007', settlement_amount: '5000' }
        : { order_id: `sim-transfer-${i}` },
    }));
  }

  it('Test A: three replays produce identical transfer IDs and hashes', async () => {
    const client = new TigerBeetleClient(config);
    const mapper = new AccountMapper({ schemaPath });
    const transferMapper = new TransferMapper();
    const adapter = new LedgerAdapter(client, mapper, transferMapper, config);

    const replays = [0, 1, 2];
    const results = replays.map((idx) => {
      const events = buildEvents(idx);
      const mappings: any[] = [];
      for (const event of events) {
        const mapping = adapter.mapEventToTransfer(event);
        if (mapping) mappings.push(mapping);
      }
      return {
        transfer_ids: mappings.map(m => m.tigerbeetle_id),
        hashes: mappings.map(m => m.deterministic_hash),
      };
    });

    for (let i = 1; i < results.length; i++) {
      expect(results[i].transfer_ids).toEqual(results[0].transfer_ids);
      expect(results[i].hashes).toEqual(results[0].hashes);
    }
  });

  it('Test B: replay produces identical shadow execution hashes', async () => {
    const client = new TigerBeetleClient(config);
    const mapper = new AccountMapper({ schemaPath });
    const transferMapper = new TransferMapper();
    const adapter = new LedgerAdapter(client, mapper, transferMapper, config);

    const hashes: string[] = [];
    for (let i = 0; i < 3; i++) {
      const events = buildEvents(i);
      const result = await adapter.shadowExecute('REPLAY-DETERMINISTIC', events, []);
      hashes.push(result.deterministic_hash);
    }

    expect(new Set(hashes).size).toBe(1);
  });
});
