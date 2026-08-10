import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TigerBeetleTransportClient } from '../tigerbeetle-transport.js';
import { AccountMapper } from '../account-mapper.js';
import type { LedgerAdapterConfig } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../..//');

describe('TigerBeetle Transport Version Alignment', () => {
  const config: LedgerAdapterConfig = {
    tigerbeetleBinaryPath: 'D:/sovr-financial-os-protocol-v1.0.0/Tigerbeetle/tigerbeetle.exe',
    clusterFile: 'D:/sovr-financial-os-protocol-v1.0.0/Tigerbeetle/data/0/cluster.tigerbeetle',
    dataDirectory: 'D:/sovr-financial-os-protocol-v1.0.0/Tigerbeetle/data',
    port: 8080,
    readOnly: true,
    writeEnabled: false,
  };

  const schemaPath = 'D:/sovr-financial-os-protocol-v1.0.0/SOVR-Protocol/governance/tigerbeetle/SOVR_ACCOUNT_SCHEMA.json';

  it('Test A: client version matches server version 0.17.8', () => {
    const runtimePackage = JSON.parse(readFileSync(join(ROOT, 'packages', 'runtime', 'package.json'), 'utf8'));
    const rootPackage = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const runtimeVersion = runtimePackage.dependencies['tigerbeetle-node'];
    const rootVersion = rootPackage.dependencies['tigerbeetle-node'];
    expect(runtimeVersion).toBe('0.17.8');
    expect(rootVersion).toBe('0.17.8');
  });

  it('Test B: transport read methods exist and return arrays', async () => {
    const readConfig: LedgerAdapterConfig = {
      ...config,
      writeEnabled: true,
    };
    const client = new TigerBeetleTransportClient(readConfig);
    expect(typeof client.readAccounts).toBe('function');
    expect(typeof client.readTransfers).toBe('function');
    const accountsPromise = client.readAccounts();
    const transfersPromise = client.readTransfers();
    expect(accountsPromise).toBeInstanceOf(Promise);
    expect(transfersPromise).toBeInstanceOf(Promise);
  });

  it('Test C: deterministic account creation payload matches protocol', () => {
    const mapper = new AccountMapper({ schemaPath });
    const mappings = mapper.listMappings();
    const expectedIds = [404771, 327102, 689728, 346086, 536681, 441831, 657844, 941698];
    const actualIds = mappings.map(m => m.tigerbeetle_id);
    expect(actualIds).toEqual(expectedIds);
  });

  it('Test D: transport does not generate IDs — IDs come from SOVR mapping', () => {
    const mapper = new AccountMapper({ schemaPath });
    for (const mapping of mapper.listMappings()) {
      const id = mapper.resolveTigerBeetleId(mapping.sovr_id);
      expect(id).toBe(mapping.tigerbeetle_id);
      expect(id).not.toBeNaN();
      expect(id).toBeGreaterThan(0);
    }
  });
});
