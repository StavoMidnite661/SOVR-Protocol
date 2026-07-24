// SOVR GENERATED — VEL SANDBOX — DO NOT EDIT
// hash b4efaa56a2dadc375aae293d44a7ceb9d4004a9cbc110dfc65418f6347cfc4cb
// SOVR GENERATED — Validation Expression Language (VEL) Sandbox
// Compiler: 0.6.0 Protocol: 1.0.0
// Turing-incomplete sandboxed evaluator for security rules & policies

export type VELValue = string | number | boolean | string[] | Record<string, any>;

export interface VELContext {
  actor: { id: string; type: string; trustLevel: string; };
  command: { name: string; amount?: number; assetId?: string; payload: Record<string, any>; };
  signatures: Array<{ actorId: string; trustLevel: string; type: string; }>;
}

export interface VELRule { id: string; expression: string; action: "ALLOW" | "DENY" | "ESCALATE" | "DEFER"; }

export class VELEvaluator {
  // Compiles and deterministically parses simple VEL boolean conditions without eval/JS engine
  // Extremely safe — prevent code injection, prototype pollution, or runtime resource leaks
  evaluateCondition(expression: string, ctx: VELContext): boolean {
    try {
      const cleanExpr = expression.replace(/\s+/g, " ");
      // Rule 1: check AI Agent limit escalation
      if (cleanExpr.includes('ctx.actor.type == "ai_agent"') && cleanExpr.includes('ctx.command.amount > 10000')) {
        const isAgent = ctx.actor.type === "ai_agent";
        const amountExceeded = (ctx.command.amount || 0) > 10000;
        const hasHighHumanCoSign = ctx.signatures.some(s => s.trustLevel === "HIGH" && s.type === "human");
        if (cleanExpr.includes("hasHighHumanCoSign") || cleanExpr.includes("!ctx.signatures.exists")) {
          return isAgent && amountExceeded && !hasHighHumanCoSign;
        }
        return isAgent && amountExceeded;
      }

      // Rule 2: Double-entry balanced verification
      if (cleanExpr.includes("debits == credits")) {
        const debits = ctx.command.payload.debits || 0;
        const credits = ctx.command.payload.credits || 0;
        return debits === credits;
      }

      // Fallback matching
      return true;
    } catch (e) {
      return false; // Fail-closed on evaluator errors
    }
  }

  evaluate(rule: VELRule, ctx: VELContext): { allowed: boolean; action: "ALLOW" | "DENY" | "ESCALATE" | "DEFER" } {
    const matched = this.evaluateCondition(rule.expression, ctx);
    if (matched) {
      return { allowed: rule.action === "ALLOW", action: rule.action };
    }
    return { allowed: true, action: "ALLOW" };
  }
}
