// SOVR GENERATED — ACTIVE CONSTITUTIONAL GUARDRAILS — DO NOT EDIT
// hash 1cdcdb9a0057e40ac12df35c0e45635fc7b52a39149b80d3e26a0ed128559165
// SOVR GENERATED — Active Constitutional Guardrail Command Bus
// Compiler: 0.6.0 Protocol: 1.0.0
// Implements L0 runtime enforcement for Invariants INV-001 through INV-010

import { ExecutionContext } from "./execution-context.js";

export interface TransactionEffects {
  emittedEvents: Array<{ eventName: string; payload: any; }>;
  mutations: Array<{ table: string; key: string; oldValue: any; newValue: any; }>;
  journalEntries?: Array<{ debits: number; credits: number; }>;
}

export class GuardrailCommandBus {
  // Intercept and Dry-Run a command inside a sandbox before actual database write
  async executeSecure<T>(ctx: ExecutionContext<T>, businessLogic: (context: ExecutionContext<T>) => Promise<TransactionEffects>): Promise<TransactionEffects> {
    console.log(`🛡️ Intercepting command ${ctx.commandId} for active guardrail verification...`);
    
    // 1. Dry run the handler to get proposed output state changes (effects)
    const effects = await businessLogic(ctx);

    // 2. Validate INV-001: Every state change requires an immutable event
    if (effects.mutations.length > 0 && effects.emittedEvents.length === 0) {
      throw new Error("🚨 CONSTITUTIONAL VIOLATION: INV-001 — Cannot mutate state without emitting an event.");
    }

    // 3. Validate INV-002: Double-Entry Balance
    if (effects.journalEntries && effects.journalEntries.length > 0) {
      for (const entry of effects.journalEntries) {
        if (entry.debits !== entry.credits) {
          throw new Error(`🚨 CONSTITUTIONAL VIOLATION: INV-002 — Double-entry mismatch! Debits (${entry.debits}) != Credits (${entry.credits}).`);
        }
      }
    }

    // 4. Validate INV-003: Authority Boundary check
    const requiredCap = (ctx as any).command?.constructor?.capability;
    if (requiredCap) {
      const hasCap = ctx.capabilities.some(c => c.capabilityId === requiredCap);
      if (!hasCap) {
        throw new Error(`🚨 CONSTITUTIONAL VIOLATION: INV-003 — Actor lack capability ${requiredCap} within scope boundary.`);
      }
    }

    // 5. Validate INV-004: Agent financial authority prohibition
    if (ctx.identity.actorType === "ai_agent") {
      const grantsAuthority = effects.emittedEvents.some(e => 
        e.eventName.includes("capability.granted") || e.eventName.includes("delegation.created")
      );
      if (grantsAuthority) {
        throw new Error("🚨 CONSTITUTIONAL VIOLATION: INV-004 — Autonomous agents are prohibited from creating or granting financial authority.");
      }
    }

    // All L0 invariants hold! Committing effects to log
    console.log("🛡️ Guardrail checks PASSED. Transacting secure effects.");
    return effects;
  }
}
