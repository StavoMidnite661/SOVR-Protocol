import {
  createClient,
  type Client,
  AccountFlags,
} from 'tigerbeetle-node';
import type {
  TigerBeetleAccount,
  TigerBeetleTransfer,
  LedgerAdapterConfig,
} from './types.js';

export interface TigerBeetleTransport {
  connect(): Promise<void>;
  ping(): Promise<boolean>;
  createAccounts(accounts: TigerBeetleAccount[]): Promise<void>;
  createTransfers(transfers: TigerBeetleTransfer[]): Promise<void>;
  lookupAccounts(ids: number[]): Promise<TigerBeetleAccount[]>;
  lookupTransfers(ids: number[]): Promise<TigerBeetleTransfer[]>;
  readAccounts(): Promise<TigerBeetleAccount[]>;
  readTransfers(): Promise<TigerBeetleTransfer[]>;
  isWriteEnabled(): boolean;
  setWriteEnabled(enabled: boolean): void;
}

export class TigerBeetleTransportClient implements TigerBeetleTransport {
  private client: Client | null = null;
  private readonly config: LedgerAdapterConfig;
  private writeEnabled: boolean;

  constructor(config: LedgerAdapterConfig) {
    this.config = config;
    this.writeEnabled = config.writeEnabled;
  }

