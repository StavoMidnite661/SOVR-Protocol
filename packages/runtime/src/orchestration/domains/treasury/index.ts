export interface TreasuryState {
  pool_id: string;
  pool_type: 'RESERVE' | 'OPERATING' | 'SETTLEMENT' | 'OBLIGATION' | 'EXPENSE' | 'ASSET' | 'LIABILITY' | 'PAYMENT_RAIL';
  balance: string;
  currency: string;
  state: 'ACTIVE' | 'LOCKED' | 'FROZEN';
  created_at: string;
  updated_at: string;
}

export interface AllocationRequest {
  request_id: string;
  from_pool: string;
  to_pool: string;
  amount: string;
  currency: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'EXECUTED' | 'REJECTED';
  requested_by: string;
  approved_by?: string;
  executed_at?: string;
}

export interface TreasuryCommandPayload {
  pool_id?: string;
  from_pool?: string;
  to_pool?: string;
  amount?: string;
  currency?: string;
  reason?: string;
  actor?: string;
}

export const TREASURY_COMMANDS = {
  CREATE_ALLOCATION_REQUEST: 'CREATE_ALLOCATION_REQUEST',
  APPROVE_ALLOCATION: 'APPROVE_ALLOCATION',
  EXECUTE_ALLOCATION: 'EXECUTE_ALLOCATION',
  VERIFY_BALANCE: 'VERIFY_BALANCE',
} as const;

export const TREASURY_EVENTS = {
  INTENT_CREATED: 'TreasuryIntentCreated',
  APPROVED: 'TreasuryApproved',
  ALLOCATION_EXECUTED: 'TreasuryAllocationExecuted',
  BALANCE_VERIFIED: 'TreasuryBalanceVerified',
} as const;

export class TreasuryDomain {
  private readonly pools: Map<string, TreasuryState> = new Map();
  private readonly allocations: Map<string, AllocationRequest> = new Map();
  private readonly eventLog: Array<{ event: string; pool_id?: string; request_id?: string; timestamp: string }> = [];

  constructor() {
    this.pools.set('SYSTEM_RESERVE_POOL', {
      pool_id: 'SYSTEM_RESERVE_POOL',
      pool_type: 'RESERVE',
      balance: '1000000',
      currency: 'USD',
      state: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    this.pools.set('TREASURY_OPERATING', {
      pool_id: 'TREASURY_OPERATING',
      pool_type: 'OPERATING',
      balance: '0',
      currency: 'USD',
      state: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  createAllocationRequest(payload: TreasuryCommandPayload): AllocationRequest {
    const request: AllocationRequest = {
      request_id: `alloc_req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      from_pool: payload.from_pool || 'SYSTEM_RESERVE_POOL',
      to_pool: payload.to_pool || 'TREASURY_OPERATING',
      amount: String(payload.amount || '0'),
      currency: String(payload.currency || 'USD'),
      reason: String(payload.reason || ''),
      status: 'PENDING',
      requested_by: String(payload.actor || 'system'),
    };

    this.allocations.set(request.request_id, request);
    this.eventLog.push({ event: TREASURY_EVENTS.INTENT_CREATED, pool_id: request.from_pool, request_id: request.request_id, timestamp: new Date().toISOString() });
    return request;
  }

  approveAllocation(requestId: string, actor: string): AllocationRequest | null {
    const request = this.allocations.get(requestId);
    if (!request || request.status !== 'PENDING') return null;

    request.status = 'APPROVED';
    request.approved_by = actor;
    this.allocations.set(requestId, request);
    this.eventLog.push({ event: TREASURY_EVENTS.APPROVED, request_id: requestId, timestamp: new Date().toISOString() });
    return request;
  }

  executeAllocation(requestId: string): AllocationRequest | null {
    const request = this.allocations.get(requestId);
    if (!request || request.status !== 'APPROVED') return null;

    const fromPool = this.pools.get(request.from_pool);
    const toPool = this.pools.get(request.to_pool);

    if (!fromPool || !toPool) return null;

    const amount = Number(request.amount);
    const fromBalance = Number(fromPool.balance);

    if (fromBalance < amount) {
      request.status = 'REJECTED';
      this.allocations.set(requestId, request);
      return null;
    }

    fromPool.balance = String(fromBalance - amount);
    fromPool.updated_at = new Date().toISOString();
    this.pools.set(request.from_pool, fromPool);

    toPool.balance = String(Number(toPool.balance) + amount);
    toPool.updated_at = new Date().toISOString();
    this.pools.set(request.to_pool, toPool);

    request.status = 'EXECUTED';
    request.executed_at = new Date().toISOString();
    this.allocations.set(requestId, request);

    this.eventLog.push({ event: TREASURY_EVENTS.ALLOCATION_EXECUTED, pool_id: request.to_pool, request_id: requestId, timestamp: new Date().toISOString() });
    return request;
  }

  verifyBalance(poolId: string): { valid: boolean; balance: string; pool: TreasuryState | null } {
    const pool = this.pools.get(poolId);
    this.eventLog.push({ event: TREASURY_EVENTS.BALANCE_VERIFIED, pool_id: poolId, timestamp: new Date().toISOString() });
    return { valid: pool !== undefined, balance: pool?.balance || '0', pool: pool || null };
  }

  getPool(poolId: string): TreasuryState | undefined {
    return this.pools.get(poolId);
  }

  getAllPools(): TreasuryState[] {
    return Array.from(this.pools.values());
  }

  getAllocation(requestId: string): AllocationRequest | undefined {
    return this.allocations.get(requestId);
  }

  getEventLog() {
    return [...this.eventLog];
  }
}
