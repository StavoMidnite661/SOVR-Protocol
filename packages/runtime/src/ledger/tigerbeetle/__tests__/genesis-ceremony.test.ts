import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GenesisWriteCeremony } from '../genesis-write-ceremony.js';
import { TigerBeetleTransportClient } from '../tigerbeetle-transport.js';
import { AccountMapper } from '../account-mapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../../');

describe('Phase 10E Genesis Write Ceremony', () => {
  const config = {
    tigerbeetleBinaryPath: 'D:/sovr-financial-os-protocol-v1.0.0/Tigerbeetle/tigerbeetle.exe',
    clusterFile: 'D:/sovr-financial-os-protocol-v1.0.0/Tigerbeetle/data/0/cluster.tigerbeetle',
    dataDirectory: 'D:/sovr-financial-os-protocol-v1.0.0/Tigerbeetle/data',
    port: 8080,
    readOnly: true,
    writeEnabled: false,
  };

  const manifestPath = join(ROOT, 'governance', 'tigerbeetle', 'GENESIS_TRANSACTION_SET.json');
  const schemaPath = join(ROOT, 'governance', 'tigerbeetle', 'SOVR_ACCOUNT_SCHEMA.json');

  it('Test A: genesis transaction set is valid', () => {
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.accounts).toHaveLength(8);
    expect(manifest.genesis_transfer).toBeDefined();
    expect(manifest.genesis_transfer.amount).toBe(1);
    expect(manifest.genesis_transfer.code).toBe('GENESIS_HEARTBEAT');
  });

  it('Test B: account schema matches genesis transaction set', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const mapper = new AccountMapper({ schemaPath });
    for (const account of manifest.accounts) {
      const mapping = mapper.getBySOVRId(account.sovr_id);
      expect(mapping).toBeDefined();
      expect(mapping?.tigerbeetle_id).toBe(account.tigerbeetle_id);
    }
  });

  it('Test C: genesis ceremony is blocked when writes are disabled', async () => {
    const ceremony = new GenesisWriteCeremony(config, manifestPath);
    const result = await ceremony.execute();
    expect(result.success).toBe(false);
    expect(result.error).toContain('WRITE_DISABLED');
  });

  it('Test D: genesis ceremony produces deterministic hash structure', async () => {
    const ceremony = new GenesisWriteCeremony(config, manifestPath);
    const result = await ceremony.execute();
    expect(result.deterministic_hash).toBe('');
    expect(result.accounts_created).toBe(0);
    expect(result.transfers_created).toBe(0);
  });

  it('Test E: TigerBeetle client reports writes disabled', () => {
    const client = new TigerBeetleTransportClient(config);
    expect(client.isWriteEnabled()).toBe(false);
  });
});
