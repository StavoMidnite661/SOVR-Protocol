export type SagaState = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'COMPENSATING' | 'COMPENSATED';

export interface StepRecord {
  step: number;
  stepId: string;
  name: string;
  command?: string | null;
  state: 'COMPLETED' | 'FAILED' | 'COMPENSATED' | 'SKIPPED';
  events: any[];
  error?: string;
}

export interface SagaInstance {
  sagaId: string;
  sagaName: string;
  correlationId: string;
  currentStep: number;
  currentState: SagaState;
  completedSteps: StepRecord[];
  failedSteps: StepRecord[];
  compensationSteps: StepRecord[];
  context: any;
  startedAt: string;
  updatedAt: string;
}

export class SagaRegistry {
  private instances = new Map<string, SagaInstance>();

  create(instance: SagaInstance): SagaInstance {
    this.instances.set(instance.sagaId, instance);
    return instance;
  }

  get(sagaId: string): SagaInstance | undefined {
    return this.instances.get(sagaId);
  }

  update(sagaId: string, patch: Partial<SagaInstance>): SagaInstance {
    const current = this.instances.get(sagaId);
    if (!current) throw new Error(`SAGA_NOT_FOUND: ${sagaId}`);
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.instances.set(sagaId, next);
    return next;
  }

  list(): SagaInstance[] {
    return [...this.instances.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }
}
