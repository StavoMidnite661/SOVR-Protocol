// ExecutionContext — the single object handlers receive per ADR-009
// This eliminates 20+ param injection and makes replay/audit trivial

export interface ExecutionContext<TCommand = unknown> {
  identity: {
    identityId: string;
    actorId: string;
    actorType: 'human'|'organization'|'ai_agent'|'service_account'|'governance'|'external_system'|'system';
    trustLevel: 'NONE'|'LOW'|'MEDIUM'|'HIGH'|'SOVEREIGN';
    sessionId: string;
  };
  policyDecision: { decisionId: string; decision: 'ALLOW'|'DENY'|'ESCALATE'|'DEFER'; deterministicHash: string };
  capabilities: Array<{ capabilityId: string; scopePattern: string }>;
  correlationId: string; causationId: string; traceId: string;
  auditContext: { retentionClass: 'permanent'|'regulatory_7y'|'operational_90d'|'session'; constitutionalRules: string[] };
  vault?: { assetId?: string; lockId?: string; availableBalance?: string };
  treasury?: { orderId?: string; state?: string };
  ledger?: { entryId?: string; balanced?: boolean };
  payment?: { paymentRequestId?: string; railType?: string };
  command: TCommand;
  commandId: string;
  constitutionalGates: { identity: boolean; capability: boolean; scope: boolean; policy: boolean };
}

export interface CommandHandler<T> {
  handle(ctx: ExecutionContext<T>): Promise<any[]>;
}

// Mock for tests — deterministic, no randomness
export function mockExecutionContext<T>(overrides: Partial<ExecutionContext<T>> & { command: T }): ExecutionContext<T> {
  return {
    identity: { identityId: '00000000-0000-0000-0000-000000000001', actorId: '00000000-0000-0000-0000-000000000002', actorType: 'human', trustLevel: 'HIGH', sessionId: '00000000-0000-0000-0000-000000000003' },
    policyDecision: { decisionId: '00000000-0000-0000-0000-000000000010', decision: 'ALLOW', deterministicHash: 'ph_deterministic' },
    capabilities: [{ capabilityId: 'vault.asset.create', scopePattern: 'asset:*:*' }],
    correlationId: '00000000-0000-0000-0000-000000000020',
    causationId: '00000000-0000-0000-0000-000000000021',
    traceId: '00000000-0000-0000-0000-000000000022',
    auditContext: { retentionClass: 'permanent', constitutionalRules: ['INV-001','INV-005'] },
    command: overrides.command,
    commandId: '00000000-0000-0000-0000-000000000030',
    constitutionalGates: { identity: true, capability: true, scope: true, policy: true },
    ...overrides,
  } as ExecutionContext<T>;
}
