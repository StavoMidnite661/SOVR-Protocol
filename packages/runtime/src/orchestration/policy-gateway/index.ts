import type { SOVRCommand, AuthorizationResult, PolicyContext, PolicyRule, PolicyGatewayConfig } from '../types.js';

export class PolicyGateway {
  private readonly policyRules: Map<string, PolicyRule> = new Map();

  constructor(private config: PolicyGatewayConfig) {
    for (const rule of config.mutation_authorization_policy.rules) {
      this.policyRules.set(rule.rule_id, rule);
    }
  }

  evaluate(command: SOVRCommand): AuthorizationResult {
    if (!this.config.enabled) {
      return { authorized: true, reason: 'Policy gateway disabled' };
    }

    const applicableRules = Array.from(this.policyRules.values()).filter(
      (rule) => rule.domain === command.domain || rule.domain === 'all'
    );

    for (const rule of applicableRules) {
      const passed = this.evaluateRule(rule, command);
      if (!passed) {
        if (rule.action === 'DENY') {
          return {
            authorized: false,
            reason: `Policy rule ${rule.rule_id} denied command ${command.command_type}`,
            violation: rule.rule_id,
          };
        }
        if (rule.action === 'ESCALATE') {
          return {
            authorized: false,
            reason: `Policy rule ${rule.rule_id} requires escalation`,
            violation: rule.rule_id,
          };
        }
      }
    }

    return { authorized: true, reason: 'All policy checks passed' };
  }

  private evaluateRule(rule: PolicyRule, command: SOVRCommand): boolean {
    if (rule.allowed_actors && rule.allowed_actors.length > 0) {
      if (!rule.allowed_actors.includes(command.actor)) {
        return false;
      }
    }

    if (rule.max_amount) {
      const amount = Number(command.payload.amount || command.payload.value || 0);
      const maxAmount = Number(rule.max_amount);
      if (amount > maxAmount) {
        return false;
      }
    }

    const condition = rule.condition;
    if (condition === 'command_exists') {
      return command.command_type.length > 0;
    }
    if (condition === 'actor_authorized') {
      return command.authorization.length > 0;
    }
    if (condition === 'intent_valid') {
      return command.intent_id.length > 0;
    }
    if (condition === 'domain_permitted') {
      return ['vault', 'treasury', 'payment', 'intent', 'agent'].includes(command.domain);
    }
    if (condition === 'audit_enabled') {
      return true;
    }

    return true;
  }

  addRule(rule: PolicyRule) {
    this.policyRules.set(rule.rule_id, rule);
  }

  removeRule(ruleId: string) {
    this.policyRules.delete(ruleId);
  }
}
