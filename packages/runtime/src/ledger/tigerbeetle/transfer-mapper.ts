import crypto from 'node:crypto';
import type { SOVRTransferMapping, SOVRAccountMapping } from './types.js';

export interface TransferMapperInput {
  eventName: string;
  eventId: string;
  payload: Record<string, unknown>;
  accountMapper: {
    resolveTigerBeetleId(sovrId: string): number;
  };
}

export class TransferMapper {
  private counter = 0;

  map(input: TransferMapperInput): SOVRTransferMapping | null {
    if (!this.isLedgerEvent(input.eventName) && !this.isTreasurySettlementEvent(input.eventName)) {
      return null;
    }

    const debitSOVRId = this.extractDebitAccount(input.payload);
    const creditSOVRId = this.extractCreditAccount(input.payload);
    const amount = this.extractAmount(input.payload);

    if (!debitSOVRId || !creditSOVRId || amount === null) {
      return null;
    }

    const debitId = input.accountMapper.resolveTigerBeetleId(debitSOVRId);
    const creditId = input.accountMapper.resolveTigerBeetleId(creditSOVRId);
    const deterministicHash = this.computeDeterministicHash(input.eventId, debitSOVRId, creditSOVRId, amount);
    const tigerBeetleId = this.computeDeterministicTransferId(deterministicHash);

    return {
      sovr_event_id: input.eventId,
      tigerbeetle_id: tigerBeetleId,
      debit_sovr_id: debitSOVRId,
      credit_sovr_id: creditSOVRId,
      amount,
      currency: 'USD',
      deterministic_hash: deterministicHash,
    };
  }

  private isLedgerEvent(eventName: string): boolean {
    return eventName === 'ledger.entry.posted';
  }

  private isTreasurySettlementEvent(eventName: string): boolean {
    return eventName === 'treasury.transfer.settled' || eventName === 'treasury.transfer.reserved' || eventName === 'treasury.settlement.confirmed';
  }

  private extractDebitAccount(payload: Record<string, unknown>): string | null {
    if (Array.isArray(payload.postings)) {
      const debit = (payload.postings as any[]).find((p: any) => p.direction === 'DEBIT' || p.direction === 'debit');
      if (debit?.account_id || debit?.accountId) {
        return String(debit.account_id ?? debit.accountId);
      }
    }
    if (payload.debit_account_id || payload.debitAccountId) {
      return String(payload.debit_account_id ?? payload.debitAccountId);
    }
    return null;
  }

  private extractCreditAccount(payload: Record<string, unknown>): string | null {
    if (Array.isArray(payload.postings)) {
      const credit = (payload.postings as any[]).find((p: any) => p.direction === 'CREDIT' || p.direction === 'credit');
      if (credit?.account_id || credit?.accountId) {
        return String(credit.account_id ?? credit.accountId);
      }
    }
    if (payload.credit_account_id || payload.creditAccountId) {
      return String(payload.credit_account_id ?? payload.creditAccountId);
    }
    return null;
  }

  private extractAmount(payload: Record<string, unknown>): bigint | null {
    const raw = payload.amount ?? payload.transfer_amount ?? payload.settlement_amount;
    if (raw === undefined || raw === null) return null;
    const numeric = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isNaN(numeric)) return null;
    return BigInt(Math.trunc(numeric));
  }

  private computeDeterministicHash(eventId: string, debit: string, credit: string, amount: bigint): string {
    const data = `${eventId}:${debit}:${credit}:${amount.toString()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private computeDeterministicTransferId(hash: string): number {
    const numeric = parseInt(hash.slice(0, 8), 16);
    return (numeric % 1000000) + 1;
  }
}
