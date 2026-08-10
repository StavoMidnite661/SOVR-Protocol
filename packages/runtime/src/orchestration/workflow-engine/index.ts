import type { Intent, ExecutionPlan, ExecutionStep, WorkflowResult, DomainType, WorkflowEngineConfig } from '../types.js';
import { TransactionCoordinator } from '../transaction-coordinator/index.js';

export interface RunningWorkflow {
  workflow_id: string;
  intent: Intent;
  plan: ExecutionPlan;
  current_step: number;
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'COMPENSATING';
  started_at: string;
  completed_at?: string;
  errors: string[];
}

export class WorkflowEngine {
  private readonly workflows: Map<string, RunningWorkflow> = new Map();
  private readonly completedWorkflows: RunningWorkflow[] = [];

  constructor(private config: WorkflowEngineConfig, private coordinator: TransactionCoordinator) {}

  async execute(intent: Intent): Promise<WorkflowResult> {
    if (!intent.execution_plan) {
      return {
        workflow_id: `wf_${intent.intent_id}`,
        status: 'FAILED',
        commands_emitted: 0,
        events_emitted: 0,
        ledger_mutations: 0,
        errors: ['Intent has no execution plan'],
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };
    }

    const workflow: RunningWorkflow = {
      workflow_id: `wf_${intent.intent_id}`,
      intent,
      plan: intent.execution_plan,
      current_step: 0,
      status: 'RUNNING',
      started_at: new Date().toISOString(),
      errors: [],
    };

    this.workflows.set(workflow.workflow_id, workflow);

    try {
      for (const step of intent.execution_plan.steps) {
        workflow.current_step = intent.execution_plan.steps.indexOf(step);
        const result = await this.executeStep(step, intent);
        if (result.status === 'FAILED') {
          workflow.status = 'FAILED';
          workflow.errors.push(...result.errors);
          workflow.completed_at = new Date().toISOString();
          this.completedWorkflows.push(workflow);
          return result;
        }
      }

      workflow.status = 'COMPLETED';
      workflow.completed_at = new Date().toISOString();
      this.completedWorkflows.push(workflow);

      return {
        workflow_id: workflow.workflow_id,
        status: 'COMPLETED',
        commands_emitted: intent.execution_plan.steps.length,
        events_emitted: intent.execution_plan.steps.length,
        ledger_mutations: intent.execution_plan.steps.filter((s) => s.domain === 'treasury' || s.domain === 'payment').length,
        errors: [],
        started_at: workflow.started_at,
        completed_at: workflow.completed_at,
      };
    } catch (error) {
      workflow.status = 'FAILED';
      workflow.errors.push(error instanceof Error ? error.message : String(error));
      workflow.completed_at = new Date().toISOString();
      this.completedWorkflows.push(workflow);

      return {
        workflow_id: workflow.workflow_id,
        status: 'FAILED',
        commands_emitted: 0,
        events_emitted: 0,
        ledger_mutations: 0,
        errors: workflow.errors,
        started_at: workflow.started_at,
        completed_at: workflow.completed_at,
      };
    }
  }

  private async executeStep(step: ExecutionStep, intent: Intent): Promise<WorkflowResult> {
    const command = {
      command_id: `cmd_${step.step_id}`,
      command_type: step.command_type,
      actor: intent.actor,
      timestamp: new Date().toISOString(),
      intent_id: intent.intent_id,
      policy_context: JSON.stringify(intent.policy_context),
      payload: step.payload,
      authorization: step.domain === 'treasury' || step.domain === 'payment' ? 'LEDGER_MUTATION_AUTHORIZED' : 'READ_ONLY',
      hash: '',
      domain: step.domain as DomainType,
      correlation_id: intent.intent_id,
      causation_id: intent.intent_id,
    };

    const result = await this.coordinator.execute(command);
    return result;
  }

  getWorkflow(workflowId: string): RunningWorkflow | undefined {
    return this.workflows.get(workflowId);
  }

  getActiveWorkflows(): RunningWorkflow[] {
    return Array.from(this.workflows.values()).filter((w) => w.status === 'RUNNING');
  }

  getCompletedWorkflows(): RunningWorkflow[] {
    return [...this.completedWorkflows];
  }
}
