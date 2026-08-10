import type {
  AgentIntent,
  ExecutionPlan,
  ExecutionStep,
  IntentStatus,
  RiskLevel,
  AgentPermissions,
  PermissionDecision,
} from '../types.js';

export interface IntentEngineConfig {
  max_objective_length: number;
  allowed_actors: string[];
  require_constraints: boolean;
  default_risk_level: RiskLevel;
}

export interface IntentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  classified_type?: string;
  risk_level?: RiskLevel;
}

export class IntentEngine {
  private readonly intentStore: Map<string, AgentIntent> = new Map();
  private readonly permissions: AgentPermissions;

  constructor(private config: IntentEngineConfig, permissions: AgentPermissions) {
    this.permissions = permissions;
  }

  createIntent(actor: string, objective: string, constraints: Record<string, unknown>, priority: RiskLevel): AgentIntent {
    if (this.permissions.create_intent !== 'ALLOWED') {
      throw new Error(`Agent lacks create_intent permission: ${this.permissions.create_intent}`);
    }

    if (!this.config.allowed_actors.includes(actor)) {
      throw new Error(`Actor ${actor} is not allowed to create intents`);
    }

    if (objective.length > this.config.max_objective_length) {
      throw new Error(`Objective exceeds max length ${this.config.max_objective_length}`);
    }

    const intentId = `intent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const intent: AgentIntent = {
      intent_id: intentId,
      actor,
      objective,
      constraints,
      priority,
      timestamp: new Date().toISOString(),
      status: 'PENDING',
    };

    this.intentStore.set(intentId, intent);
    return intent;
  }

  validateIntent(intent: AgentIntent): IntentValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!intent.objective || intent.objective.trim().length === 0) {
      errors.push('Objective is required');
    }

    if (this.config.require_constraints && Object.keys(intent.constraints).length === 0) {
      errors.push('Constraints are required');
    }

    if (!intent.actor || intent.actor.trim().length === 0) {
      errors.push('Actor is required');
    }

    const classifiedType = this.classifyIntent(intent);
    const riskLevel = this.assessRisk(intent);

    const valid = errors.length === 0;
    if (valid) {
      intent.status = 'VALIDATED';
      intent.validated = true;
      intent.mission_required = true;
      intent.classified_type = classifiedType;
      intent.risk_level = riskLevel;
      intent.execution_plan = this.generateDeterministicPlanId(intent);
    } else {
      intent.status = 'REJECTED';
    }

    this.intentStore.set(intent.intent_id, intent);
    return { valid, errors, warnings, classified_type: classifiedType, risk_level: riskLevel };
  }

  classifyIntent(intent: AgentIntent): string {
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

  assessRisk(intent: AgentIntent): RiskLevel {
    const lower = intent.objective.toLowerCase();
    if (lower.includes('transfer') || lower.includes('payment') || lower.includes('settlement')) {
      return 'HIGH';
    }
    if (lower.includes('allocation') || lower.includes('treasury')) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  generateExecutionPlan(intent: AgentIntent): ExecutionPlan {
    const classifiedType = intent.classified_type || this.classifyIntent(intent);
    const steps = this.buildStepsForClassification(classifiedType, intent);

    return {
      plan_id: `plan_${intent.intent_id}`,
      intent_id: intent.intent_id,
      steps,
      estimated_duration_ms: steps.length * 1000,
      requires_approval: classifiedType === 'TREASURY_ALLOCATION',
      max_retries: 3,
      deterministic_hash: this.computePlanHash(intent.intent_id, steps),
    };
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
            timeout_ms: 5000,
            policy_check_required: true,
          },
          {
            step_id: `step_${intent.intent_id}_2`,
            command_type: 'OPEN_VAULT',
            domain: 'vault',
            payload: { ...basePayload, vault_id: `vault_${intent.intent_id}`, asset_type: 'USD' },
            depends_on: [`step_${intent.intent_id}_1`],
            timeout_ms: 5000,
            policy_check_required: true,
          },
          {
            step_id: `step_${intent.intent_id}_3`,
            command_type: 'LOCK_VAULT',
            domain: 'vault',
            payload: { ...basePayload, vault_id: `vault_${intent.intent_id}`, reason: 'agent_lifecycle' },
            depends_on: [`step_${intent.intent_id}_2`],
            timeout_ms: 5000,
            policy_check_required: true,
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
            timeout_ms: 5000,
            policy_check_required: true,
          },
          {
            step_id: `step_${intent.intent_id}_2`,
            command_type: 'APPROVE_ALLOCATION',
            domain: 'treasury',
            payload: basePayload,
            depends_on: [`step_${intent.intent_id}_1`],
            timeout_ms: 5000,
            policy_check_required: true,
          },
          {
            step_id: `step_${intent.intent_id}_3`,
            command_type: 'EXECUTE_ALLOCATION',
            domain: 'treasury',
            payload: basePayload,
            depends_on: [`step_${intent.intent_id}_2`],
            timeout_ms: 5000,
            policy_check_required: true,
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
            timeout_ms: 5000,
            policy_check_required: true,
          },
          {
            step_id: `step_${intent.intent_id}_2`,
            command_type: 'AUTHORIZE_PAYMENT',
            domain: 'payment',
            payload: basePayload,
            depends_on: [`step_${intent.intent_id}_1`],
            timeout_ms: 5000,
            policy_check_required: true,
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
            timeout_ms: 5000,
            policy_check_required: true,
          },
        ];
    }
  }

  submitMission(intent: AgentIntent): { intent_id: string; mission_required: boolean; execution_plan: string } {
    if (intent.status !== 'VALIDATED') {
      throw new Error('Cannot submit mission for unvalidated intent');
    }

    return {
      intent_id: intent.intent_id,
      mission_required: intent.mission_required ?? true,
      execution_plan: intent.execution_plan || `plan_${intent.intent_id}`,
    };
  }

  getIntent(intentId: string): AgentIntent | undefined {
    return this.intentStore.get(intentId);
  }

  private generateDeterministicPlanId(intent: AgentIntent): string {
    const input = `${intent.intent_id}:${intent.objective}:${intent.priority}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash * 31 + input.charCodeAt(i)) | 0;
    }
    return `plan_${Math.abs(hash)}`;
  }

  private computePlanHash(intentId: string, steps: ExecutionStep[]): string {
    const data = JSON.stringify({ intentId, steps });
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = (hash * 131 + data.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0').slice(0, 64);
  }
}
