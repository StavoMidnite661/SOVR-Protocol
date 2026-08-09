import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SOVRAccountMapping } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../');

export interface AccountMapperConfig {
  schemaPath: string;
}

export class AccountMapper {
  private readonly mappings: Map<string, SOVRAccountMapping> = new Map();
  private readonly idToSOVR: Map<number, SOVRAccountMapping> = new Map();

  constructor(config: AccountMapperConfig) {
    this.loadSchema(config.schemaPath);
  }

  getBySOVRId(sovrId: string): SOVRAccountMapping | undefined {
    return this.mappings.get(sovrId);
  }

  getByTigerBeetleId(tigerBeetleId: number): SOVRAccountMapping | undefined {
    return this.idToSOVR.get(tigerBeetleId);
  }

  resolveTigerBeetleId(sovrId: string): number {
    const mapping = this.mappings.get(sovrId);
    if (!mapping) {
      throw new Error(`UNMAPPED_ACCOUNT: SOVR account ${sovrId} has no TigerBeetle mapping in genesis schema`);
    }
    if (mapping.state === 'CLOSED') {
      throw new Error(`ACCOUNT_CLOSED: TigerBeetle account ${mapping.tigerbeetle_id} for ${sovrId} is in CLOSED state`);
    }
    return mapping.tigerbeetle_id;
  }

  validateDeterministicMapping(): boolean {
    for (const [sovrId, mapping] of this.mappings) {
      const expectedId = this.deterministicId(sovrId);
      if (mapping.tigerbeetle_id !== expectedId) {
        throw new Error(
          `DETERMINISTIC_MAPPING_FAILURE: SOVR ${sovrId} expected TigerBeetle ID ${expectedId} but found ${mapping.tigerbeetle_id}`
        );
      }
    }
    return true;
  }

  listMappings(): SOVRAccountMapping[] {
    return Array.from(this.mappings.values());
  }

  private deterministicId(sovrId: string): number {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(sovrId).digest('hex');
    const numeric = parseInt(hash.slice(0, 8), 16);
    return numeric % 1000000;
  }

  private loadSchema(path: string): void {
    if (!existsSync(path)) {
      throw new Error(`ACCOUNT_SCHEMA_NOT_FOUND: ${path}`);
    }
    const schema = JSON.parse(readFileSync(path, 'utf8'));
    for (const account of schema.accounts ?? []) {
      const mapping: SOVRAccountMapping = {
        sovr_id: account.sovr_id,
        tigerbeetle_id: account.tigerbeetle_id,
        ledger: account.ledger,
        purpose: account.purpose,
        state: account.state ?? 'GENESIS',
        ownership_domain: account.ownership_domain,
        currency: account.currency ?? 'USD',
        historical_code: account.historical_code ?? '',
      };
      this.mappings.set(mapping.sovr_id, mapping);
      this.idToSOVR.set(mapping.tigerbeetle_id, mapping);
    }
  }
}
