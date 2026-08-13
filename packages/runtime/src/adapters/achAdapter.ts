// ============================================================
// Mock ACH Bank Adapter — rail I/O only.
// Adapters must not append protocol events. KernelExecutor is
// the only event-append authority.
// ============================================================

import { randomUUID } from 'node:crypto';
import type { PaymentRailAdapter, RailType } from './boundary.js';
import type { EventStore } from '../server/eventStore.js';
import { CircuitBreaker, CircuitStatus } from './circuit-breaker.js';

export interface AchAdapterOpts {
  routingNumber: string;
  bankName: string;
  latencyMs?: number;
}

export class AchAdapter implements PaymentRailAdapter {
  readonly railType: RailType = 'ACH';
  private readonly opts: Required<AchAdapterOpts>;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(_store: EventStore, opts: AchAdapterOpts) {
    this.opts = { latencyMs: 50, ...opts };
    this.circuitBreaker = new CircuitBreaker({
      name: 'ach-rail',
      failureThreshold: 5,
      successThreshold: 2,
      timeoutMs: 60_000,
    });
  }

  private async delay() {
    if (this.opts.latencyMs > 0) await new Promise(r => setTimeout(r, this.opts.latencyMs));
  }

  async prepare(paymentRequestId: string, amount: any) {
    return this.circuitBreaker.execute(async () => {
      await this.delay();
      const railPreparationId = `ach-prep-${randomUUID()}`;
      const amountStr = String(amount);
      const feeNum = Math.min(5, Number(amountStr) * 0.001);
      const fees = feeNum.toFixed(2);
      return { railPreparationId, fees, paymentRequestId };
    });
  }

  async execute(railPreparationId: string) {
    return this.circuitBreaker.execute(async () => {
      await this.delay();
      const railExecutionId = `ach-exec-${randomUUID()}`;
      const railReferenceId = `ACH-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      return { railExecutionId, railReferenceId, railPreparationId };
    });
  }

  async confirm(railExecutionId: string) {
    return this.circuitBreaker.execute(async () => {
      await this.delay();
      return { confirmed: true, confirmedAmount: '0', fees: '0', railExecutionId };
    });
  }

  async compensate(railExecutionId: string, reason: string) {
    return this.circuitBreaker.execute(async () => {
      await this.delay();
      const reversalRailReferenceId = `ACH-REVERSAL-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      return { reversalRailReferenceId, reason, railExecutionId };
    });
  }

  getCircuitStatus(): CircuitStatus {
    return this.circuitBreaker.getStatus();
  }
}
