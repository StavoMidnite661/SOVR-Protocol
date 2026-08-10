export type DomainType = 'vault' | 'treasury' | 'payment' | 'intent' | 'agent';

export type IntentType =
  | 'CREATE_VAULT_INTENT'
  | 'OPEN_VAULT'
  | 'LOCK_VAULT'
  | 'RELEASE_VAULT'
  | 'CREATE_ALLOCATION_REQUEST'
  | 'APPROVE_ALLOCATION'
  | 'EXECUTE_ALLOCATION'
  | 'VERIFY_BALANCE'
  | 'CREATE_PAYMENT_INTENT'
  | 'AUTHORIZE_PAYMENT'
  | 'EXECUTE_INTERNAL_SETTLEMENT'
  | 'VERIFY_PAYMENT_STATE';

export type CommandStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
export type EventStatus = 'CREATED' | 'DISPATCHED' | 'PROCESSED' | 'REPLAYED';
export type WorkflowStatus = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'COMPENSATING';

export interface SOVRCommand {
  command_id: string;
  command_type: string;
  actor: string;
  timestamp: string;
  intent_id: string;
  policy_context: string;
  payload: Record<string, unknown>;
  authorization: string;
  hash: string;
  domain: DomainType;
  correlation_id?: string;
  causation_id?: string;
}

export interface SOVREvent {
  event_id: string;
  event_type: string;
  command_id: string;
  previous_hash: string;
  event_hash: string;
  timestamp: string;
  payload: Record<string, unknown>;
  ledger_reference: string;
  source_domain: DomainType;
  aggregate_id: string;
  schema_version: string;
}

export interface Intent {
  intent_id: string;
  intent_type: IntentType;
  actor: string;
  timestamp: string;
  payload: Record<string, unknown>;
  policy_context: Record<string, unknown>;
  status: 'PENDING' | 'VALIDATED' | 'REJECTED' | 'EXECUTED';
  execution_plan?: ExecutionPlan;
}

export interface ExecutionPlan {
  plan_id: string;
  intent_id: string;
  steps: ExecutionStep[];
  estimated_duration_ms: number;
  requires_approval: boolean;
  max_retries: number;
}

export interface ExecutionStep {
  step_id: string;
  command_type: string;
  domain: DomainType;
  payload: Record<string, unknown>;
  depends_on: string[];
  timeout_ms: number;
}

export interface PolicyContext {
  policy_id: string;
  rules: PolicyRule[];
  version: string;
  effective_at: string;
}

export interface PolicyRule {
  rule_id: string;
  condition: string;
  action: 'ALLOW' | 'DENY' | 'ESCALATE';
  domain: DomainType | 'all';
  max_amount?: string;
  allowed_actors?: string[];
}

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
  violation?: string;
  grant_id?: string;
}

export interface AuditRecord {
  record_id: string;
  command_id: string;
  event_ids: string[];
  actor: string;
  timestamp: string;
  action: string;
  result: 'SUCCESS' | 'FAILURE' | 'REJECTED';
  constitutional_rules: string[];
  ledger_mutations: LedgerMutation[];
}

export interface LedgerMutation {
  mutation_id: string;
  account_id: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: string;
  currency: string;
  journal_entry_id: string;
  transfer_id?: number;
}

export interface WorkflowResult {
  workflow_id: string;
  status: WorkflowStatus;
  commands_emitted: number;
  events_emitted: number;
  ledger_mutations: number;
  errors: string[];
  started_at: string;
  completed_at?: string;
}

export interface CommandRoute {
  command_type: string;
  domain: DomainType;
  handler: string;
  required_capability: string;
  policy_gate_required: boolean;
  ledger_mutation_allowed: boolean;
}

export interface CommandRouterConfig {
  routes: CommandRoute[];
  default_handler: string;
  audit_enabled: boolean;
}

export interface PolicyGatewayConfig {
  enabled: boolean;
  mutation_authorization_policy: PolicyContext;
  strict_mode: boolean;
}

export interface TransactionCoordinatorConfig {
  event_dispatcher: {
    dispatch(event: { event_type: string; command_id: string; payload: Record<string, unknown> }): { event_id: string; status: string };
    getAllEvents(): Array<{ event_id: string; event_type: string; command_id: string; previous_hash: string; event_hash: string; timestamp: string; payload: Record<string, unknown>; source_domain: string; aggregate_id: string; schema_version: string }>;
    getEventCount(): number;
    validateChain(): { valid: boolean; broken_links: string[] };
  };
  policy_gateway: {
    evaluate(command: { command_type: string; domain: string; actor: string; authorization: string; intent_id: string; payload: Record<string, unknown> }): { authorized: boolean; reason?: string; violation?: string };
  };
  command_router: {
    route(command: { command_type: string; domain: string; actor: string; authorization: string }): { route: CommandRoute; authorization: { authorized: boolean; reason?: string; violation?: string; grant_id?: string } };
  };
  audit_enabled: boolean;
  replay_verification: boolean;
}

export interface WorkflowEngineConfig {
  max_concurrent_workflows: number;
  default_step_timeout_ms: number;
  max_retries: number;
}
