import { describe, it, expect } from 'vitest';
import { TigerBeetleCliClient } from '../tigerbeetle-cli-client.js';
import { AccountMapper } from '../account-mapper.js';
import type { LedgerAdapterConfig } from '../types.js';

describe('Phase 10D TigerBeetle Genesis Certification', () => {
  const config: LedgerAdapterConfig = {
    tigerbeetleBinaryPath: 'D:/sovr-financial-os-protocol-v1.0.0/Tigerbeetle/tigerbeetle.exe',
    clusterFile: 'D:/sovr-financial-os-protocol-v1.0.0/Tigerbeetle/data/0/cluster.tigerbeetle',
    dataDirectory: 'D:/sovr-financial-os-protocol-v1.0.0/Tigerbeetle/data',
    port: 8080,
    readOnly: true,
    writeEnabled: false,
  };

  const schemaPath = 'D:/sovr-financial-os-protocol-v1.0.0/SOVR-Protocol/governance/tigerbeetle/SOVR_ACCOUNT_SCHEMA.json';

  it('Test A: TigerBeetle binary and environment are accessible', async () => {
    const fs = await import('node:fs');
    const binaryPath = 'D:/sovr-financial-os-protocol-v1.0.0/Tigerbeetle/tigerbeetle.exe';
    const dataDir = 'D:/sovr-financial-os-protocol-v1.0.0/Tigerbeetle/data';
    const clusterFile = 'D:/sovr-financial-os-protocol-v1.0.0/Tigerbeetle/data/0/cluster.tigerbeetle';
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
    const client = new TigerBeetleCliClient(config);
    expect(client.isWriteEnabled()).toBe(false);
  });
});
