export type AgentPermission =
  | 'read'
  | 'analyze'
  | 'create_intent'
  | 'create_command'
  | 'execute_command'
  | 'ledger_access'
  | 'genesis_access';

export type PermissionDecision = 'ALLOWED' | 'DENIED' | 'REQUIRES_POLICY';

export type MissionStatus =
  | 'CREATED'
  | 'VALIDATING'
  | 'PLANNING'
  | 'EXECUTING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'AUDITED';

export type IntentStatus = 'PENDING' | 'VALIDATED' | 'REJECTED' | 'EXECUTED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AgentPermissions {
  read: PermissionDecision;
  analyze: PermissionDecision;
  create_intent: PermissionDecision;
  create_command: PermissionDecision;
  execute_command: PermissionDecision;
  ledger_access: PermissionDecision;
  genesis_access: PermissionDecision;
}

export interface AgentMemoryEntry {
  memory_event_id: string;
  timestamp: string;
  mission_id: string;
  event_hash: string;
  previous_hash: string;
  action: string;
  reasoning_summary: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'REJECTED';
  metadata: Record<string, unknown>;
}

export interface AgentActionEvent {
  event_id: string;
  agent_id: string;
  mission_id: string;
  action: string;
  reasoning_summary: string;
  command_generated?: string;
  timestamp: string;
  hash: string;
  previous_hash: string;
  policy_decision?: string;
}

export interface Mission {
  mission_id: string;
  intent_id: string;
  agent_id: string;
  status: MissionStatus;
  steps: MissionStep[];
  policy_context: Record<string, unknown>;
  created_at: string;
  completed_at?: string;
  failed_at?: string;
  audited_at?: string;
  errors: string[];
}

export interface MissionStep {
  step_id: string;
  command_type: string;
  domain: 'vault' | 'treasury' | 'payment' | 'intent' | 'agent';
  payload: Record<string, unknown>;
  depends_on: string[];
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  result?: Record<string, unknown>;
}

export interface AgentIntent {
  intent_id: string;
  actor: string;
  objective: string;
  constraints: Record<string, unknown>;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: string;
  status: IntentStatus;
  validated?: boolean;
  mission_required?: boolean;
  execution_plan?: string;
  classified_type?: string;
  risk_level?: RiskLevel;
}

export interface ExecutionPlan {
  plan_id: string;
  intent_id: string;
  steps: ExecutionStep[];
  estimated_duration_ms: number;
  requires_approval: boolean;
  max_retries: number;
  deterministic_hash: string;
}

export interface ExecutionStep {
  step_id: string;
  command_type: string;
  domain: 'vault' | 'treasury' | 'payment' | 'intent' | 'agent';
  payload: Record<string, unknown>;
  depends_on: string[];
  timeout_ms: number;
  policy_check_required: boolean;
}

export interface PolicyEvaluationInput {
  mission_id: string;
  intent_type: string;
  actor: string;
  requested_actions: string[];
  risk_level: RiskLevel;
}

export interface PolicyEvaluationResult {
  approved: boolean;
  conditions: string[];
  authorization_token?: string;
  reason?: string;
  violation?: string;
}

export interface MissionRuntimeResult {
  mission_id: string;
  status: MissionStatus;
  steps_completed: number;
  steps_total: number;
  commands_emitted: number;
  events_emitted: number;
  ledger_mutations: number;
  errors: string[];
  started_at: string;
  completed_at?: string;
}
