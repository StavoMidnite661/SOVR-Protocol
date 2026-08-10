import type { SOVRCommand, DomainType, AuthorizationResult, CommandRoute, CommandRouterConfig } from '../types.js';

export class CommandRouter {
  private readonly routes: Map<string, CommandRoute> = new Map();
  private readonly auditLog: Array<{ command: SOVRCommand; route: CommandRoute; timestamp: string }> = [];

  constructor(private config: CommandRouterConfig) {
    for (const route of config.routes) {
      this.routes.set(route.command_type, route);
    }
  }

  route(command: SOVRCommand): { route: CommandRoute; authorization: AuthorizationResult } {
    const route = this.routes.get(command.command_type) || {
      command_type: command.command_type,
      domain: 'vault' as DomainType,
      handler: this.config.default_handler,
      required_capability: 'system.internal',
      policy_gate_required: true,
      ledger_mutation_allowed: false,
    };

    const authorization = this.evaluateAuthorization(command, route);

    if (this.config.audit_enabled) {
      this.auditLog.push({
        command,
        route,
        timestamp: new Date().toISOString(),
      });
    }

    return { route, authorization };
  }

  private evaluateAuthorization(command: SOVRCommand, route: CommandRoute): AuthorizationResult {
    if (!command.authorization || command.authorization.length === 0) {
      return { authorized: false, reason: 'Missing authorization', violation: 'MISSING_AUTHORIZATION' };
    }

    if (route.ledger_mutation_allowed && command.authorization !== 'LEDGER_MUTATION_AUTHORIZED') {
      return { authorized: false, reason: 'Ledger mutation requires explicit authorization', violation: 'UNAUTHORIZED_LEDGER_MUTATION' };
    }

    if (!route.ledger_mutation_allowed && command.authorization === 'LEDGER_MUTATION_AUTHORIZED') {
      return { authorized: false, reason: 'Command does not permit ledger mutation', violation: 'EXCESSIVE_AUTHORIZATION' };
    }

    return { authorized: true, reason: 'Authorized', grant_id: `grant_${command.command_id}` };
  }

  getAuditLog() {
    return [...this.auditLog];
  }

  clearAuditLog() {
    this.auditLog.length = 0;
  }
}
