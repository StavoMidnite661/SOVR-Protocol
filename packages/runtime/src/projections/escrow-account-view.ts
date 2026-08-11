import type { Projection } from '../server/projectionEngine.js';
import type { EventEnvelope } from '../server/eventStore.js';

export function createEscrowAccountView(): Projection {
  const state = new Map<string, any>();
  return {
    name: 'escrow_account_view',
    description: 'Current state of all escrow accounts',
    sourceEvents: [
      'escrow.account.created',
      'escrow.account.funded',
      'escrow.account.released',
      'escrow.account.cancelled',
    ],
    state,
    buildFromGenesis(events) {
      state.clear();
      for (const e of events) this.handleEvent(e);
    },
    handleEvent(event: EventEnvelope) {
      const escrowId = event.payload?.escrow_id || event.aggregate_id;
      switch (event.event_name) {
        case 'escrow.account.created': {
          state.set(escrowId, {
            escrow_id: escrowId,
            state: 'ACTIVE',
            amount: event.payload?.amount || '0',
            asset_type: event.payload?.asset_type || 'unknown',
            parties: event.payload?.parties || [],
          });
          break;
        }
        case 'escrow.account.funded': {
          const existing = state.get(escrowId);
          if (existing) {
            existing.amount = String(Number(existing.amount || 0) + Number(event.payload?.amount || 0));
          } else {
            state.set(escrowId, {
              escrow_id: escrowId,
              state: 'FUNDED',
              amount: event.payload?.amount || '0',
              asset_type: 'unknown',
              parties: [],
            });
          }
          break;
        }
        case 'escrow.account.released': {
          const existing = state.get(escrowId);
          if (existing) {
            existing.state = 'RELEASED';
            existing.amount = '0';
          }
          break;
        }
        case 'escrow.account.cancelled': {
          const existing = state.get(escrowId);
          if (existing) {
            existing.state = 'CANCELLED';
          }
          break;
        }
      }
    },
  };
}
