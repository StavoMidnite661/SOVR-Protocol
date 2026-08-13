// ============================================================
// Projection Engine — 16 Canonical Projections Rebuilt From Genesis
// INV-006: Events describe reality, projections interpret reality
// If projection disagrees with event log, event log wins
// Full replay vs incremental, cache invalidation keys
// ============================================================

import { EventEnvelope } from './eventStore.js';
import {
  createAccountSummary,
  createAgentActivity,
  createAuditTimeline,
  createComplianceReport,
  createEscrowAccountView,
  createGovernanceDashboard,
  createIdentityDirectory,
  createIntentQueue,
  createLiquidityPosition,
  createPaymentStatus,
  createPolicyDecisions,
  createPortfolio,
  createRiskDashboard,
  createSettlementSummary,
  createTreasuryDashboard,
  createVaultHoldings,
} from '../projections/index.js';
import { createGenericEventProjection } from '../projections/generic-event-projection.js';
import projectionsRegistry from '../../../../generated/registries/projections.registry.json' with { type: 'json' };

export interface Projection {
  name: string;
  description: string;
  sourceEvents: string[];
  state: Map<string, any>;
  lastCheckpoint?: string;
  buildFromGenesis: (events: EventEnvelope[]) => void;
  handleEvent: (event: EventEnvelope) => void;
}

export class ProjectionEngine {
  private projections: Map<string, Projection> = new Map();
  private cache = new Map<string, { data: any; expires: number }>();
  private ttlMs = 60000;

  constructor() {
    this.register();
  }

  private register() {
    const list: Projection[] = [
      createAccountSummary(),
      createAgentActivity(),
      createAuditTimeline(),
      createComplianceReport(),
      createEscrowAccountView(),
      createGovernanceDashboard(),
      createIdentityDirectory(),
      createIntentQueue(),
      createLiquidityPosition(),
      createPaymentStatus(),
      createPolicyDecisions(),
      createPortfolio(),
      createRiskDashboard(),
      createSettlementSummary(),
      createTreasuryDashboard(),
      createVaultHoldings(),
    ];

    for (const p of list) this.projections.set(p.name, p);

    // Registry-driven tail: every remaining compiled projection definition
    // (including the 41 derived from event projection_effect contracts) is
    // materialized by the generic interpreter. Hand-written models keep
    // precedence; nothing is registered from outside the compiled registry.
    const compiled = Object.values((projectionsRegistry as any).entries ?? {}) as any[];
    for (const entry of compiled) {
      const name = entry?.name;
      if (!name || this.projections.has(name)) continue;
      this.projections.set(name, createGenericEventProjection(entry));
    }

    console.log(`👁️ Projection engine registered ${this.projections.size} read models`);
  }

  /** Number of registered read models — derived, never hardcoded (D6). */
  count(): number {
    return this.projections.size;
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
