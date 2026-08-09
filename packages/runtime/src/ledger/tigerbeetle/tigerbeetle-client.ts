import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TigerBeetleAccount, TigerBeetleTransfer, LedgerAdapterConfig } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../');

export class TigerBeetleClient {
  private readonly binaryPath: string;
  private readonly clusterFile: string;
  private readonly dataDirectory: string;
  private readonly port: number;
  private readonly readOnly: boolean;
  private writeEnabled: boolean;

  constructor(config: LedgerAdapterConfig) {
    this.binaryPath = config.tigerbeetleBinaryPath;
    this.clusterFile = config.clusterFile;
    this.dataDirectory = config.dataDirectory;
    this.port = config.port;
    this.readOnly = config.readOnly;
    this.writeEnabled = config.writeEnabled;
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.executeCommand(['accounts', '--cluster', this.clusterFile, '--data-directory', this.dataDirectory]);
      return result.exitCode === 0 || result.stdout.includes('accounts');
    } catch {
      return false;
    }
  }

  async readAccounts(): Promise<TigerBeetleAccount[]> {
    if (this.readOnly === false && !this.writeEnabled) {
      throw new Error('READ_ONLY_MODE: account reads require explicit authorization');
    }
    const result = await this.executeCommand(['accounts', '--cluster', this.clusterFile, '--data-directory', this.dataDirectory, '--all']);
    const lines = result.stdout.split('\n').filter(l => l.trim().length > 0);
    const accounts: TigerBeetleAccount[] = [];
    for (const line of lines) {
      try {
        const parts = line.split(/\s+/);
        accounts.push({
          id: Number(parts[0]),
          ledger: Number(parts[1]),
          code: parts[2] || '',
          name: parts[3] || '',
          currency: parts[4] || '',
          historical_code: parts[5] || '',
          is_default: parts[6] === '1',
          is_system: parts[7] === '1',
          timestamp: BigInt(parts[8] || '0'),
          user_data: { lo: Number(parts[9] || '0'), hi: Number(parts[10] || '0') },
        });
      } catch {
        // skip malformed lines
      }
    }
    return accounts;
  }

  async readTransfers(): Promise<TigerBeetleTransfer[]> {
    if (this.readOnly === false && !this.writeEnabled) {
      throw new Error('READ_ONLY_MODE: transfer reads require explicit authorization');
    }
    const result = await this.executeCommand(['transfers', '--cluster', this.clusterFile, '--data-directory', this.dataDirectory, '--all']);
    const lines = result.stdout.split('\n').filter(l => l.trim().length > 0);
    const transfers: TigerBeetleTransfer[] = [];
    for (const line of lines) {
      try {
        const parts = line.split(/\s+/);
        transfers.push({
          id: Number(parts[0]),
          debit_account_id: Number(parts[1]),
          credit_account_id: Number(parts[2]),
          amount: BigInt(parts[3] || '0'),
          pending_id: Number(parts[4] || '0'),
          user_data: { lo: Number(parts[5] || '0'), hi: Number(parts[6] || '0') },
          timeout: Number(parts[7] || '0'),
          code: parts[8] || '',
          timestamp: BigInt(parts[9] || '0'),
        });
      } catch {
        // skip malformed lines
      }
    }
    return transfers;
  }

  async createAccount(account: Partial<TigerBeetleAccount>): Promise<void> {
    if (!this.writeEnabled) {
      throw new Error('WRITE_DISABLED: TigerBeetle account creation is disabled until REAL_WRITE_AUTHORIZATION is enabled');
    }
    if (this.readOnly) {
      throw new Error('READ_ONLY_MODE: account creation is forbidden in read-only mode');
    }
    const args = [
      'create', 'account',
      '--cluster', this.clusterFile,
      '--data-directory', this.dataDirectory,
      '--id', String(account.id ?? 0),
      '--ledger', String(account.ledger ?? 0),
      '--code', account.code ?? '',
      '--name', account.name ?? '',
      '--currency', account.currency ?? 'USD',
      '--historical-code', account.historical_code ?? '',
    ];
    await this.executeCommand(args);
  }

  async createTransfer(transfer: Partial<TigerBeetleTransfer>): Promise<void> {
    if (!this.writeEnabled) {
      throw new Error('WRITE_DISABLED: TigerBeetle transfer creation is disabled until REAL_WRITE_AUTHORIZATION is enabled');
    }
    if (this.readOnly) {
      throw new Error('READ_ONLY_MODE: transfer creation is forbidden in read-only mode');
    }
    const args = [
      'create', 'transfer',
      '--cluster', this.clusterFile,
      '--data-directory', this.dataDirectory,
      '--id', String(transfer.id ?? 0),
      '--debit', String(transfer.debit_account_id ?? 0),
      '--credit', String(transfer.credit_account_id ?? 0),
      '--amount', String(transfer.amount ?? 0n),
      '--code', transfer.code ?? '',
      '--timeout', String(transfer.timeout ?? 0),
    ];
    await this.executeCommand(args);
  }

  isWriteEnabled(): boolean {
    return this.writeEnabled;
  }

  setWriteEnabled(enabled: boolean): void {
    this.writeEnabled = enabled;
  }

  private async executeCommand(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.binaryPath, args, { cwd: ROOT });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
      child.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code ?? 1 });
      });
      child.on('error', (err) => {
        reject(new Error(`TigerBeetle execution failed: ${err.message}`));
      });
    });
  }
}
