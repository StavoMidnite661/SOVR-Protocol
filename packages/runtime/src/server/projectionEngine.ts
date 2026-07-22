// ============================================================
// Projection Engine — 15 Read Models Rebuilt From Genesis
// INV-006: Events describe reality, projections interpret reality
// If projection disagrees with event log, event log wins
// Full replay vs incremental, cache invalidation keys
// ============================================================

import { EventEnvelope } from './eventStore.js';

export interface Projection {
  name: string;
  description: string;
  sourceEvents: string[];
  state: Map<string, any>;
  lastCheckpoint?: string;
  buildFromGenesis: (events: EventEnvelope[]) => void;
  handleEvent: (event: EventEnvelope) => void;
}

function createVaultAssetView(): Projection {
  const state = new Map<string, any>();
  return {
    name: 'vault_asset_view',
    description: 'Asset holdings, states REGISTERED->VERIFIED->AVAILABLE->RESERVED->LOCKED',
    sourceEvents: ['vault.asset.registered','vault.asset.verified','vault.asset.rejected','vault.reserve.created','vault.reserve.locked','vault.reserve.released'],
    state,
    buildFromGenesis(events) {
      state.clear();
      for (const e of events) this.handleEvent(e);
    },
    handleEvent(event) {
      const id = event.aggregate_id;
      if (event.event_name === 'vault.asset.registered') {
        state.set(id, { ...event.payload, state: 'REGISTERED', registered_at: event.timestamp });
      } else if (event.event_name === 'vault.asset.verified') {
        const existing = state.get(id) || {};
        state.set(id, { ...existing, state: 'VERIFIED', verified_at: event.timestamp });
      } else if (event.event_name === 'vault.asset.rejected') {
        const existing = state.get(id) || {};
        state.set(id, { ...existing, state: 'REJECTED' });
      } else if (event.event_name.startsWith('vault.reserve.')) {
        // update balance view side effect
      }
    }
  };
}

function createBalanceView(): Projection {
  const state = new Map<string, { total: number; available: number; reserved: number; locked: number; asset_id: string }>();
  return {
    name: 'vault_balance_view',
    description: 'Computed balances total/available/reserved/locked/encumbered',
    sourceEvents: ['vault.reserve.created','vault.reserve.locked','vault.reserve.released','vault.reserve.expired','vault.asset.registered'],
    state,
    buildFromGenesis(events){ state.clear(); for(const e of events) this.handleEvent(e); },
    handleEvent(event) {
      const asset_id = event.payload.asset_id || event.aggregate_id;
      const key = `${event.actor_id || 'system'}:${asset_id}`;
      if (!state.has(key)) state.set(key, { total: 1000000, available: 1000000, reserved: 0, locked: 0, asset_id });
      const bal = state.get(key)!;
      const amount = Number(event.payload.amount || 0);
      if (event.event_name === 'vault.reserve.created') {
        bal.available -= amount; bal.reserved += amount;
      } else if (event.event_name === 'vault.reserve.locked') {
        bal.reserved -= amount; bal.locked += amount;
      } else if (event.event_name === 'vault.reserve.released' || event.event_name === 'vault.reserve.expired') {
        if (event.payload.release_reason?.includes('locked')) {
          bal.locked -= amount;
        } else {
          bal.reserved -= amount;
        }
        bal.available += amount;
      }
    }
  };
}

function createTransferOrderView(): Projection {
  const state = new Map<string, any>();
  return {
    name: 'transfer_order_view',
    description: 'Treasury transfer lifecycle REQUESTED->AUTHORIZED->RESERVED->EXECUTING->SETTLED',
    sourceEvents: ['treasury.transfer.requested','treasury.transfer.authorized','treasury.transfer.reserved','treasury.transfer.executing','treasury.transfer.settled','treasury.transfer.failed','treasury.transfer.rejected'],
    state,
    buildFromGenesis(e){ state.clear(); for(const ev of e) this.handleEvent(ev); },
    handleEvent(event) {
      const id = event.aggregate_id;
      if (event.event_name === 'treasury.transfer.requested') {
        state.set(id, { order_id: id, state: 'REQUESTED', ...event.payload, created_at: event.timestamp });
      } else {
        const existing = state.get(id) || { order_id: id };
        const newState = event.event_name.split('.').pop()?.toUpperCase() || 'UNKNOWN';
        // map
        const mapping: Record<string,string> = {
          AUTHORIZED: 'AUTHORIZED', RESERVED: 'RESERVED', EXECUTING: 'EXECUTING', SETTLED: 'SETTLED',
          FAILED: 'FAILED', REJECTED: 'REJECTED', EXPIRED: 'EXPIRED'
        };
        existing.state = mapping[newState] || newState;
        Object.assign(existing, event.payload);
        existing.updated_at = event.timestamp;
        state.set(id, existing);
      }
    }
  };
}

