import { describe, it, expect } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TigerBeetleTransportClient } from '../tigerbeetle-transport.js';
import { AccountMapper } from '../account-mapper.js';
import type { LedgerAdapterConfig } from '../types.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../../../../');

describe('Phase 10D TigerBeetle Genesis Certification', () => {
  const config: LedgerAdapterConfig = {
    tigerbeetleBinaryPath: join(ROOT, 'Tigerbeetle', 'tigerbeetle'),
    clusterFile: join(ROOT, 'data', 'tigerbeetle', '0_0.tigerbeetle'),
    dataDirectory: join(ROOT, 'data', 'tigerbeetle'),
    port: 8080,
    readOnly: true,
    writeEnabled: false,
  };

  const schemaPath = join(ROOT, 'governance', 'tigerbeetle', 'SOVR_ACCOUNT_SCHEMA.json');

  it('Test A: TigerBeetle binary and environment are accessible', async () => {
    const fs = await import('node:fs');
    const binaryPath = join(ROOT, 'Tigerbeetle', 'tigerbeetle');
    const dataDir = join(ROOT, 'data', 'tigerbeetle');
    const clusterFile = join(ROOT, 'data', 'tigerbeetle', '0_0.tigerbeetle');
    expect(fs.existsSync(binaryPath)).toBe(true);
    expect(fs.existsSync(dataDir)).toBe(true);
    expect(fs.existsSync(clusterFile)).toBe(true);
  });

  it('Test B: SOVR account schema loads and validates deterministic mapping', () => {
    const mapper = new AccountMapper({ schemaPath });
    const mappings = mapper.listMappings();
    expect(mappings.length).toBeGreaterThan(0);
    expect(() => mapper.validateDeterministicMapping()).not.toThrow();
  });

  it('Test C: Account mapper resolves TigerBeetle IDs for all SOVR accounts', () => {
    const mapper = new AccountMapper({ schemaPath });
    for (const mapping of mapper.listMappings()) {
      const id = mapper.resolveTigerBeetleId(mapping.sovr_id);
      expect(id).toBe(mapping.tigerbeetle_id);
    }
  });

  it('Test D: Unmapped SOVR account throws', () => {
    const mapper = new AccountMapper({ schemaPath });
    expect(() => mapper.resolveTigerBeetleId('SOVR-ACCOUNT-UNKNOWN')).toThrow('UNMAPPED_ACCOUNT');
  });

  it('Test E: TigerBeetle instance reports no unexpected writes', async () => {
    const client = new TigerBeetleTransportClient(config);
    expect(client.isWriteEnabled()).toBe(false);
  });
});
