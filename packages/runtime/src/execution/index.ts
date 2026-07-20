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

export interface TransactionEffects {
  emittedEvents: Array<{ eventName: string; payload: any; }>;
  mutations: Array<{ table: string; key: string; oldValue: any; newValue: any; }>;
  journalEntries?: Array<{ debits: number; credits: number; }>;
}

export class GuardrailCommandBus {
  async executeSecure<T>(
    ctx: ExecutionContext<T>, 
    businessLogic: (context: ExecutionContext<T>) => Promise<TransactionEffects>
  ): Promise<TransactionEffects> {
    console.log(`🛡️ Intercepting command ${ctx.commandId} for active guardrail verification...`);
    
    const effects = await businessLogic(ctx);

    // INV-001 Verification
    if (effects.mutations.length > 0 && effects.emittedEvents.length === 0) {
      throw new Error("🚨 CONSTITUTIONAL VIOLATION: INV-001 — Cannot mutate state without emitting an event.");
    }

    // INV-002 Verification
    if (effects.journalEntries && effects.journalEntries.length > 0) {
      for (const entry of effects.journalEntries) {
        if (entry.debits !== entry.credits) {
          throw new Error(`🚨 CONSTITUTIONAL VIOLATION: INV-002 — Double-entry mismatch! Debits (${entry.debits}) != Credits (${entry.credits}).`);
        }
      }
    }

    // INV-003 Verification
    const requiredCap = (ctx as any).command?.constructor?.capability;
    if (requiredCap) {
      const hasCap = ctx.capabilities.some(c => c.capabilityId === requiredCap);
      if (!hasCap) {
        throw new Error(`🚨 CONSTITUTIONAL VIOLATION: INV-003 — Actor lacks capability ${requiredCap} within scope boundary.`);
      }
    }

    // INV-004 Verification
    if (ctx.identity.actorType === "ai_agent") {
      const grantsAuthority = effects.emittedEvents.some(e => 
        e.eventName.includes("capability.granted") || e.eventName.includes("delegation.created")
      );
      if (grantsAuthority) {
        throw new Error("🚨 CONSTITUTIONAL VIOLATION: INV-004 — Autonomous agents are prohibited from creating or granting financial authority.");
      }
    }

    console.log("🛡️ Guardrail checks PASSED. Transacting secure effects.");
    return effects;
  }
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
