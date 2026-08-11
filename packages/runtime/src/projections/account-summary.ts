import type { Projection } from '../server/projectionEngine.js';
import type { EventEnvelope } from '../server/eventStore.js';

export function createAccountSummary(): Projection {
  const state = new Map<string, any>();
  const GLOBAL = 'global';
  return {
    name: 'account_summary',
    description: 'Treasury balances and activity per identity',
    sourceEvents: [
      'treasury.transfer.requested',
      'treasury.transfer.authorized',
      'treasury.transfer.settled',
      'treasury.transfer.failed',
      'treasury.transfer.expired',
      'treasury.liquidity.warning',
    ],
    state,
    buildFromGenesis(events) {
      state.clear();
      for (const e of events) this.handleEvent(e);
    },
    handleEvent(event: EventEnvelope) {
      const identityId = event.identity_context?.identity_id || event.actor_id || GLOBAL;
      const key = `identity:${identityId}`;
      if (!state.has(key)) {
        state.set(key, {
          account_id: key,
          identity_id: identityId,
          available_balance: '0',
          reserved_balance: '0',
          total_balance: '0',
          pending_transfers_count: 0,
          last_activity_at: event.timestamp,
          currency_breakdown: [] as any[],
        });
      }
      const entry = state.get(key)!;
      const amount = Number(event.payload?.amount || event.payload?.settlement_amount || 0);
      const currency = event.payload?.currency || 'USD';
      entry.last_activity_at = event.timestamp;
      switch (event.event_name) {
        case 'treasury.transfer.requested':
          entry.pending_transfers_count += 1;
          entry.total_balance = String(Number(entry.total_balance) + amount);
          break;
        case 'treasury.transfer.authorized':
          entry.reserved_balance = String(Number(entry.reserved_balance) + amount);
          entry.available_balance = String(Math.max(0, Number(entry.total_balance) - Number(entry.reserved_balance)));
          break;
        case 'treasury.transfer.settled':
          entry.pending_transfers_count = Math.max(0, entry.pending_transfers_count - 1);
          entry.reserved_balance = String(Math.max(0, Number(entry.reserved_balance) - amount));
          entry.available_balance = String(Math.max(0, Number(entry.available_balance) - amount));
          break;
        case 'treasury.transfer.failed':
          entry.pending_transfers_count = Math.max(0, entry.pending_transfers_count - 1);
          entry.reserved_balance = String(Math.max(0, Number(entry.reserved_balance) - amount));
          entry.available_balance = String(Number(entry.available_balance) + amount);
          break;
        case 'treasury.transfer.expired':
          entry.pending_transfers_count = Math.max(0, entry.pending_transfers_count - 1);
          entry.reserved_balance = String(Math.max(0, Number(entry.reserved_balance) - amount));
          entry.available_balance = String(Number(entry.available_balance) + amount);
          break;
        case 'treasury.liquidity.warning':
          entry.available_balance = event.payload?.current_available ?? entry.available_balance;
          break;
      }
      const existingCcy = entry.currency_breakdown.find((c: any) => c.currency === currency);
      if (existingCcy) {
        existingCcy.balance = String(Number(existingCcy.balance || 0) + amount);
      } else if (amount) {
        entry.currency_breakdown.push({ currency, balance: String(amount) });
      }
    },
  };
}
