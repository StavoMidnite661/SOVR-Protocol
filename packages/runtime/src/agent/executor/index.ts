import type { Mission, MissionStep, MissionStatus } from '../types.js';

export interface MissionExecutorConfig {
  enable_dry_run: boolean;
  require_policy_approval: boolean;
}

export class MissionExecutor {
  constructor(private config: MissionExecutorConfig) {}

  async executeStep(mission: Mission, step: MissionStep): Promise<{ success: boolean; result: Record<string, unknown>; error?: string }> {
    if (this.config.enable_dry_run) {
      return {
        success: true,
        result: { dry_run: true, command_type: step.command_type, domain: step.domain },
      };
    }

    try {
      const result = await this.invokeDomainHandler(step);
      step.status = 'COMPLETED';
      step.result = result;
      return { success: true, result };
    } catch (error) {
      step.status = 'FAILED';
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, result: {}, error: errorMessage };
    }
  }

  async executeMission(mission: Mission): Promise<MissionStatus> {
    let completedSteps = 0;

    for (const step of mission.steps) {
      if (step.depends_on.length > 0) {
        const dependenciesMet = step.depends_on.every((depId) =>
          mission.steps.some((s) => s.step_id === depId && s.status === 'COMPLETED')
        );
        if (!dependenciesMet) {
          step.status = 'FAILED';
          mission.errors.push(`Dependencies not met for step ${step.step_id}`);
          continue;
        }
      }

      const result = await this.executeStep(mission, step);
      if (!result.success) {
        mission.errors.push(result.error || `Step ${step.step_id} failed`);
      } else {
        completedSteps++;
      }
    }

    if (completedSteps === mission.steps.length) {
      mission.status = 'COMPLETED';
      mission.completed_at = new Date().toISOString();
    } else if (mission.steps.some((s) => s.status === 'FAILED')) {
      mission.status = 'FAILED';
      mission.failed_at = new Date().toISOString();
    }

    return mission.status;
  }

  private async invokeDomainHandler(step: MissionStep): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          command_type: step.command_type,
          domain: step.domain,
          executed_at: new Date().toISOString(),
          status: 'ACCEPTED',
        });
      }, 10);
    });
  }
}
