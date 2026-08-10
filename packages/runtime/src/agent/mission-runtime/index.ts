import type { Mission, MissionStep, MissionStatus, MissionRuntimeResult, AgentPermissions, PermissionDecision } from '../types.js';
import { IntentEngine } from '../intent-engine/index.js';

export interface MissionRuntimeConfig {
  max_concurrent_missions: number;
  default_step_timeout_ms: number;
  max_retries: number;
  require_policy_approval: boolean;
}

export interface RunningMission {
  mission: Mission;
  current_step_index: number;
  retry_count: number;
  started_at: string;
}

export class MissionRuntime {
  private readonly missions: Map<string, RunningMission> = new Map();
  private readonly completedMissions: Mission[] = [];
  private readonly permissions: AgentPermissions;

  constructor(private config: MissionRuntimeConfig, permissions: AgentPermissions) {
    this.permissions = permissions;
  }

  async createMission(intentId: string, agentId: string, steps: MissionStep[], policyContext: Record<string, unknown>): Promise<Mission> {
    if (this.permissions.create_command !== 'ALLOWED' && this.permissions.create_command !== 'REQUIRES_POLICY') {
      throw new Error(`Agent lacks create_command permission: ${this.permissions.create_command}`);
    }

    const mission: Mission = {
      mission_id: `mission_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      intent_id: intentId,
      agent_id: agentId,
      status: 'CREATED',
      steps,
      policy_context: policyContext,
      created_at: new Date().toISOString(),
      errors: [],
    };

    this.missions.set(mission.mission_id, { mission, current_step_index: 0, retry_count: 0, started_at: mission.created_at });
    return mission;
  }

  async executeMission(missionId: string): Promise<MissionRuntimeResult> {
    const running = this.missions.get(missionId);
    if (!running) {
      return {
        mission_id: missionId,
        status: 'FAILED',
        steps_completed: 0,
        steps_total: 0,
        commands_emitted: 0,
        events_emitted: 0,
        ledger_mutations: 0,
        errors: ['Mission not found'],
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };
    }

    running.mission.status = 'EXECUTING';
    let stepsCompleted = 0;
    const errors: string[] = [];
    let commandsEmitted = 0;

    try {
      let ledgerMutations = 0;
      for (let i = 0; i < running.mission.steps.length; i++) {
        running.current_step_index = i;
        const step = running.mission.steps[i];

        if (step.depends_on.length > 0) {
          const dependenciesMet = step.depends_on.every((depId) =>
            running.mission.steps.some((s) => s.step_id === depId && s.status === 'COMPLETED')
          );
          if (!dependenciesMet) {
            step.status = 'FAILED';
            errors.push(`Dependencies not met for step ${step.step_id}`);
            continue;
          }
        }

        step.status = 'EXECUTING';
        commandsEmitted++;

        if (step.domain === 'treasury' || step.domain === 'payment') {
          ledgerMutations++;
        }

        step.status = 'COMPLETED';
        stepsCompleted++;
      }

      running.mission.status = 'COMPLETED';
      running.mission.completed_at = new Date().toISOString();

      return {
        mission_id: missionId,
        status: 'COMPLETED',
        steps_completed: stepsCompleted,
        steps_total: running.mission.steps.length,
        commands_emitted: commandsEmitted,
        events_emitted: stepsCompleted,
        ledger_mutations: ledgerMutations,
        errors,
        started_at: running.started_at,
        completed_at: running.mission.completed_at,
      };
    } catch (error) {
      running.mission.status = 'FAILED';
      running.mission.failed_at = new Date().toISOString();
      errors.push(error instanceof Error ? error.message : String(error));

      return {
        mission_id: missionId,
        status: 'FAILED',
        steps_completed: stepsCompleted,
        steps_total: running.mission.steps.length,
        commands_emitted: commandsEmitted,
        events_emitted: stepsCompleted,
        ledger_mutations: 0,
        errors,
        started_at: running.started_at,
        completed_at: running.mission.failed_at,
      };
    }
  }

  getMission(missionId: string): Mission | undefined {
    return this.missions.get(missionId)?.mission;
  }

  getAllMissions(): Mission[] {
    return Array.from(this.missions.values()).map((m) => m.mission);
  }

  getCompletedMissions(): Mission[] {
    return [...this.completedMissions];
  }
}
