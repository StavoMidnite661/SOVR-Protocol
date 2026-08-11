import type { Projection } from '../server/projectionEngine.js';
import type { EventEnvelope } from '../server/eventStore.js';

export function createTreasuryDashboard(): Projection {
  const state = new Map<string, any>();
  const GLOBAL = 'global';
  return {
    name: 'treasury_dashboard',
    description: 'System-wide treasury state and liquidity metrics',
    sourceEvents: [
      'treasury.transfer.requested',
      'treasury.transfer.authorized',
      'treasury.transfer.rejected',
      'treasury.transfer.settled',
      'treasury.transfer.failed',
      'treasury.transfer.expired',
      'treasury.transfer.compensation_required',
      'treasury.liquidity.warning',
      'treasury.liquidity.allocated',
      'treasury.settlement.confirmed',
    ],
    state,
    buildFromGenesis(events) {
      state.clear();
      for (const e of events) this.handleEvent(e);
    },
    handleEvent(event: EventEnvelope) {
      if (!state.has(GLOBAL)) {
        state.set(GLOBAL, {
          active_settlements: 0,
          failed_transfers_today: 0,
          liquidity_position: {} as Record<string, number>,
          pending_compensations: 0,
          pending_transfers: 0,
          total_transfers_today: 0,
          total_volume_today: '0',
        });
      }
      const entry = state.get(GLOBAL)!;
      const today = event.timestamp.split('T')[0];
      const amount = Number(event.payload?.amount || event.payload?.settlement_amount || 0);
      switch (event.event_name) {
        case 'treasury.transfer.requested':
          entry.pending_transfers += 1;
          entry.total_transfers_today += 1;
          entry.total_volume_today = String(Number(entry.total_volume_today) + amount);
          break;
        case 'treasury.transfer.authorized':
          entry.pending_transfers = Math.max(0, entry.pending_transfers - 1);
          break;
        case 'treasury.transfer.rejected':
          entry.pending_transfers = Math.max(0, entry.pending_transfers - 1);
          break;
        case 'treasury.transfer.settled':
          entry.active_settlements += 1;
          entry.total_volume_today = String(Number(entry.total_volume_today) + amount);
          break;
        case 'treasury.transfer.failed':
          entry.failed_transfers_today += 1;
          entry.pending_transfers = Math.max(0, entry.pending_transfers - 1);
          break;
        case 'treasury.transfer.expired':
          entry.pending_transfers = Math.max(0, entry.pending_transfers - 1);
          break;
        case 'treasury.transfer.compensation_required':
          entry.pending_compensations += 1;
          break;
        case 'treasury.liquidity.warning':
          entry.liquidity_position.warning_active = true;
          entry.liquidity_position.warning_level = event.payload?.level;
          break;
        case 'treasury.liquidity.allocated':
          entry.liquidity_position.allocated = true;
          break;
        case 'treasury.settlement.confirmed':
          entry.active_settlements = Math.max(0, entry.active_settlements - 1);
          break;
      }
    },
  };
}
