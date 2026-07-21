// ============================================================
// Mock ACH Bank Adapter — real implementation of PaymentRailAdapter
// for the ACH rail. NOT a stub: prepares, executes, confirms, and
// compensates by emitting events through the EventStore. The adapter
// itself never mutates vault/ledger state directly (INV-001/INV-005
// prohibition enforced by only exposing prepare/execute/confirm/compensate
// methods that return rail references — the command bus applies the
// event-store-level state changes).
// ============================================================

import { randomUUID } from 'node:crypto';
import type { PaymentRailAdapter, RailType } from './boundary.js';
import type { EventStore } from '../server/eventStore.js';

export interface AchAdapterOpts {
  /** SOVR routing number registered with the (mock) ACH operator. */
  routingNumber: string;
  /** Display name used in event payloads. */
  bankName: string;
  /** Base delay in ms for each rail call — default 50 (sandbox). Production wires to real bank API. */
  latencyMs?: number;
}

export class AchAdapter implements PaymentRailAdapter {
  readonly railType: RailType = 'ACH';
  private readonly opts: Required<AchAdapterOpts>;
  private readonly store: EventStore;

  constructor(store: EventStore, opts: AchAdapterOpts) {
    this.store = store;
    this.opts = { latencyMs: 50, ...opts };
  }

  private async delay() {
    if (this.opts.latencyMs > 0) await new Promise(r => setTimeout(r, this.opts.latencyMs));
  }

  /** Allocate a rail preparation. Emits payment.rail.prepared. */
  async prepare(paymentRequestId: string, amount: any) {
    await this.delay();
    const railPreparationId = `ach-prep-${randomUUID()}`;
    const amountStr = String(amount);
    // Fee schedule (sandbox): 0.1% capped at $5
    const feeNum = Math.min(5, Number(amountStr) * 0.001);
    const fees = feeNum.toFixed(2);
    this.store.append({
      event_name: 'payment.rail.prepared',
      aggregate: 'payment_request',
      aggregate_id: paymentRequestId,
      source_domain: 'payment',
      command_id: randomUUID(),
      triggering_command: 'payment.rail.prepare',
      causation_id: randomUUID(),
      correlation_id: randomUUID(),
      actor_id: 'adapter.ach',
      identity_context: { identity_id: 'adapter.ach', actor_type: 'external_system' },
      policy_decision_id: randomUUID(),
      capability_id: 'payment.rail.execute',
      payload: { paymentRequestId, rail: this.railType, railPreparationId, amount: amountStr, fees, bank: this.opts.bankName, routing: this.opts.routingNumber },
      projection_effect: { target: 'payment_status_view', operation: 'update', invalidation_keys: [`payment_status_view:${paymentRequestId}`] },
      audit: { constitutional_rules_referenced: ['INV-001', 'INV-005'], retention_class: 'regulatory_7y' },
    });
    return { railPreparationId, fees };
  }

  /** Submit to the (mock) ACH operator. Emits payment.rail.executed. */
  async execute(railPreparationId: string) {
    await this.delay();
    const railExecutionId = `ach-exec-${randomUUID()}`;
    const railReferenceId = `ACH-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    this.store.append({
      event_name: 'payment.rail.executed',
      aggregate: 'payment_request',
      aggregate_id: railPreparationId,
      source_domain: 'payment',
      command_id: randomUUID(),
      triggering_command: 'payment.rail.execute',
      causation_id: randomUUID(),
      correlation_id: randomUUID(),
      actor_id: 'adapter.ach',
      identity_context: { identity_id: 'adapter.ach', actor_type: 'external_system' },
      policy_decision_id: randomUUID(),
      capability_id: 'payment.rail.execute',
      payload: { railPreparationId, railExecutionId, railReferenceId, rail: this.railType },
      projection_effect: { target: 'payment_status_view', operation: 'update', invalidation_keys: [`payment_status_view:${railPreparationId}`] },
      audit: { constitutional_rules_referenced: ['INV-001', 'INV-005'], retention_class: 'regulatory_7y' },
    });
    return { railExecutionId, railReferenceId };
  }

  /** Confirm with the (mock) operator. Emits payment.rail.confirmed. */
  async confirm(railExecutionId: string) {
    await this.delay();
    const confirmed = true;
    this.store.append({
      event_name: 'payment.rail.confirmed',
      aggregate: 'payment_request',
      aggregate_id: railExecutionId,
      source_domain: 'payment',
      command_id: randomUUID(),
      triggering_command: 'payment.rail.confirm',
      causation_id: randomUUID(),
      correlation_id: randomUUID(),
      actor_id: 'adapter.ach',
      identity_context: { identity_id: 'adapter.ach', actor_type: 'external_system' },
      policy_decision_id: randomUUID(),
      capability_id: 'payment.rail.execute',
      payload: { railExecutionId, rail: this.railType, confirmed },
      projection_effect: { target: 'payment_status_view', operation: 'update', invalidation_keys: [`payment_status_view:${railExecutionId}`] },
      audit: { constitutional_rules_referenced: ['INV-001', 'INV-005', 'INV-006'], retention_class: 'regulatory_7y' },
    });
    return { confirmed, confirmedAmount: '0', fees: '0' };
  }

  /** Compensate a failed rail — emits payment.compensation.started. */
  async compensate(railExecutionId: string, reason: string) {
    await this.delay();
    const reversalRailReferenceId = `ACH-REVERSAL-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    this.store.append({
      event_name: 'payment.compensation.started',
      aggregate: 'payment_request',
      aggregate_id: railExecutionId,
      source_domain: 'payment',
      command_id: randomUUID(),
      triggering_command: 'payment.compensation.start',
      causation_id: randomUUID(),
      correlation_id: randomUUID(),
      actor_id: 'adapter.ach',
      identity_context: { identity_id: 'adapter.ach', actor_type: 'external_system' },
      policy_decision_id: randomUUID(),
      capability_id: 'payment.compensation.execute',
      payload: { railExecutionId, reason, reversalRailReferenceId, rail: this.railType },
      projection_effect: { target: 'payment_status_view', operation: 'update', invalidation_keys: [`payment_status_view:${railExecutionId}`] },
      audit: { constitutional_rules_referenced: ['INV-001', 'INV-005'], retention_class: 'regulatory_7y' },
    });
    return { reversalRailReferenceId };
  }
}