  async connect(): Promise<void> {
    if (this.client) return;
    const timeoutMs = 5000;
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        try {
          this.client = createClient({
            cluster_id: BigInt(0),
            replica_addresses: this.config.addresses?.length
              ? this.config.addresses
              : [`127.0.0.1:${this.config.port}`],
          });
          resolve();
        } catch (err) {
          reject(err);
        }
      }),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('TigerBeetle connection timeout')), timeoutMs)
      ),
    ]);
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;
    this.client.destroy();
    this.client = null;
  }

  async ping(): Promise<boolean> {
    try {
      await this.connect();
      return true;
    } catch {
      return false;
    }
  }

  async createAccounts(accounts: TigerBeetleAccount[]): Promise<void> {
    if (!this.writeEnabled) {
      throw new Error('WRITE_DISABLED: TigerBeetle account creation is disabled until REAL_WRITE_AUTHORIZATION is enabled');
    }
    if (this.config.readOnly) {
      throw new Error('READ_ONLY_MODE: account creation is forbidden in read-only mode');
    }
    await this.connect();
    if (!this.client) throw new Error('TigerBeetle client not connected');

    const accountsToCreate = accounts.map((account) => {
      const code = account.code ?? '';
      const codeNum = code.length > 0 ? this.stringToCode(code) : 0;
      let flags = 0;
      if (account.is_default) flags |= AccountFlags.debits_must_not_exceed_credits;

      return {
        id: BigInt(account.id),
        ledger: account.ledger ?? 0,
        code: codeNum,
        flags,
        user_data_128: BigInt(0),
        user_data_64: BigInt(0),
        user_data_32: 0,
        debits_pending: BigInt(0),
        debits_posted: BigInt(0),
        credits_pending: BigInt(0),
        credits_posted: BigInt(0),
        reserved: 0,
        timestamp: BigInt(0),
      };
    });

    const results = await this.client.createAccounts(accountsToCreate);
    for (let i = 0; i < results.length; i++) {
      const status = (results[i] as any)?.status;
      if (status && status !== 4294967295 && status !== 21) {
        throw new Error(`TigerBeetle account creation failed: ${String(status)}`);
      }
    }
  }

  async createTransfers(transfers: TigerBeetleTransfer[]): Promise<void> {
    if (!this.writeEnabled) {
      throw new Error('WRITE_DISABLED: TigerBeetle transfer creation is disabled until REAL_WRITE_AUTHORIZATION is enabled');
    }
    if (this.config.readOnly) {
      throw new Error('READ_ONLY_MODE: transfer creation is forbidden in read-only mode');
    }
    await this.connect();
    if (!this.client) throw new Error('TigerBeetle client not connected');

    const transfersToCreate = transfers.map((transfer) => {
      const code = transfer.code ?? '';
      const codeNum = code.length > 0 ? this.stringToCode(code) : 0;

      return {
        id: BigInt(transfer.id),
        debit_account_id: BigInt(transfer.debit_account_id ?? 0),
        credit_account_id: BigInt(transfer.credit_account_id ?? 0),
        amount: transfer.amount ?? BigInt(0),
        pending_id: BigInt(0),
        user_data_128: BigInt(0),
        user_data_64: BigInt(0),
        user_data_32: 0,
        timeout: transfer.timeout ?? 0,
        ledger: transfer.ledger ?? 0,
        code: codeNum,
        flags: 0,
        timestamp: BigInt(0),
      };
    });

    const results = await this.client.createTransfers(transfersToCreate);
    for (let i = 0; i < results.length; i++) {
      const status = (results[i] as any)?.status;
      if (status && status !== 4294967295 && status !== 46) {
        throw new Error(`TigerBeetle transfer creation failed: ${String(status)}`);
      }
    }
  }

  async lookupAccounts(ids: number[]): Promise<TigerBeetleAccount[]> {
    await this.connect();
    if (!this.client) throw new Error('TigerBeetle client not connected');
    const results = await this.client.lookupAccounts(ids.map(id => BigInt(id)));
    return results.map(this.mapAccount);
  }

  async lookupTransfers(ids: number[]): Promise<TigerBeetleTransfer[]> {
    await this.connect();
    if (!this.client) throw new Error('TigerBeetle client not connected');
    const results = await this.client.lookupTransfers(ids.map(id => BigInt(id)));
    return results.map(this.mapTransfer);
  }

  async readAccounts(): Promise<TigerBeetleAccount[]> {
    if (this.config.readOnly && !this.writeEnabled) {
      throw new Error('READ_ONLY_MODE: account reads require explicit authorization');
    }
    await this.connect();
    if (!this.client) throw new Error('TigerBeetle client not connected');

    const results = await this.client.queryAccounts({
      user_data_128: BigInt(0),
      user_data_64: BigInt(0),
      user_data_32: 0,
      ledger: 0,
      code: 0,
      timestamp_min: BigInt(0),
      timestamp_max: BigInt(0),
      limit: 1000,
      flags: 0,
    });
    return results.map(this.mapAccount);
  }

  async readTransfers(): Promise<TigerBeetleTransfer[]> {
    if (this.config.readOnly && !this.writeEnabled) {
      throw new Error('READ_ONLY_MODE: transfer reads require explicit authorization');
    }
    await this.connect();
    if (!this.client) throw new Error('TigerBeetle client not connected');

    const results = await this.client.queryTransfers({
      user_data_128: BigInt(0),
      user_data_64: BigInt(0),
      user_data_32: 0,
      ledger: 0,
      code: 0,
      timestamp_min: BigInt(0),
      timestamp_max: BigInt(0),
      limit: 1000,
      flags: 0,
    });
    return results.map(this.mapTransfer);
  }

  isWriteEnabled(): boolean {
    return this.writeEnabled;
  }

  setWriteEnabled(enabled: boolean): void {
    this.writeEnabled = enabled;
  }

  private mapAccount(account: { id: bigint; debits_pending: bigint; debits_posted: bigint; credits_pending: bigint; credits_posted: bigint; user_data_128: bigint; user_data_64: bigint; user_data_32: number; reserved: number; ledger: number; code: number; flags: number; timestamp: bigint }): TigerBeetleAccount {
    return {
      id: Number(account.id),
      ledger: account.ledger,
      code: String(account.code),
      name: '',
      currency: 'USD',
      historical_code: '',
      is_default: (account.flags & AccountFlags.debits_must_not_exceed_credits) !== 0,
      is_system: false,
      timestamp: BigInt(account.timestamp),
      user_data: { lo: Number(account.user_data_128 & 0xFFFFFFFFn), hi: Number(account.user_data_128 >> 64n) },
    };
  }

  private mapTransfer(transfer: { id: bigint; debit_account_id: bigint; credit_account_id: bigint; amount: bigint; pending_id: bigint; user_data_128: bigint; user_data_64: bigint; user_data_32: number; timeout: number; ledger: number; code: number; flags: number; timestamp: bigint }): TigerBeetleTransfer {
    return {
      id: Number(transfer.id),
      debit_account_id: Number(transfer.debit_account_id),
      credit_account_id: Number(transfer.credit_account_id),
      amount: BigInt(transfer.amount),
      pending_id: Number(transfer.pending_id),
      user_data: { lo: Number(transfer.user_data_128 & 0xFFFFFFFFn), hi: Number(transfer.user_data_128 >> 64n) },
      timeout: transfer.timeout,
      ledger: transfer.ledger,
      code: String(transfer.code),
      timestamp: BigInt(transfer.timestamp),
    };
  }

  private stringToCode(code: string): number {
    const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normalized.length === 0) return 0;
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 65536;
  }
}
