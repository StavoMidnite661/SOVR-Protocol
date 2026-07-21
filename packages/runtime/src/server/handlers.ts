// ============================================================
// SOVR Handlers Registry — Maps 101 commands to domain logic
// For Source of CE, each handler produces audit + balance checks
// Real implementation would call domain aggregates (event-sourced)
// Here we use generic command->event mapping from catalog for MVP
// ============================================================

export const DOMAIN_ROUTES: Record<string, { description: string; commands: string[]; aggregates: string[] }> = {
  vault: {
    description: 'Value Authority — Can value exist?',
    aggregates: ['asset','reservation','collateral','custody_attestation','valuation','balance','reconciliation_record'],
    commands: [
      'vault.asset.register','vault.asset.verify','vault.asset.reject',
      'vault.reserve.create','vault.reserve.lock','vault.reserve.release','vault.reserve.expire',
      'vault.collateral.add','vault.collateral.remove','vault.collateral.revalue',
      'vault.asset.reconcile','vault.valuation.update',
      'vault.transaction.fund','vault.transaction.cancel','vault.transaction.authorize_release','vault.transaction.disburse',
      'vault.transfer.request','vault.ownership.transfer','vault.asset.write_down'
    ]
  },
  ledger: {
    description: 'Immutable Financial History — How is truth recorded?',
    aggregates: ['journal','journal_entry','posting','account','accounting_period','ledger_reconciliation'],
    commands: ['ledger.journal.create','ledger.entry.post','ledger.entry.reverse','ledger.entry.correct','ledger.reconciliation.start','ledger.reconciliation.resolve','ledger.account.create','ledger.account.freeze','ledger.period.close']
  },
  treasury: {
    description: 'Controlled Movement — Can value move?',
    aggregates: ['transfer_request','transfer_order','liquidity_position','settlement_instruction'],
    commands: ['treasury.transfer.request','treasury.transfer.authorize','treasury.transfer.reserve','treasury.transfer.execute','treasury.transfer.cancel','treasury.transfer.compensate','treasury.liquidity.check','treasury.liquidity.allocate','treasury.settlement.confirm']
  },
  identity: {
    description: 'Actor Identification — Who is acting?',
    aggregates: ['actor','credential','trust_anchor','delegation','session','authentication_context'],
    commands: ['identity.actor.register','identity.actor.verify','identity.actor.suspend','identity.actor.revoke','identity.actor.archive','identity.credential.issue','identity.credential.revoke','identity.session.create','identity.session.terminate','identity.delegation.create','identity.delegation.revoke','identity.trust_anchor.register']
  },
  policy: {
    description: 'Rule Evaluation — Is this permitted?',
    aggregates: ['policy_rule','policy_set','policy_evaluation','policy_escalation'],
    commands: ['policy.rule.create','policy.rule.update','policy.rule.activate','policy.rule.deactivate','policy.set.create','policy.set.evaluate','policy.escalation.resolve','policy.compliance.requirement.register']
  },
  intent: {
    description: 'Intention Translation — What does actor want?',
    aggregates: ['intent','enrichment_step','intent_validation','command_conversion'],
    commands: ['intent.submit','intent.enrich','intent.validate','intent.convert_to_command','intent.cancel','intent.archive','intent.multi_step.create','intent.multi_step.advance']
  },
  agent: {
    description: 'AI Operator — Can intelligence request action?',
    aggregates: ['agent_instance','agent_registration','capability_binding','agent_audit_envelope','execution_quota'],
    commands: ['agent.register','agent.activate','agent.terminate','agent.capability.bind','agent.capability.revoke','agent.quota.update','agent.governance.override','agent.execution.execute','agent.suspend']
  },
  payment: {
    description: 'Execution Boundary — Can execution leave system?',
    aggregates: ['payment_request','execution_plan'],
    commands: ['payment.request.create','payment.request.cancel','payment.execution.plan','payment.execution.execute','payment.execution.confirm','payment.execution.compensate','payment.reconciliation.start','payment.reconciliation.complete','payment.receipt.issue','payment.execution.prepare','payment.adapter.disable']
  },
  governance: {
    description: 'Constitutional Oversight — Who oversees system?',
    aggregates: ['governance_proposal','governance_amendment','governance_override','emergency_halt','audit_record','escalation'],
    commands: ['governance.proposal.submit','governance.proposal.approve','governance.proposal.reject','governance.amend.propose','governance.amend.ratify','governance.emergency.halt','governance.emergency.lift','governance.audit.query','governance.oversight.review','governance.capability.grant','governance.capability.revoke','governance.escalation.resolve','governance.policy_rule.review','governance.proposal.implement','governance.proposal.cancel']
  },
  saga: {
    description: 'Kernel Saga Orchestration',
    aggregates: ['saga_instance'],
    commands: ['saga.compensate']
  }
};

export function getRouteForCommand(commandName: string): { method: string; path: string; domain: string; aggregate: string } {
  const parts = commandName.split('.');
  const domain = parts[0];
  const aggregate = parts[1]; // simplified: first after domain is aggregate hint
  // Route pattern from compiler.yaml: /api/v1/{domain}/{aggregate}
  // Fastify route: /api/v1/vault/asset -> handles vault.asset.* commands, discriminator via payload commandName
  const routeDomain = domain;
  const routeAggregate = aggregate === 'proposal' ? 'governance_proposal' : aggregate;
  return {
    method: 'POST',
    path: `/api/v1/${routeDomain}/${routeAggregate}`,
    domain,
    aggregate: routeAggregate,
  };
}

export function buildOpenApiFromCommands() {
  const paths: Record<string, any> = {};
  const seen = new Map<string, { commands: string[]; caps: string[] }>();
  for (const [domain, info] of Object.entries(DOMAIN_ROUTES)) {
    for (const agg of info.aggregates) {
      const key = `/api/v1/${domain}/${agg}`;
      if (!seen.has(key)) seen.set(key, { commands: [], caps: [] });
    }
    // also aggregate-less grouping by first word after domain for command-centric view
    for (const cmd of info.commands) {
      const agg = cmd.split('.')[1];
      const key = `/api/v1/${domain}/${agg}`;
      if (seen.has(key)) {
        seen.get(key)!.commands.push(cmd);
      } else {
        seen.set(key, { commands: [cmd], caps: [] });
      }
    }
  }
  for (const [pathStr, info] of seen) {
    paths[pathStr] = {
      post: {
        summary: `Execute ${info.commands[0] || pathStr}`,
        description: `Source of CE — Commands: ${info.commands.join(', ')}`,
        operationId: info.commands[0]?.replace(/\./g,'_') || pathStr.replace(/\//g,'_'),
        tags: [pathStr.split('/')[3]],
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { commandName: { type: 'string' }, payload: { type: 'object' }, capability_id: { type: 'string' }, scope: { type: 'string' } } } } } },
        responses: {
          '200': { description: 'ACCEPTED — events emitted', content: { 'application/json': { schema: { type: 'object' } } } },
          '401': { description: 'UNAUTHENTICATED gate 1' },
          '403': { description: 'CAPABILITY/SCOPE/POLICY denied gates 2-4' },
          '422': { description: 'CONSTITUTIONAL violation gate 5 or validation' },
        },
        'x-constitutional-gates': { identity_required: true, capability_required: true, policy_required: true },
      }
    };
  }
  return paths;
}
