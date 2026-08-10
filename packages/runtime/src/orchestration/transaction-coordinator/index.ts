import type { SOVRCommand, SOVREvent, WorkflowResult, LedgerMutation, AuditRecord, TransactionCoordinatorConfig } from '../types.js';

export interface TransactionContext {
  command: SOVRCommand;
  route: { command_type: string; domain: string; handler: string; required_capability: string; policy_gate_required: boolean; ledger_mutation_allowed: boolean };
  authorization: { authorized: boolean; reason?: string; violation?: string; grant_id?: string };
  policyResult: { authorized: boolean; reason?: string; violation?: string };
  events: SOVREvent[];
  mutations: LedgerMutation[];
  auditRecord?: AuditRecord;
}

export class TransactionCoordinator {
  private readonly transactionLog: TransactionContext[] = [];
  private eventStore: {
    dispatch(event: { event_type: string; command_id: string; payload: Record<string, unknown> }): { event_id: string; status: string };
    getAllEvents(): Array<{ event_id: string; event_type: string; command_id: string; previous_hash: string; event_hash: string; timestamp: string; payload: Record<string, unknown>; source_domain: string; aggregate_id: string; schema_version: string }>;
    getEventCount(): number;
    validateChain(): { valid: boolean; broken_links: string[] };
  };

  constructor(private config: TransactionCoordinatorConfig) {
    this.eventStore = config.event_dispatcher as any;
  }

