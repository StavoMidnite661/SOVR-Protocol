import type { AgentIntent, ExecutionPlan, ExecutionStep, MissionStep } from '../types.js';

export interface MissionPlannerConfig {
  default_step_timeout_ms: number;
  max_plan_steps: number;
  require_policy_check: boolean;
}

export class MissionPlanner {
  constructor(private config: MissionPlannerConfig) {}

  plan(intent: AgentIntent): ExecutionPlan {
    if (!intent.validated) {
      throw new Error('Cannot plan mission for unvalidated intent');
    }

    const steps = this.generateSteps(intent);
    const plan: ExecutionPlan = {
      plan_id: `plan_${intent.intent_id}`,
      intent_id: intent.intent_id,
      steps,
      estimated_duration_ms: steps.length * this.config.default_step_timeout_ms,
      requires_approval: this.requiresApproval(intent),
      max_retries: 3,
      deterministic_hash: this.computeDeterministicHash(intent.intent_id, steps),
    };

    return plan;
  }

  convertToMissionSteps(plan: ExecutionPlan): MissionStep[] {
    return plan.steps.map((step) => ({
      step_id: step.step_id,
      command_type: step.command_type,
      domain: step.domain,
      payload: step.payload,
      depends_on: step.depends_on,
      status: 'PENDING' as const,
    }));
  }

  private generateSteps(intent: AgentIntent): ExecutionStep[] {
    const classifiedType = intent.classified_type || this.classifyIntent(intent);
    return this.buildStepsForClassification(classifiedType, intent);
  }

  private classifyIntent(intent: AgentIntent): string {
    const lower = intent.objective.toLowerCase();
    if (lower.includes('vault') || lower.includes('lock') || lower.includes('release')) {
      return 'VAULT_LIFECYCLE';
    }
    if (lower.includes('treasury') || lower.includes('allocation') || lower.includes('reserve')) {
      return 'TREASURY_ALLOCATION';
    }
    if (lower.includes('payment') || lower.includes('settlement') || lower.includes('transfer')) {
      return 'PAYMENT_SIMULATION';
    }
    return 'GENERIC_WORKFLOW';
  }

  private buildStepsForClassification(classifiedType: string, intent: AgentIntent): ExecutionStep[] {
    const basePayload = { intent_id: intent.intent_id, actor: intent.actor };

    switch (classifiedType) {
      case 'VAULT_LIFECYCLE':
        return [
          {
            step_id: `step_${intent.intent_id}_1`,
            command_type: 'CREATE_VAULT_INTENT',
            domain: 'vault',
            payload: basePayload,
            depends_on: [],
            timeout_ms: this.config.default_step_timeout_ms,
            policy_check_required: this.config.require_policy_check,
          },
          {
            step_id: `step_${intent.intent_id}_2`,
            command_type: 'OPEN_VAULT',
            domain: 'vault',
            payload: { ...basePayload, vault_id: `vault_${intent.intent_id}`, asset_type: 'USD' },
            depends_on: [`step_${intent.intent_id}_1`],
            timeout_ms: this.config.default_step_timeout_ms,
            policy_check_required: this.config.require_policy_check,
          },
          {
            step_id: `step_${intent.intent_id}_3`,
            command_type: 'LOCK_VAULT',
            domain: 'vault',
            payload: { ...basePayload, vault_id: `vault_${intent.intent_id}`, reason: 'agent_lifecycle' },
            depends_on: [`step_${intent.intent_id}_2`],
            timeout_ms: this.config.default_step_timeout_ms,
            policy_check_required: this.config.require_policy_check,
          },
        ];
      case 'TREASURY_ALLOCATION':
        return [
          {
            step_id: `step_${intent.intent_id}_1`,
            command_type: 'CREATE_ALLOCATION_REQUEST',
            domain: 'treasury',
            payload: { ...basePayload, from_pool: 'SYSTEM_RESERVE_POOL', to_pool: 'TREASURY_OPERATING', amount: '10', currency: 'USD', reason: 'agent_allocation' },
            depends_on: [],
            timeout_ms: this.config.default_step_timeout_ms,
            policy_check_required: this.config.require_policy_check,
          },
          {
            step_id: `step_${intent.intent_id}_2`,
            command_type: 'APPROVE_ALLOCATION',
            domain: 'treasury',
            payload: basePayload,
            depends_on: [`step_${intent.intent_id}_1`],
            timeout_ms: this.config.default_step_timeout_ms,
            policy_check_required: this.config.require_policy_check,
          },
          {
            step_id: `step_${intent.intent_id}_3`,
            command_type: 'EXECUTE_ALLOCATION',
            domain: 'treasury',
            payload: basePayload,
            depends_on: [`step_${intent.intent_id}_2`],
            timeout_ms: this.config.default_step_timeout_ms,
            policy_check_required: this.config.require_policy_check,
          },
        ];
      case 'PAYMENT_SIMULATION':
        return [
          {
            step_id: `step_${intent.intent_id}_1`,
            command_type: 'CREATE_PAYMENT_INTENT',
            domain: 'payment',
            payload: { ...basePayload, amount: '100', currency: 'USD', from_account: 'SYSTEM_RESERVE_POOL', to_account: 'TREASURY_OPERATING' },
            depends_on: [],
            timeout_ms: this.config.default_step_timeout_ms,
            policy_check_required: this.config.require_policy_check,
          },
          {
            step_id: `step_${intent.intent_id}_2`,
            command_type: 'AUTHORIZE_PAYMENT',
            domain: 'payment',
            payload: basePayload,
            depends_on: [`step_${intent.intent_id}_1`],
            timeout_ms: this.config.default_step_timeout_ms,
            policy_check_required: this.config.require_policy_check,
          },
        ];
      default:
        return [
          {
            step_id: `step_${intent.intent_id}_1`,
            command_type: 'CREATE_VAULT_INTENT',
            domain: 'vault',
            payload: basePayload,
            depends_on: [],
            timeout_ms: this.config.default_step_timeout_ms,
            policy_check_required: this.config.require_policy_check,
          },
        ];
    }
  }

  private requiresApproval(intent: AgentIntent): boolean {
    const classifiedType = intent.classified_type || this.classifyIntent(intent);
    return classifiedType === 'TREASURY_ALLOCATION';
  }

  private computeDeterministicHash(intentId: string, steps: ExecutionStep[]): string {
    const data = JSON.stringify({ intentId, steps });
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = (hash * 131 + data.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0').slice(0, 64);
  }
}
