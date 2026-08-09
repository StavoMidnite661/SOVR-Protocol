import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ShadowExecutionResult } from './types.js';
import type { LedgerAdapterBoundary } from './ledger-adapter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../');

export class ShadowLedgerAdapter implements LedgerAdapterBoundary {
  private readonly delegate: LedgerAdapterBoundary;
  private readonly executed: boolean = false;
  private readonly shadowPath: string;

  constructor(delegate: LedgerAdapterBoundary, outputPath?: string) {
    this.delegate = delegate;
    this.shadowPath = outputPath ?? join(ROOT, 'generated', 'audit', 'tigerbeetle-shadow-execution.json');
  }

  async ping(): Promise<boolean> {
    return this.delegate.ping();
  }

  async readAccounts(): Promise<any[]> {
    return this.delegate.readAccounts();
  }

  async readTransfers(): Promise<any[]> {
    return this.delegate.readTransfers();
  }

  async validateAccountMapping(): Promise<boolean> {
    return this.delegate.validateAccountMapping();
  }

  async shadowExecute(scenarioId: string, events: any[], commands: any[]): Promise<ShadowExecutionResult> {
    const result = await this.delegate.shadowExecute(scenarioId, events, commands);

    const output: ShadowExecutionResult = {
      ...result,
      executed_at: new Date().toISOString(),
      write_enabled: false,
      status: 'SHADOW_ONLY',
    };

    mkdirSync(dirname(this.shadowPath), { recursive: true });
    writeFileSync(this.shadowPath, JSON.stringify(output, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n');

    return output;
  }

  mapEventToTransfer(event: any): any {
    return this.delegate.mapEventToTransfer(event);
  }

  isWriteEnabled(): boolean {
    return false;
  }
}
