// ============================================================
// SOVR Runtime — AI-Agent Governor Sandbox & SDK Client
// File: packages/runtime/src/sdk/agent-sandbox.ts
// ============================================================

export interface AgentExecutionEnvelope {
  agentId: string;
  intentId: string;
  promptHash: string;
  quotaLimitUSD: number;
  currentSpendingUSD: number;
  modelVersion: string;
}

export class AgentSandbox {
  constructor(private readonly envelope: AgentExecutionEnvelope) {}

  verifyExecutionSafety(commandAmountUSD: number): { action: "PROCEED" | "MANDATORY_ESCALATION" | "REJECT"; reason: string } {
    const proposedSpending = this.envelope.currentSpendingUSD + commandAmountUSD;
    const safetyMarginThreshold = this.envelope.quotaLimitUSD * 0.9;

    if (proposedSpending > this.envelope.quotaLimitUSD) {
      return {
        action: "REJECT",
        reason: `🚨 Budget exceeded. limit: ${this.envelope.quotaLimitUSD} USD, proposed: ${proposedSpending} USD.`
      };
    }

    if (proposedSpending >= safetyMarginThreshold) {
      return {
        action: "MANDATORY_ESCALATION",
        reason: `⚠️ Warning: AI-agent spending reached 90% threshold safety boundary (${proposedSpending}/${this.envelope.quotaLimitUSD} USD). Mandatory human-in-the-loop escalation required.`
      };
    }

    return {
      action: "PROCEED",
      reason: "Execution context within secure operational bounds."
    };
  }
}
