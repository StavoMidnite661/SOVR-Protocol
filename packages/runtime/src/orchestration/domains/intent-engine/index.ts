import type { Intent, ExecutionPlan, ExecutionStep, IntentType } from '../../types.js';

export interface IntentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface IntentEngineConfig {
  max_payload_size: number;
  allowed_intent_types: IntentType[];
  require_policy_context: boolean;
}

export class IntentEngine {
  private readonly intentStore: Map<string, Intent> = new Map();
  private readonly validationRules: Map<string, (intent: Intent) => IntentValidationResult> = new Map();

  constructor(private config: IntentEngineConfig) {
    this.registerDefaultValidators();
  }

  private registerDefaultValidators() {
    this.validationRules.set('validate_actor', (intent) => {
      if (!intent.actor || intent.actor.length === 0) {
        return { valid: false, errors: ['Missing actor'], warnings: [] };
      }
      return { valid: true, errors: [], warnings: [] };
    });

    this.validationRules.set('validate_payload', (intent) => {
      if (Object.keys(intent.payload).length === 0) {
        return { valid: false, errors: ['Empty payload'], warnings: [] };
      }
      return { valid: true, errors: [], warnings: [] };
    });

    this.validationRules.set('validate_policy_context', (intent) => {
      if (this.config.require_policy_context && Object.keys(intent.policy_context).length === 0) {
        return { valid: false, errors: ['Missing policy context'], warnings: [] };
      }
      return { valid: true, errors: [], warnings: [] };
    });
  }

  submitIntent(intentType: IntentType, actor: string, payload: Record<string, unknown>, policyContext: Record<string, unknown>): Intent {
    const intentId = `intent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const intent: Intent = {
      intent_id: intentId,
      intent_type: intentType,
      actor,
      timestamp: new Date().toISOString(),
      payload,
      policy_context: policyContext,
      status: 'PENDING',
    };

    this.intentStore.set(intentId, intent);
    return intent;
  }

  validate(intent: Intent): IntentValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    for (const [name, validator] of this.validationRules) {
      const result = validator(intent);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    }

    const isValid = allErrors.length === 0;
    if (isValid) {
      intent.status = 'VALIDATED';
      intent.execution_plan = this.generateExecutionPlan(intent);
    } else {
      intent.status = 'REJECTED';
    }

    this.intentStore.set(intent.intent_id, intent);
    return { valid: isValid, errors: allErrors, warnings: allWarnings };
  }

  private generateExecutionPlan(intent: Intent): ExecutionPlan {
    const steps: ExecutionStep[] = [];

    switch (intent.intent_type) {
      case 'CREATE_VAULT_INTENT':
      case 'OPEN_VAULT':
        steps.push({
          step_id: `step_${Date.now()}_1`,
          command_type: 'OPEN_VAULT',
          domain: 'vault',
          payload: intent.payload,
          depends_on: [],
          timeout_ms: 5000,
        });
        break;
      case 'LOCK_VAULT':
        steps.push({
          step_id: `step_${Date.now()}_1`,
          command_type: 'LOCK_VAULT',
          domain: 'vault',
          payload: intent.payload,
          depends_on: [],
          timeout_ms: 5000,
        });
        break;
      case 'CREATE_ALLOCATION_REQUEST':
        steps.push({
          step_id: `step_${Date.now()}_1`,
          command_type: 'CREATE_ALLOCATION_REQUEST',
          domain: 'treasury',
          payload: intent.payload,
          depends_on: [],
          timeout_ms: 5000,
        });
        steps.push({
          step_id: `step_${Date.now()}_2`,
          command_type: 'APPROVE_ALLOCATION',
          domain: 'treasury',
          payload: intent.payload,
          depends_on: [`step_${Date.now()}_1`],
          timeout_ms: 5000,
        });
        steps.push({
          step_id: `step_${Date.now()}_3`,
          command_type: 'EXECUTE_ALLOCATION',
          domain: 'treasury',
          payload: intent.payload,
          depends_on: [`step_${Date.now()}_2`],
          timeout_ms: 5000,
        });
        break;
      case 'CREATE_PAYMENT_INTENT':
        steps.push({
          step_id: `step_${Date.now()}_1`,
          command_type: 'CREATE_PAYMENT_INTENT',
          domain: 'payment',
          payload: intent.payload,
          depends_on: [],
          timeout_ms: 5000,
        });
        steps.push({
          step_id: `step_${Date.now()}_2`,
          command_type: 'AUTHORIZE_PAYMENT',
          domain: 'payment',
          payload: intent.payload,
          depends_on: [`step_${Date.now()}_1`],
          timeout_ms: 5000,
        });
        steps.push({
          step_id: `step_${Date.now()}_3`,
          command_type: 'EXECUTE_INTERNAL_SETTLEMENT',
          domain: 'payment',
          payload: intent.payload,
          depends_on: [`step_${Date.now()}_2`],
          timeout_ms: 5000,
        });
        break;
      default:
        steps.push({
          step_id: `step_${Date.now()}_1`,
          command_type: intent.intent_type,
          domain: 'intent',
          payload: intent.payload,
          depends_on: [],
          timeout_ms: 5000,
        });
    }

    return {
      plan_id: `plan_${intent.intent_id}`,
      intent_id: intent.intent_id,
      steps,
      estimated_duration_ms: steps.length * 1000,
      requires_approval: ['APPROVE_ALLOCATION', 'EXECUTE_ALLOCATION'].includes(intent.intent_type),
      max_retries: 3,
    };
  }

  getIntent(intentId: string): Intent | undefined {
    return this.intentStore.get(intentId);
  }

  getAllIntents(): Intent[] {
    return Array.from(this.intentStore.values());
  }
}
