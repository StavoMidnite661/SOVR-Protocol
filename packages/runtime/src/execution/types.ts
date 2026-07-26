/**
 * SOVR Protocol — Directive XXIII Types
 *
 * Shared types for INV-003 and INV-008 enforcement.
 *
 * Constitutional layer: L3 — Runtime Invariant Enforcement
 *
 * These types are the contract between:
 *   - KernelExecutor (caller)
 *   - AuthorityBoundaryEnforcer (INV-003)
 *   - ExecutionGateEnforcer (INV-008)
 *   - GateEvaluators (gate logic)
 *   - EventStore (audit trail)
 */

// ─── Capability Grant ─────────────────────────────────────────────────────────

export type CapabilityGrant = {
  grantId:       string
  actorId:       string
  capability:    string
  scope:         string
  grantedBy:     string
  grantedAt:     number
  expiresAt?:    number
  revokedAt?:    number
  constraints?:  CapabilityConstraints
}

export type CapabilityConstraints = {
  maxAmount?:         string
  maxDailyAmount?:    string
  allowedDomains?:    string[]
  allowedTimeWindow?: TimeWindow
  allowedCountries?:  string[]
  requiresMFA?:       boolean
  customConstraints?: Record<string, unknown>
}

export type TimeWindow = {
  timezone:   string
  daysOfWeek: number[]
  startHour:  number
  endHour:    number
}

// ─── Authority Check ──────────────────────────────────────────────────────────

export type AuthorityCheckInput = {
  actorId:            string
  commandName:        string
  aggregateId:        string
  requiredCapability: string
  payload:            Record<string, unknown>
  correlationId:      string
  commandId:          string
}

export type AuthorityCheckResult = {
  granted:    boolean
  grantId?:   string
  reason?:    string
  violation?: AuthorityViolationType
}

export type AuthorityViolationType =
  | 'CAPABILITY_NOT_HELD'
  | 'CAPABILITY_EXPIRED'
  | 'CAPABILITY_REVOKED'
  | 'SCOPE_MISMATCH'
  | 'CONSTRAINT_AMOUNT_EXCEEDED'
  | 'CONSTRAINT_TIME_WINDOW'
  | 'CONSTRAINT_DOMAIN'
  | 'CONSTRAINT_MFA_REQUIRED'
  | 'SYSTEM_ACTOR_REQUIRED'

// ─── Execution Gates ──────────────────────────────────────────────────────────

export type GateDefinition = {
  gateId:       string
  type:         GateType
  config:       GateConfig
  description:  string
  fatal:        boolean
}

export type GateType =
  | 'BALANCE_SUFFICIENT'
  | 'STATE_PRECONDITION'
  | 'AUTHORIZATION_LIMIT'
  | 'TIME_WINDOW'
  | 'APPROVAL_QUORUM'
  | 'COMPLIANCE_HOLD_ABSENT'
  | 'KYC_VERIFIED'
  | 'ACCOUNT_ACTIVE'
  | 'DEPENDENCY_SATISFIED'
  | 'AMOUNT_WITHIN_LIMIT'

export type GateConfig =
  | BalanceGateConfig
  | StateGateConfig
  | AuthorizationLimitGateConfig
  | TimeWindowGateConfig
  | ApprovalQuorumGateConfig
  | ComplianceHoldGateConfig
  | KycGateConfig
  | AccountActiveGateConfig
  | DependencyGateConfig
  | AmountLimitGateConfig

export type BalanceGateConfig = {
  type:              'BALANCE_SUFFICIENT'
  accountPayloadKey: string
  amountPayloadKey:  string
  currency:          string
}

export type StateGateConfig = {
  type:             'STATE_PRECONDITION'
  requiredStates:   string[]
}

export type AuthorizationLimitGateConfig = {
  type:             'AUTHORIZATION_LIMIT'
  amountPayloadKey: string
  limitSource:      'actor_grant' | 'static'
  staticLimit?:     string
}

export type TimeWindowGateConfig = {
  type:      'TIME_WINDOW'
  window:    TimeWindow
}

export type ApprovalQuorumGateConfig = {
  type:      'APPROVAL_QUORUM'
  required:  number
  role:      string
}

export type ComplianceHoldGateConfig = {
  type:      'COMPLIANCE_HOLD_ABSENT'
  holdTypes: string[]
}

export type KycGateConfig = {
  type:       'KYC_VERIFIED'
  level:      'BASIC' | 'ENHANCED' | 'FULL'
}

export type AccountActiveGateConfig = {
  type:              'ACCOUNT_ACTIVE'
  accountPayloadKey: string
}

export type DependencyGateConfig = {
  type:             'DEPENDENCY_SATISFIED'
  dependsOnCommand: string
  aggregateIdKey:   string
}

export type AmountLimitGateConfig = {
  type:             'AMOUNT_WITHIN_LIMIT'
  amountPayloadKey: string
  maxAmount:        string
  currency:         string
}

// ─── Gate Check ───────────────────────────────────────────────────────────────

export type GateCheckInput = {
  commandName:   string
  commandId:     string
  correlationId: string
  aggregateId:   string
  actorId:       string
  payload:       Record<string, unknown>
  gates:         GateDefinition[]
}

export type GateCheckResult = {
  passed:       boolean
  failedGate?:  string
  failedType?:  GateType
  reason?:      string
  evaluated:    GateEvaluationRecord[]
}

export type GateEvaluationRecord = {
  gateId:    string
  gateType:  GateType
  passed:    boolean
  reason?:   string
  durationMs: number
}

// ─── Gate Evaluator Interface ─────────────────────────────────────────────────

export interface GateEvaluator {
  readonly type: GateType

  evaluate(
    aggregateId: string,
    actorId:     string,
    payload:     Record<string, unknown>,
    config:      GateConfig
  ): Promise<{ passed: boolean; reason?: string }>
}

// ─── Command Registration — Extended ─────────────────────────────────────────

export type CommandRegistration = {
  commandName:        string
  stateMachine:       string
  aggregateType:      string
  requiredCapability: string
  executionGates:     GateDefinition[]
  domain:             string
  layer:              number
}

// ─── Rejection Reasons ────────────────────────────────────────────────────────

export type RejectionReason =
  | 'AUTHORITY_BOUNDARY_VIOLATION'
  | 'EXECUTION_GATE_FAILED'
  | 'UNKNOWN_COMMAND'
  | 'INVALID_TRANSITION'
  | 'INVARIANT_VIOLATION'
  | 'UNKNOWN_GATE_TYPE'

// ─── Audit Event Payloads ──────────────────────────────────────────────────────

export type AuthorityViolationEventPayload = {
  commandName:        string
  commandId:          string
  actorId:            string
  aggregateId:        string
  requiredCapability: string
  violation:          AuthorityViolationType
  reason:             string
}

export type GateFailedEventPayload = {
  commandName:   string
  commandId:     string
  actorId:       string
  aggregateId:   string
  gateId:        string
  gateType:      GateType
  reason:        string
  evaluated:     GateEvaluationRecord[]
}
