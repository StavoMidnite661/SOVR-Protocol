import type { Projection } from '../server/projectionEngine.js';
import type { EventEnvelope } from '../server/eventStore.js';

export function createPaymentStatus(): Projection {
  const state = new Map<string, any>();
  return {
    name: 'payment_status',
    description: 'Payment execution status across all rails',
    sourceEvents: [
      'payment.request.created',
      'payment.request.cancelled',
      'payment.execution.planned',
      'payment.execution.started',
      'payment.execution.completed',
      'payment.execution.failed',
      'payment.rail.prepared',
      'payment.rail.executed',
      'payment.rail.confirmed',
      'payment.rail.failed',
      'payment.reconciliation.started',
      'payment.reconciliation.completed',
      'payment.reconciliation.discrepancy',
      'payment.receipt.issued',
      'payment.compensation.started',
      'payment.compensation.completed',
    ],
    state,
    buildFromGenesis(events) {
      state.clear();
      for (const e of events) this.handleEvent(e);
    },
    handleEvent(event: EventEnvelope) {
      const paymentRequestId = event.payload?.payment_request_id || event.aggregate_id;
      if (!state.has(paymentRequestId)) {
        state.set(paymentRequestId, {
          payment_request_id: paymentRequestId,
          state: 'UNKNOWN',
          amount: '0',
          created_at: event.timestamp,
          current_phase: undefined as string | undefined,
          rail_reference_id: undefined as string | undefined,
          rail_type: undefined as string | undefined,
        });
      }
      const entry = state.get(paymentRequestId)!;
      entry.created_at = event.timestamp;
      entry.amount = event.payload?.amount || entry.amount;
      entry.rail_type = event.payload?.rail_type || entry.rail_type;
      entry.rail_reference_id = event.payload?.rail_reference_id || entry.rail_reference_id;
      switch (event.event_name) {
        case 'payment.request.created':
          entry.state = 'REQUESTED';
          break;
        case 'payment.request.cancelled':
          entry.state = 'CANCELLED';
          break;
        case 'payment.execution.planned':
          entry.state = 'PLANNED';
          entry.current_phase = 'PLANNING';
          break;
        case 'payment.execution.started':
          entry.state = 'EXECUTING';
          entry.current_phase = 'EXECUTING';
          break;
        case 'payment.execution.completed':
          entry.state = 'COMPLETED';
          entry.current_phase = 'COMPLETED';
          break;
        case 'payment.execution.failed':
          entry.state = 'FAILED';
          entry.current_phase = 'FAILED';
          break;
        case 'payment.rail.prepared':
          entry.state = 'RAIL_PREPARED';
          entry.current_phase = 'PREPARED';
          break;
        case 'payment.rail.executed':
          entry.state = 'RAIL_EXECUTED';
          entry.current_phase = 'EXECUTED';
          break;
        case 'payment.rail.confirmed':
          entry.state = 'CONFIRMED';
          entry.current_phase = 'CONFIRMED';
          break;
        case 'payment.rail.failed':
          entry.state = 'RAIL_FAILED';
          entry.current_phase = 'FAILED';
          break;
        case 'payment.reconciliation.started':
          entry.state = 'RECONCILING';
          entry.current_phase = 'RECONCILING';
          break;
        case 'payment.reconciliation.completed':
          entry.state = 'RECONCILED';
          entry.current_phase = 'RECONCILED';
          break;
        case 'payment.reconciliation.discrepancy':
          entry.state = 'DISCREPANCY';
          entry.current_phase = 'DISCREPANCY';
          break;
        case 'payment.receipt.issued':
          entry.state = 'RECEIPT_ISSUED';
          entry.current_phase = 'RECEIPT';
          break;
        case 'payment.compensation.started':
          entry.state = 'COMPENSATING';
          entry.current_phase = 'COMPENSATING';
          break;
        case 'payment.compensation.completed':
          entry.state = 'COMPENSATED';
          entry.current_phase = 'COMPENSATED';
          break;
      }
    },
  };
}
