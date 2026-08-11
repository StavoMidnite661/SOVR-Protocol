import type { Projection } from '../server/projectionEngine.js';
import type { EventEnvelope } from '../server/eventStore.js';

export function createSettlementSummary(): Projection {
  const state = new Map<string, any>();
  return {
    name: 'settlement_summary',
    description: 'Settlement confirmations and failures across rails',
    sourceEvents: [
      'payment.rail.confirmed',
      'payment.rail.failed',
      'payment.reconciliation.completed',
      'payment.reconciliation.discrepancy',
      'payment.receipt.issued',
      'hybrid.settlement.on_chain.confirmed',
      'hybrid.settlement.on_chain.failed',
    ],
    state,
    buildFromGenesis(events) {
      state.clear();
      for (const e of events) this.handleEvent(e);
    },
    handleEvent(event: EventEnvelope) {
      const railType = event.payload?.rail_type || event.payload?.settlement_rail || 'unknown';
      if (!state.has(railType)) {
        state.set(railType, {
          rail_type: railType,
          total_settled: 0,
          total_failed: 0,
          total_fees: '0',
          total_volume_settled: '0',
          pending_reconciliation: 0,
          active_discrepancies: 0,
          average_settlement_time_ms: 0,
        });
      }
      const entry = state.get(railType)!;
      const amount = Number(event.payload?.amount || event.payload?.settlement_amount || 0);
      switch (event.event_name) {
        case 'payment.rail.confirmed':
        case 'hybrid.settlement.on_chain.confirmed':
          entry.total_settled += 1;
          entry.total_volume_settled = String(Number(entry.total_volume_settled) + amount);
          entry.pending_reconciliation = Math.max(0, entry.pending_reconciliation - 1);
          break;
        case 'payment.rail.failed':
        case 'hybrid.settlement.on_chain.failed':
          entry.total_failed += 1;
          break;
        case 'payment.reconciliation.completed':
          entry.pending_reconciliation = Math.max(0, entry.pending_reconciliation - 1);
          break;
        case 'payment.reconciliation.discrepancy':
          entry.active_discrepancies += 1;
          entry.pending_reconciliation += 1;
          break;
        case 'payment.receipt.issued':
          entry.total_fees = String(Number(entry.total_fees) + Number(event.payload?.fee || 0));
          break;
      }
    },
  };
}