  async execute(command: SOVRCommand): Promise<WorkflowResult> {
    const startedAt = new Date().toISOString();
    const errors: string[] = [];
    const events: SOVREvent[] = [];
    const mutations: LedgerMutation[] = [];

    try {
      const { route, authorization } = this.config.command_router.route(command as any);

      if (!authorization.authorized) {
        const rejectionEvent = this.createEvent(command, 'CommandRejected', {
          reason: authorization.reason,
          violation: authorization.violation,
        });
        events.push(rejectionEvent);
        this.eventStore.dispatch(rejectionEvent);

        this.recordAudit(command, events, mutations, 'FAILURE', [authorization.violation || 'UNAUTHORIZED']);

        return {
          workflow_id: `wf_${command.command_id}`,
          status: 'FAILED',
          commands_emitted: 0,
          events_emitted: events.length,
          ledger_mutations: 0,
          errors: [authorization.reason || 'Authorization failed'],
          started_at: startedAt,
          completed_at: new Date().toISOString(),
        };
      }

      const policyResult = this.config.policy_gateway.evaluate(command);

      if (!policyResult.authorized) {
        const rejectionEvent = this.createEvent(command, 'PolicyRejected', {
          reason: policyResult.reason,
          violation: policyResult.violation,
        });
        events.push(rejectionEvent);
        this.eventStore.dispatch(rejectionEvent);

        this.recordAudit(command, events, mutations, 'REJECTED', [policyResult.violation || 'POLICY_VIOLATION']);

        return {
          workflow_id: `wf_${command.command_id}`,
          status: 'FAILED',
          commands_emitted: 0,
          events_emitted: events.length,
          ledger_mutations: 0,
          errors: [policyResult.reason || 'Policy check failed'],
          started_at: startedAt,
          completed_at: new Date().toISOString(),
        };
      }

      const domainEvent = this.mapCommandToEvent(command);
      events.push(domainEvent);
      this.eventStore.dispatch(domainEvent);

      if (route.ledger_mutation_allowed && command.authorization === 'LEDGER_MUTATION_AUTHORIZED') {
        const mutation = this.createLedgerMutation(command);
        mutations.push(mutation);
      }

      const txContext: TransactionContext = {
        command,
        route,
        authorization,
        policyResult,
        events,
        mutations,
      };
      this.transactionLog.push(txContext);

      if (this.config.audit_enabled) {
        this.recordAudit(command, events, mutations, 'SUCCESS', ['INV-001', 'INV-002', 'INV-005']);
      }

      return {
        workflow_id: `wf_${command.command_id}`,
        status: 'COMPLETED',
        commands_emitted: 1,
        events_emitted: events.length,
        ledger_mutations: mutations.length,
        errors: [],
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));

      return {
        workflow_id: `wf_${command.command_id}`,
        status: 'FAILED',
        commands_emitted: 0,
        events_emitted: events.length,
        ledger_mutations: mutations.length,
        errors,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      };
    }
  }

  private createEvent(command: SOVRCommand, eventType: string, extraPayload: Record<string, unknown>): SOVREvent {
    const allEvents = this.eventStore.getAllEvents();
    const previousHash = allEvents.length > 0 ? allEvents[allEvents.length - 1].event_hash : '0'.repeat(64);

    const eventPayload = {
      ...command.payload,
      command_type: command.command_type,
      actor: command.actor,
      ...extraPayload,
    };

    const eventHash = this.computeHash({
      event_id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      event_type: eventType,
      command_id: command.command_id,
      previous_hash: previousHash,
      timestamp: new Date().toISOString(),
      payload: eventPayload,
    });

    return {
      event_id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      event_type: eventType,
      command_id: command.command_id,
      previous_hash: previousHash,
      event_hash: eventHash,
      timestamp: new Date().toISOString(),
      payload: eventPayload,
      ledger_reference: String(command.command_id),
      source_domain: command.domain,
      aggregate_id: String(command.payload.aggregate_id || command.intent_id),
      schema_version: '1.0.0',
    };
  }

  private mapCommandToEvent(command: SOVRCommand): SOVREvent {
    const eventTypeMap: Record<string, string> = {
      'CREATE_VAULT_INTENT': 'VaultIntentCreated',
      'OPEN_VAULT': 'VaultCreated',
      'LOCK_VAULT': 'VaultLocked',
      'RELEASE_VAULT': 'VaultReleased',
      'CREATE_ALLOCATION_REQUEST': 'TreasuryIntentCreated',
      'APPROVE_ALLOCATION': 'TreasuryApproved',
      'EXECUTE_ALLOCATION': 'TreasuryAllocationExecuted',
      'VERIFY_BALANCE': 'TreasuryBalanceVerified',
      'CREATE_PAYMENT_INTENT': 'PaymentIntentCreated',
      'AUTHORIZE_PAYMENT': 'PaymentAuthorized',
      'EXECUTE_INTERNAL_SETTLEMENT': 'PaymentSettled',
      'VERIFY_PAYMENT_STATE': 'PaymentStateVerified',
    };

    const eventType = eventTypeMap[command.command_type] || 'UnknownCommandExecuted';
    return this.createEvent(command, eventType, {});
  }

  private createLedgerMutation(command: SOVRCommand): LedgerMutation {
    const amount = command.payload.amount || command.payload.value || '0';
    const direction = command.payload.direction || 'CREDIT';

    return {
      mutation_id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      account_id: String(command.payload.account_id || command.payload.aggregate_id || 'unknown'),
      direction: direction as 'DEBIT' | 'CREDIT',
      amount: String(amount),
      currency: String(command.payload.currency || 'USD'),
      journal_entry_id: `je_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  private recordAudit(command: SOVRCommand, events: SOVREvent[], mutations: LedgerMutation[], result: 'SUCCESS' | 'FAILURE' | 'REJECTED', rules: string[]) {
    const record: AuditRecord = {
      record_id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      command_id: command.command_id,
      event_ids: events.map((e) => e.event_id),
      actor: command.actor,
      timestamp: new Date().toISOString(),
      action: command.command_type,
      result,
      constitutional_rules: rules,
      ledger_mutations: mutations,
    };

    if (this.config.audit_enabled) {
      console.log(`[Audit] ${record.record_id}: ${command.command_type} = ${result}`);
    }
  }

  private computeHash(data: Record<string, unknown>): string {
    const str = JSON.stringify(data);
    let hash = 0n;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 131n + BigInt(str.charCodeAt(i))) & 0xFFFFFFFFFFFFFFFFn;
    }
    return hash.toString(16).padStart(64, '0').slice(0, 64);
  }

  getTransactionLog() {
    return [...this.transactionLog];
  }

  verifyReplay(): { valid: boolean; totalTransactions: number; errors: string[] } {
    const errors: string[] = [];
    let valid = true;

    for (const tx of this.transactionLog) {
      if (tx.events.length === 0 && tx.command.command_type !== 'system.command.unknown') {
        errors.push(`Transaction ${tx.command.command_id} has no events but is not an unknown command`);
        valid = false;
      }
    }

    return { valid, totalTransactions: this.transactionLog.length, errors };
  }
}