function createGenericView(name: string, description: string, sourceEvents: string[]): Projection {
  const state = new Map<string, any>();
  return {
    name,
    description,
    sourceEvents,
    state,
    buildFromGenesis(e){ state.clear(); for(const ev of e) this.handleEvent(ev); },
    handleEvent(event) {
      const id = event.aggregate_id;
      if (event.projection_effect.operation === 'insert') {
        state.set(id, { ...event.payload, _event: event.event_name, _ts: event.timestamp });
      } else if (event.projection_effect.operation === 'update') {
        const existing = state.get(id) || { id };
        state.set(id, { ...existing, ...event.payload, _updated: event.timestamp });
      } else if (event.projection_effect.operation === 'delete') {
        state.delete(id);
      }
    }
  };
}

export class ProjectionEngine {
  private projections: Map<string, Projection> = new Map();
  private cache = new Map<string, { data: any; expires: number }>();
  private ttlMs = 60000;

  constructor() {
    this.register();
  }

  private register() {
    // 15 read models per spec
    const list: Projection[] = [
      createVaultAssetView(),
      createBalanceView(),
      createTransferOrderView(),
      createGenericView('account_balance_view','Ledger account running balances',['ledger.entry.posted','ledger.entry.reversed','ledger.entry.corrected']),
      createGenericView('chart_of_accounts_view','Chart of accounts',['ledger.account.created','ledger.account.frozen','ledger.account.closed']),
      createGenericView('ledger_journal_view','Journals',['ledger.journal.created']),
      createGenericView('identity_actor_view','Identity actors',['identity.actor.registered','identity.actor.verified','identity.actor.suspended','identity.actor.revoked']),
      createGenericView('identity_session_view','Sessions',['identity.session.created','identity.session.expired','identity.session.terminated']),
      createGenericView('policy_rule_view','Policy rules',['policy.rule.created','policy.rule.activated','policy.rule.deactivated','policy.rule.updated']),
      createGenericView('policy_evaluation_view','Policy evaluations',['policy.evaluation.completed','policy.evaluation.denied']),
      createGenericView('intent_view','Intents',['intent.received','intent.enriching.started','intent.enriching.completed','intent.validated','intent.converted_to_command','intent.cancelled']),
      createGenericView('agent_instance_view','Agent instances',['agent.activated','agent.execution.started','agent.execution.completed','agent.terminated']),
      createGenericView('payment_status_view','Payment status',['payment.request.created','payment.execution.planned','payment.execution.started','payment.rail.prepared','payment.rail.executed','payment.rail.confirmed','payment.execution.completed','payment.reconciliation.completed','payment.receipt.issued']),
      createGenericView('governance_proposal_view','Governance proposals',['governance.proposal.submitted','governance.proposal.approved','governance.proposal.rejected','governance.proposal.implemented']),
      createGenericView('reconciliation_dashboard_view','Reconciliations',['ledger.reconciliation.started','ledger.reconciliation.mismatch_detected','ledger.reconciliation.completed','payment.reconciliation.started','payment.reconciliation.completed']),
    ];

    for (const p of list) this.projections.set(p.name, p);
    console.log(`👁️ Projection engine registered ${this.projections.size} read models`);
  }

  // INV-006: rebuild from genesis
  rebuildFromGenesis(allEvents: EventEnvelope[]) {
    console.log(`👁️ Rebuilding ${this.projections.size} projections from genesis (${allEvents.length} events)`);
    for (const proj of this.projections.values()) {
      proj.buildFromGenesis(allEvents);
    }
    this.cache.clear();
  }

  handleEvent(event: EventEnvelope) {
    // Dispatch ONLY to projections that explicitly subscribe to this event_name
    // OR whose projection_effect.target was set to the projection by the event
    // (this was previously a loose startsWith() match that caused events to leak
    // across projections — e.g. vault.reserve.* routed to vault_asset_view).
    for (const proj of this.projections.values()) {
      const subscribed = proj.sourceEvents.includes(event.event_name) || proj.sourceEvents.includes('*');
      const targeted = event.projection_effect?.target === proj.name;
      if (!subscribed && !targeted) continue;
      try {
        proj.handleEvent(event);
      } catch (e) {
        console.warn(`Projection ${proj.name} failed to handle ${event.event_name}:`, e);
      }
    }

    // Cache invalidation keys per envelope
    const keys = event.projection_effect?.invalidation_keys || [];
    for (const k of keys) this.cache.delete(k);
  }

  getProjection(name: string): Map<string, any> | undefined {
    return this.projections.get(name)?.state;
  }

  query(name: string, filter?: (v:any)=>boolean): any[] {
    const cacheKey = `${name}:${filter?.toString()||'all'}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.data;

    const proj = this.projections.get(name);
    if (!proj) return [];
    let values = Array.from(proj.state.values());
    if (filter) values = values.filter(filter);
    this.cache.set(cacheKey, { data: values, expires: Date.now()+this.ttlMs });
    return values;
  }

  listProjections() {
    return Array.from(this.projections.values()).map(p=>({ name: p.name, description: p.description, sourceEvents: p.sourceEvents, count: p.state.size }));
  }

  stats() {
    return {
      projections: this.projections.size,
      totalRecords: Array.from(this.projections.values()).reduce((acc, p)=> acc + p.state.size, 0),
      cacheSize: this.cache.size,
    };
  }
}
