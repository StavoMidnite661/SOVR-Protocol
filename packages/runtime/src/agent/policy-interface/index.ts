import type { PolicyEvaluationInput, PolicyEvaluationResult, AgentPermissions } from '../types.js';

export interface AgentPolicyInterfaceConfig {
  policy_gateway: {
    evaluate(input: { command_type: string; domain: string; actor: string; authorization: string; intent_id: string; payload: Record<string, unknown> }): { authorized: boolean; reason?: string; violation?: string };
  };
  require_policy_for_mutation: boolean;
}

export class AgentPolicyInterface {
  private readonly permissions: AgentPermissions;

  constructor(private config: AgentPolicyInterfaceConfig, permissions: AgentPermissions) {
    this.permissions = permissions;
  }

  evaluateMission(input: PolicyEvaluationInput): PolicyEvaluationResult {
    if (!input.mission_id || !input.intent_type || !input.actor) {
      return {
        approved: false,
        conditions: [],
        reason: 'Missing required policy input fields',
        violation: 'MISSING_POLICY_INPUT',
      };
    }

    if (input.risk_level === 'CRITICAL') {
      return {
        approved: false,
        conditions: ['requires_human_approval'],
        reason: 'Critical risk missions require human approval',
        violation: 'CRITICAL_RISK_REQUIRES_HUMAN_APPROVAL',
      };
    }

    const executePermission = this.permissions.execute_command;
    if (executePermission === 'DENIED') {
      return {
        approved: false,
        conditions: [],
        reason: 'Agent does not have execute_command permission',
        violation: 'EXECUTE_COMMAND_DENIED',
      };
    }

    if (executePermission === 'REQUIRES_POLICY') {
      const policyResult = this.config.policy_gateway.evaluate({
        command_type: input.intent_type,
        domain: 'agent',
        actor: input.actor,
        authorization: 'AGENT_POLICY_REVIEW',
        intent_id: input.mission_id,
        payload: { requested_actions: input.requested_actions, risk_level: input.risk_level },
      });

      if (!policyResult.authorized) {
        return {
          approved: false,
          conditions: [],
          reason: policyResult.reason || 'Policy gateway denied mission',
          violation: policyResult.violation || 'POLICY_GATEWAY_DENIED',
        };
      }

      return {
        approved: true,
        conditions: ['policy_gateway_approved'],
        authorization_token: `auth_${input.mission_id}_${Date.now()}`,
      };
    }

    return {
      approved: true,
      conditions: ['execute_command_allowed'],
      authorization_token: `auth_${input.mission_id}_${Date.now()}`,
    };
  }

  checkLedgerAccessPermission(): boolean {
    return this.permissions.ledger_access === 'ALLOWED';
  }

  checkGenesisAccessPermission(): boolean {
    return this.permissions.genesis_access === 'ALLOWED';
  }

  validateDirectLedgerAccess(agentId: string): { allowed: boolean; reason?: string } {
    if (this.permissions.ledger_access === 'ALLOWED') {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Agent ${agentId} does not have direct ledger access permission`,
    };
  }
}
