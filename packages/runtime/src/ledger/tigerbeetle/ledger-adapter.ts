import type { TigerBeetleNativeClient } from './tigerbeetle-native-client.js';
import type { AccountMapper, AccountMapperConfig } from './account-mapper.js';
import type { TransferMapper } from './transfer-mapper.js';
import type {
  TigerBeetleAccount,
  TigerBeetleTransfer,
  SOVRAccountMapping,
  SOVRTransferMapping,
  LedgerAdapterConfig,
  ShadowExecutionResult,
} from './types.js';

export interface LedgerAdapterBoundary {
  ping(): Promise<boolean>;
  readAccounts(): Promise<TigerBeetleAccount[]>;
  readTransfers(): Promise<TigerBeetleTransfer[]>;
  validateAccountMapping(): Promise<boolean>;
  shadowExecute(scenarioId: string, events: any[], commands: any[]): Promise<ShadowExecutionResult>;
  mapEventToTransfer(event: any): SOVRTransferMapping | null;
}

export class LedgerAdapter implements LedgerAdapterBoundary {
  private readonly client: TigerBeetleNativeClient;
  private readonly accountMapper: AccountMapper;
  private readonly transferMapper: TransferMapper;
  private readonly config: LedgerAdapterConfig;

  constructor(client: TigerBeetleNativeClient, accountMapper: AccountMapper, transferMapper: TransferMapper, config: LedgerAdapterConfig) {
    this.client = client;
    this.accountMapper = accountMapper;
    this.transferMapper = transferMapper;
    this.config = config;
  }

  async ping(): Promise<boolean> {
    return this.client.ping();
  }

  async readAccounts(): Promise<TigerBeetleAccount[]> {
    this.assertReadAuthorized();
    return this.client.readAccounts();
  }

  async readTransfers(): Promise<TigerBeetleTransfer[]> {
    this.assertReadAuthorized();
    return this.client.readTransfers();
  }

  async validateAccountMapping(): Promise<boolean> {
    this.assertReadAuthorized();
    const accounts = await this.client.readAccounts();
    const mappedIds = new Set(this.accountMapper.listMappings().map(m => m.tigerbeetle_id));
    for (const account of accounts) {
      if (!mappedIds.has(account.id)) {
        throw new Error(`UNMAPPED_TIGERBEETLE_ACCOUNT: TigerBeetle account ${account.id} has no SOVR mapping`);
      }
    }
    return this.accountMapper.validateDeterministicMapping();
  }

  async shadowExecute(scenarioId: string, events: any[], commands: any[]): Promise<ShadowExecutionResult> {
    const expectedOperations: ShadowExecutionResult['expected_tigerbeetle_operations'] = [];

    for (const event of events) {
      const mapping = this.transferMapper.map({
        eventName: event.event_name,
        eventId: event.event_id,
        payload: event.payload ?? {},
        accountMapper: {
          resolveTigerBeetleId: (sovrId: string) => this.accountMapper.resolveTigerBeetleId(sovrId),
        },
      });

      if (mapping) {
        const operation: ShadowExecutionResult['expected_tigerbeetle_operations'][0] = {
          operation: 'CREATE_TRANSFER',
          target: mapping,
        };
        expectedOperations.push(operation);
      }
    }

    const deterministicHash = this.computeShadowHash(scenarioId, events, commands);

    return {
      scenario_id: scenarioId,
      commands,
      expected_tigerbeetle_operations: expectedOperations,
      deterministic_hash: deterministicHash,
      verified: expectedOperations.length > 0,
    };
  }

  mapEventToTransfer(event: any): SOVRTransferMapping | null {
    return this.transferMapper.map({
      eventName: event.event_name,
      eventId: event.event_id,
      payload: event.payload ?? {},
      accountMapper: {
        resolveTigerBeetleId: (sovrId: string) => this.accountMapper.resolveTigerBeetleId(sovrId),
      },
    });
  }

  isWriteEnabled(): boolean {
    return this.client.isWriteEnabled();
  }

  private assertReadAuthorized(): void {
    if (this.config.readOnly && !this.client.isWriteEnabled()) {
      throw new Error('READ_ONLY_MODE: TigerBeetle reads are disabled until REAL_WRITE_AUTHORIZATION is enabled');
    }
  }

  private computeShadowHash(scenarioId: string, events: any[], commands: any[]): string {
    const crypto = require('crypto');
    const data = `${scenarioId}:${events.map((e) => `${e.event_name}:${e.aggregate_id}:${e.correlation_id}`).join('|')}:${commands.map((c) => c.command_name).join('|')}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
