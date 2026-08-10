export interface PaymentState {
  payment_id: string;
  state: 'INIT' | 'INTENT_CREATED' | 'AUTHORIZED' | 'SETTLED' | 'FAILED' | 'CANCELLED';
  amount: string;
  currency: string;
  from_account: string;
  to_account: string;
  rail_type: string;
  settlement_ref?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentCommandPayload {
  payment_id?: string;
  amount?: string;
  currency?: string;
  from_account?: string;
  to_account?: string;
  rail_type?: string;
  reason?: string;
  actor?: string;
}

export const PAYMENT_COMMANDS = {
  CREATE_PAYMENT_INTENT: 'CREATE_PAYMENT_INTENT',
  AUTHORIZE_PAYMENT: 'AUTHORIZE_PAYMENT',
  EXECUTE_INTERNAL_SETTLEMENT: 'EXECUTE_INTERNAL_SETTLEMENT',
  VERIFY_PAYMENT_STATE: 'VERIFY_PAYMENT_STATE',
} as const;

export const PAYMENT_EVENTS = {
  INTENT_CREATED: 'PaymentIntentCreated',
  AUTHORIZED: 'PaymentAuthorized',
  SETTLED: 'PaymentSettled',
  STATE_VERIFIED: 'PaymentStateVerified',
} as const;

export class PaymentDomain {
  private readonly payments: Map<string, PaymentState> = new Map();
  private readonly eventLog: Array<{ event: string; payment_id?: string; timestamp: string }> = [];

  createIntent(payload: PaymentCommandPayload): PaymentState {
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const state: PaymentState = {
      payment_id: paymentId,
      state: 'INTENT_CREATED',
      amount: String(payload.amount || '0'),
      currency: String(payload.currency || 'USD'),
      from_account: String(payload.from_account || 'SYSTEM_RESERVE_POOL'),
      to_account: String(payload.to_account || 'TREASURY_OPERATING'),
      rail_type: String(payload.rail_type || 'INTERNAL'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.payments.set(paymentId, state);
    this.eventLog.push({ event: PAYMENT_EVENTS.INTENT_CREATED, payment_id: paymentId, timestamp: new Date().toISOString() });
    return state;
  }

  authorizePayment(paymentId: string, actor: string): PaymentState | null {
    const payment = this.payments.get(paymentId);
    if (!payment || payment.state !== 'INTENT_CREATED') return null;

    payment.state = 'AUTHORIZED';
    payment.updated_at = new Date().toISOString();
    this.payments.set(paymentId, payment);
    this.eventLog.push({ event: PAYMENT_EVENTS.AUTHORIZED, payment_id: paymentId, timestamp: new Date().toISOString() });
    return payment;
  }

  executeInternalSettlement(paymentId: string): PaymentState | null {
    const payment = this.payments.get(paymentId);
    if (!payment || payment.state !== 'AUTHORIZED') return null;

    payment.state = 'SETTLED';
    payment.settlement_ref = `settle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    payment.updated_at = new Date().toISOString();
    this.payments.set(paymentId, payment);
    this.eventLog.push({ event: PAYMENT_EVENTS.SETTLED, payment_id: paymentId, timestamp: new Date().toISOString() });
    return payment;
  }

  verifyState(paymentId: string): { valid: boolean; state: PaymentState | null } {
    const payment = this.payments.get(paymentId);
    this.eventLog.push({ event: PAYMENT_EVENTS.STATE_VERIFIED, payment_id: paymentId, timestamp: new Date().toISOString() });
    return { valid: payment !== undefined, state: payment || null };
  }

  getPayment(paymentId: string): PaymentState | undefined {
    return this.payments.get(paymentId);
  }

  getAllPayments(): PaymentState[] {
    return Array.from(this.payments.values());
  }

  getEventLog() {
    return [...this.eventLog];
  }
}
