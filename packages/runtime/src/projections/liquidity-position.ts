import type { Projection } from '../server/projectionEngine.js';
import type { EventEnvelope } from '../server/eventStore.js';

export function createLiquidityPosition(): Projection {
  const state = new Map<string, any>();
  const GLOBAL = 'global';
  return {
    name: 'liquidity_position',
    description: 'Current liquidity state and warnings',
    sourceEvents: [
      'treasury.liquidity.check',
      'treasury.liquidity.allocate',
      'treasury.liquidity.warning',
      'treasury.transfer.settled',
      'treasury.transfer.failed',
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
          total_liquidity: '0',
          available_liquidity: '0',
          reserved_liquidity: '0',
          pending_inflows: '0',
          pending_outflows: '0',
          by_currency: {} as Record<string, number>,
          coverage_ratio: '1.00',
          warnings_active: 0,
        });
      }
      const entry = state.get(GLOBAL)!;
      const amount = Number(event.payload?.amount || event.payload?.settlement_amount || 0);
      const currency = event.payload?.currency || 'USD';
      switch (event.event_name) {
        case 'treasury.liquidity.check':
          entry.total_liquidity = String(Number(entry.total_liquidity) + amount);
          entry.available_liquidity = entry.total_liquidity;
          break;
        case 'treasury.liquidity.allocate':
          entry.reserved_liquidity = String(Number(entry.reserved_liquidity) + amount);
          entry.available_liquidity = String(Math.max(0, Number(entry.available_liquidity) - amount));
          break;
        case 'treasury.liquidity.warning':
          entry.warnings_active += 1;
          entry.available_liquidity = event.payload?.current_available ?? entry.available_liquidity;
          break;
        case 'treasury.transfer.settled':
          entry.reserved_liquidity = String(Math.max(0, Number(entry.reserved_liquidity) - amount));
          entry.available_liquidity = String(Math.max(0, Number(entry.available_liquidity) - amount));
          entry.total_liquidity = String(Number(entry.total_liquidity) - amount);
          break;
        case 'treasury.transfer.failed':
          entry.reserved_liquidity = String(Math.max(0, Number(entry.reserved_liquidity) - amount));
          entry.available_liquidity = String(Number(entry.available_liquidity) + amount);
          break;
        case 'treasury.settlement.confirmed':
          entry.pending_inflows = String(Number(entry.pending_inflows) + amount);
          break;
      }
      entry.by_currency[currency] = (entry.by_currency[currency] || 0) + amount;
    },
  };
}
