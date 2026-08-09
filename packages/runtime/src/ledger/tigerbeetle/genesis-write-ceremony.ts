import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TigerBeetleClient } from './tigerbeetle-client.js';
import { AccountMapper } from './account-mapper.js';
import { TransferMapper } from './transfer-mapper.js';
import { LedgerAdapter } from './ledger-adapter.js';
import type { LedgerAdapterConfig, ShadowExecutionResult } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../../');

export interface GenesisWriteResult {
  success: boolean;
  accounts_created: number;
  transfers_created: number;
  read_back_verified: boolean;
  deterministic_hash: string;
  error?: string;
}

export class GenesisWriteCeremony {
  private readonly client: TigerBeetleClient;
  private readonly adapter: LedgerAdapter;
  private readonly manifestPath: string;
  private readonly outputPath: string;

  constructor(config: LedgerAdapterConfig, manifestPath?: string, outputPath?: string) {
    this.client = new TigerBeetleClient(config);
    this.manifestPath = manifestPath ?? join(ROOT, 'governance', 'tigerbeetle', 'GENESIS_TRANSACTION_SET.json');
    this.outputPath = outputPath ?? join(ROOT, 'generated', 'audit', 'tigerbeetle-genesis-ceremony.json');

    const governanceDir = dirname(this.manifestPath);
    const mapper = new AccountMapper({ schemaPath: join(governanceDir, 'SOVR_ACCOUNT_SCHEMA.json') });
    const transferMapper = new TransferMapper();
    this.adapter = new LedgerAdapter(this.client, mapper, transferMapper, config);
  }

  async execute(): Promise<GenesisWriteResult> {
    if (!this.client.isWriteEnabled()) {
      return { success: false, accounts_created: 0, transfers_created: 0, read_back_verified: false, deterministic_hash: '', error: 'WRITE_DISABLED: REAL_WRITE_AUTHORIZATION does not permit writes' };
    }

    const manifest = JSON.parse(readFileSync(this.manifestPath, 'utf8'));
    const accountsCreated: number[] = [];
    const transfersCreated: number[] = [];

    try {
      for (const account of manifest.accounts) {
        await this.client.createAccount({
          id: account.tigerbeetle_id,
          ledger: account.ledger,
          code: account.purpose,
          name: account.sovr_id,
          currency: account.currency,
          historical_code: account.historical_code ?? '',
        });
        accountsCreated.push(account.tigerbeetle_id);
      }

      const genesisTransfer = manifest.genesis_transfer;
      await this.client.createTransfer({
        id: Number(genesisTransfer.id.split('-').pop() ?? '1'),
        debit_account_id: genesisTransfer.debit_account_id,
        credit_account_id: genesisTransfer.credit_account_id,
        amount: BigInt(genesisTransfer.amount),
        code: genesisTransfer.code,
        timeout: genesisTransfer.timeout,
      });
      transfersCreated.push(Number(genesisTransfer.id.split('-').pop() ?? '1'));

      const readBackAccounts = await this.client.readAccounts();
      const readBackTransfers = await this.client.readTransfers();

      const expectedAccountIds = new Set(manifest.accounts.map((a: any) => a.tigerbeetle_id));
      const actualAccountIds = new Set(readBackAccounts.map((a: any) => a.id));

      const readBackVerified = expectedAccountIds.size === actualAccountIds.size && [...expectedAccountIds].every(id => actualAccountIds.has(id));

      const deterministicHash = this.computeGenesisHash(manifest, accountsCreated, transfersCreated);

      const result: GenesisWriteResult = {
        success: readBackVerified,
        accounts_created: accountsCreated.length,
        transfers_created: transfersCreated.length,
        read_back_verified: readBackVerified,
        deterministic_hash: deterministicHash,
      };

      this.persistResult(result);

      return result;
    } catch (error: any) {
      const result: GenesisWriteResult = {
        success: false,
        accounts_created: accountsCreated.length,
        transfers_created: transfersCreated.length,
        read_back_verified: false,
        deterministic_hash: '',
        error: error.message,
      };
      this.persistResult(result);
      return result;
    }
  }

  private computeGenesisHash(manifest: any, accountsCreated: number[], transfersCreated: number[]): string {
    const crypto = require('crypto');
    const data = JSON.stringify({
      manifest: manifest.genesis_transfer,
      accounts: accountsCreated.sort(),
      transfers: transfersCreated.sort(),
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private persistResult(result: GenesisWriteResult): void {
    mkdirSync(dirname(this.outputPath), { recursive: true });
    writeFileSync(this.outputPath, JSON.stringify(result, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n');
  }
}
