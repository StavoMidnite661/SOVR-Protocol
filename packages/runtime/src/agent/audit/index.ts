import type { AgentActionEvent } from '../types.js';

export interface AgentAuditTrailConfig {
  retention_class: 'permanent' | 'regulatory_7y' | 'operational_90d' | 'session';
  enable_hash_chain: boolean;
}

export class AgentAuditTrail {
  private readonly events: AgentActionEvent[] = [];
  private readonly config: AgentAuditTrailConfig;

  constructor(config: AgentAuditTrailConfig) {
    this.config = config;
  }

  recordAction(
    agentId: string,
    missionId: string,
    action: string,
    reasoningSummary: string,
    commandGenerated?: string,
    policyDecision?: string
  ): AgentActionEvent {
    const previousHash = this.events.length > 0 ? this.events[this.events.length - 1].hash : '0'.repeat(64);
    const eventId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();

    const event: AgentActionEvent = {
      event_id: eventId,
      agent_id: agentId,
      mission_id: missionId,
      action,
      reasoning_summary: reasoningSummary,
      command_generated: commandGenerated,
      timestamp,
      previous_hash: previousHash,
      hash: this.computeHash({ event_id: eventId, agent_id: agentId, mission_id: missionId, action, reasoning_summary: reasoningSummary, timestamp, previous_hash: previousHash }),
      policy_decision: policyDecision,
    };

    this.events.push(event);
    return event;
  }

  getEventsByAgent(agentId: string): AgentActionEvent[] {
    return this.events.filter((e) => e.agent_id === agentId);
  }

  getEventsByMission(missionId: string): AgentActionEvent[] {
    return this.events.filter((e) => e.mission_id === missionId);
  }

  getAllEvents(): AgentActionEvent[] {
    return [...this.events];
  }

  getCount(): number {
    return this.events.length;
  }

  validateChain(): { valid: boolean; broken_links: string[] } {
    const brokenLinks: string[] = [];
    for (let i = 1; i < this.events.length; i++) {
      const prev = this.events[i - 1];
      const curr = this.events[i];
      if (curr.previous_hash !== prev.hash) {
        brokenLinks.push(`${prev.event_id} -> ${curr.event_id}`);
      }
    }
    return { valid: brokenLinks.length === 0, broken_links: brokenLinks };
  }

  clear(): void {
    this.events.length = 0;
  }

  private computeHash(data: Record<string, unknown>): string {
    const str = JSON.stringify(data);
    let hash = 0n;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 131n + BigInt(str.charCodeAt(i))) & 0xFFFFFFFFFFFFFFFFn;
    }
    return hash.toString(16).padStart(64, '0').slice(0, 64);
  }
}
