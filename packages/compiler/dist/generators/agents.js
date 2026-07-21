import { sha256 } from '../utils/hash.js';
export function generateAgentSandbox(ir) {
    const protocolVersion = ir.meta.protocolVersion;
    const compilerVersion = ir.meta.compilerVersion;
    const lines = [];
    lines.push('// SOVR GENERATED — AI-Agent "Governor Sandbox" & Intent SDK');
    lines.push(`// Compiler: ${compilerVersion} Protocol: ${protocolVersion}`);
    lines.push('// Implements AI-agent safety wrappers, prompt hashing, budget quotas, and human-in-the-loop escalations');
    lines.push('');
    lines.push('export interface AgentExecutionEnvelope {');
    lines.push('  agentId: string;');
    lines.push('  intentId: string;       // Trace back to human authorization (INV-010)');
    lines.push('  promptHash: string;     // Sha256 of execution instructions');
    lines.push('  quotaLimitUSD: number;  // Financial cap per hour/day');
    lines.push('  currentSpendingUSD: number;');
    lines.push('  modelVersion: string;   // Traceability metadata');
    lines.push('}');
    lines.push('');
    lines.push('export class AgentSandbox {');
    lines.push('  constructor(private readonly envelope: AgentExecutionEnvelope) {}');
    lines.push('');
    lines.push('  // Evaluates risk prior to command execution');
    lines.push('  verifyExecutionSafety(commandAmountUSD: number): { action: "PROCEED" | "MANDATORY_ESCALATION" | "REJECT"; reason: string } {');
    lines.push('    // Rule 1: check autonomous budget limit (90% threshold escalation)');
    lines.push('    const proposedSpending = this.envelope.currentSpendingUSD + commandAmountUSD;');
    lines.push('    const safetyMarginThreshold = this.envelope.quotaLimitUSD * 0.9;');
    lines.push('');
    lines.push('    if (proposedSpending > this.envelope.quotaLimitUSD) {');
    lines.push('      return {');
    lines.push('        action: "REJECT",');
    lines.push('        reason: `🚨 Budget exceeded. limit: ${this.envelope.quotaLimitUSD} USD, proposed: ${proposedSpending} USD.`');
    lines.push('      };');
    lines.push('    }');
    lines.push('');
    lines.push('    if (proposedSpending >= safetyMarginThreshold) {');
    lines.push('      return {');
    lines.push('        action: "MANDATORY_ESCALATION",');
    lines.push('        reason: `⚠️ Warning: AI-agent spending reached 90% threshold safety boundary (${proposedSpending}/${this.envelope.quotaLimitUSD} USD). Mandatory human-in-the-loop escalation required.`');
    lines.push('      };');
    lines.push('    }');
    lines.push('');
    lines.push('    return {');
    lines.push('      action: "PROCEED",');
    lines.push('      reason: "Execution context within secure operational bounds."');
    lines.push('    };');
    lines.push('  }');
    lines.push('}');
    lines.push('');
    const body = lines.join('\n');
    const full = `// SOVR GENERATED — AGENT GOVERNOR SANDBOX — DO NOT EDIT\n// hash ${sha256(body)}\n${body}`;
    return [{
            path: 'src/sdk/agent-sandbox.ts',
            content: full,
            sha256: sha256(full),
            sourceRefs: ['01_constitution.yaml', 'domains/agent.yaml']
        }];
}
//# sourceMappingURL=agents.js.map