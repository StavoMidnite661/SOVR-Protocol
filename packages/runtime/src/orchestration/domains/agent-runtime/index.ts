export interface AgentRuntimeState {
  agent_id: string;
  status: 'IDLE' | 'BUSY' | 'RETRY' | 'OFFLINE' | 'WAITING';
  permissions: AgentPermissions;
  last_active: string;
  completed_workflows: number;
  failed_workflows: number;
}

export interface AgentPermissions {
  read: boolean;
  analyze: boolean;
  create_command: boolean;
  execute_mutation: boolean;
  direct_ledger_access: boolean;
}

export interface AgentMission {
  mission_id: string;
  agent_id: string;
  intent: string;
  steps: string[];
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  created_at: string;
  completed_at?: string;
}

export const AGENT_PERMISSIONS: AgentPermissions = {
  read: true,
  analyze: true,
  create_command: true,
  execute_mutation: false,
  direct_ledger_access: false,
};

export class AgentRuntimeDomain {
  private readonly agents: Map<string, AgentRuntimeState> = new Map();
  private readonly missions: Map<string, AgentMission> = new Map();
  private readonly eventLog: Array<{ event: string; agent_id?: string; mission_id?: string; timestamp: string }> = [];

  registerAgent(agentId: string): AgentRuntimeState {
    const state: AgentRuntimeState = {
      agent_id: agentId,
      status: 'IDLE',
      permissions: { ...AGENT_PERMISSIONS },
      last_active: new Date().toISOString(),
      completed_workflows: 0,
      failed_workflows: 0,
    };
    this.agents.set(agentId, state);
    this.eventLog.push({ event: 'AgentRegistered', agent_id: agentId, timestamp: new Date().toISOString() });
    return state;
  }

  submitMission(agentId: string, intent: string, steps: string[]): AgentMission {
    const mission: AgentMission = {
      mission_id: `mission_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      agent_id: agentId,
      intent,
      steps,
      status: 'PENDING',
      created_at: new Date().toISOString(),
    };

    this.missions.set(mission.mission_id, mission);
    this.eventLog.push({ event: 'AgentMissionCreated', agent_id: agentId, mission_id: mission.mission_id, timestamp: new Date().toISOString() });
    return mission;
  }

  executeMissionStep(missionId: string, stepIndex: number): { success: boolean; result: string } {
    const mission = this.missions.get(missionId);
    if (!mission || stepIndex >= mission.steps.length) {
      return { success: false, result: 'Invalid mission or step index' };
    }

    const agent = this.agents.get(mission.agent_id);
    if (!agent) {
      return { success: false, result: 'Agent not registered' };
    }

    if (!agent.permissions.create_command) {
      return { success: false, result: 'Agent lacks create_command permission' };
    }

    mission.status = 'RUNNING';
    const stepResult = `Executed step ${stepIndex}: ${mission.steps[stepIndex]}`;
    this.eventLog.push({ event: 'AgentStepExecuted', agent_id: mission.agent_id, mission_id: missionId, timestamp: new Date().toISOString() });

    if (stepIndex === mission.steps.length - 1) {
      mission.status = 'COMPLETED';
      mission.completed_at = new Date().toISOString();
      agent.completed_workflows++;
      agent.status = 'IDLE';
      agent.last_active = new Date().toISOString();
      this.agents.set(mission.agent_id, agent);
      this.missions.set(missionId, mission);
      this.eventLog.push({ event: 'AgentMissionCompleted', agent_id: mission.agent_id, mission_id: missionId, timestamp: new Date().toISOString() });
    }

    return { success: true, result: stepResult };
  }

  verifyGovernanceBoundary(agentId: string): { compliant: boolean; violations: string[] } {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { compliant: false, violations: ['Agent not registered'] };
    }

    const violations: string[] = [];
    if (agent.permissions.direct_ledger_access) {
      violations.push('Agent has direct_ledger_access permission — governance boundary violated');
    }
    if (agent.permissions.execute_mutation) {
      violations.push('Agent has execute_mutation permission — governance boundary violated');
    }

    return { compliant: violations.length === 0, violations };
  }

  getAgent(agentId: string): AgentRuntimeState | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): AgentRuntimeState[] {
    return Array.from(this.agents.values());
  }

  getMission(missionId: string): AgentMission | undefined {
    return this.missions.get(missionId);
  }

  getEventLog() {
    return [...this.eventLog];
  }
}
