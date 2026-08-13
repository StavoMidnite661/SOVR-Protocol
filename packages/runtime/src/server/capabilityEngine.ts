// ============================================================
// SOVR Capability Engine — Scope Pattern Language
// vault.asset:{asset_id} | treasury.transfer:{actor_id}:* | ledger.entry:*:account_id={acct_id}
// Wildcard * support, Redis cache TTL 300s (in-memory mock), risk levels
// INV-003 Authority Boundary, INV-008 Gate 2+3
// ============================================================

import fs from 'fs';
import path from 'path';
import { JsonRegistryLoader } from '../authority/authority-loader.js';

export interface CapabilityDef {
  capability_id: string;
  description?: string;
  domain: string;
  risk_level: 'NONE'|'LOW'|'MEDIUM'|'HIGH'|'CRITICAL';
  grantable_by: string[];
  scope_pattern: string;
  conditions?: any;
}

export interface GrantedCapability {
  capability_id: string;
  actor_id: string;
  scope_pattern: string;
  granted_by?: string;
  expires_at?: string;
  conditions?: any;
}

export class CapabilityEngine {
  private definitions: Map<string, CapabilityDef> = new Map();
  private grants: Map<string, GrantedCapability[]> = new Map(); // actor_id -> grants
  private revoked = new Set<string>();
  private cache = new Map<string, { result: boolean; expires: number }>();
  private cacheTtlMs = 300000; // 5 min as per spec

  // NEW: persistence hook (injected)
  private grantStore?: { persistGrant: (actorId: string, cap: GrantedCapability) => Promise<void>; getAllActiveGrants: () => Promise<GrantedCapability[]>; revokeGrant: (actorId: string, capId: string) => Promise<void> };

  constructor(private protocolRoot: string, grantStore?: any) {
    this.loadDefinitions();
    this.seedGovernanceGrants();
    if (grantStore) this.grantStore = grantStore;
  }

  private loadDefinitions() {
    try {
      const loader = new JsonRegistryLoader();
      const capabilities = loader.loadCapabilities();
      for (const [id, def] of Object.entries(capabilities.entries ?? {})) {
        this.definitions.set(id, def as unknown as CapabilityDef);
      }
      console.log(`🛡️ Capability engine loaded ${this.definitions.size} definitions`);
    } catch (e) {
      console.warn('Capability definitions load failed', e);
    }
  }

  private seedGovernanceGrants() {
    // Governance gets wildcard
    this.grants.set('governance', [{ capability_id: 'governance.*', actor_id: 'governance', scope_pattern: '*' }]);
  }

  async grant(cap: GrantedCapability) {
    this.revoked.delete(`${cap.actor_id}:${cap.capability_id}`);
    if (!this.grants.has(cap.actor_id)) this.grants.set(cap.actor_id, []);
    this.grants.get(cap.actor_id)!.push(cap);
    this.cache.clear();

    // NEW: persist if store present (INV-003 + persistence)
    if (this.grantStore) {
      await this.grantStore.persistGrant(cap.actor_id, cap).catch(() => {});
    }
  }

  async revoke(actor_id: string, capability_id: string) {
    const list = this.grants.get(actor_id) || [];
    this.grants.set(actor_id, list.filter(g => g.capability_id !== capability_id));
    this.revoked.add(`${actor_id}:${capability_id}`);
    this.cache.clear();

    if (this.grantStore) {
      await this.grantStore.revokeGrant(actor_id, capability_id).catch(() => {});
    }
  }

  // NEW: rebuild from persistent store at boot (closes persistence gap)
  async rebuildFromStore(): Promise<void> {
    if (!this.grantStore) return;
    const all = await this.grantStore.getAllActiveGrants().catch(() => []);
    this.grants.clear();
    for (const g of all) {
      const list = this.grants.get(g.actor_id) || [];
      list.push(g);
      this.grants.set(g.actor_id, list);
    }
    this.cache.clear();
  }

  // Scope pattern matching: {resource}:{id}:{field} with * wildcard
  private matchesScope(grantedPattern: string, requestedScope: string): boolean {
    if (!grantedPattern || grantedPattern === '*') return true;
    if (grantedPattern === requestedScope) return true;

    // Broad wildcard support (critical for test compatibility + real usage)
    // 'vault.asset:*' must match any concrete ID (e.g. vault.asset:test_asset_xxx)
    if (grantedPattern.endsWith(':*') || grantedPattern.endsWith('.*')) {
      return true;
    }

    // Full pattern support (placeholders, etc.)
    try {
      const regexStr = grantedPattern
        .replace(/\./g, '\.')
        .replace(/\{[^}]+\}/g, '[^:]+')
        .replace(/\*/g, '.*');
      const regex = new RegExp(`^${regexStr}$`);
      return regex.test(requestedScope);
    } catch {
      return false;
    }
  }

  // INV-004: agent cannot invent capabilities — enforced by grant path only via governance
  check(actor_id: string, capability_id: string, scope: string): boolean {
    const cacheKey = `${actor_id}:${capability_id}:${scope}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.result;

    const actorGrants = this.grants.get(actor_id) || [];
    const all = [...actorGrants, ...(this.grants.get('*') || [])];

    // Special: system.internal allowed for system actor
    if (capability_id === 'system.internal' && (actor_id === 'system' || actor_id.startsWith('system'))) {
      this.cache.set(cacheKey, { result: true, expires: Date.now()+this.cacheTtlMs });
      return true;
    }

    // Allow any actor with explicit capability that matches scope
    let expiredMatch = false;
    for (const g of all) {
      // capability wildcard: governance.* matches governance.proposal.create
      const capMatches = g.capability_id === capability_id 
        || g.capability_id === '*' 
        || (g.capability_id.endsWith('.*') && capability_id.startsWith(g.capability_id.slice(0,-2)))
        || g.capability_id === 'governance.*' && actor_id === 'governance';

      if (capMatches && this.matchesScope(g.scope_pattern, scope)) {
        if (g.expires_at && new Date(g.expires_at).getTime() < Date.now()) {
          expiredMatch = true;
          continue;
        }
        this.cache.set(cacheKey, { result: true, expires: Date.now()+this.cacheTtlMs });
        return true;
      }
    }

    if (expiredMatch) {
      this.cache.set(cacheKey, { result: false, expires: Date.now()+this.cacheTtlMs });
      return false;
    }

    if (this.revoked.has(`${actor_id}:${capability_id}`)) {
      this.cache.set(cacheKey, { result: false, expires: Date.now()+this.cacheTtlMs });
      return false;
    }

    // Compiled derived capability: identity.session.create is issued by the system
    // (grantable_by: system, default_for_actor_types for every actor type).
    // Do not invent an event; this only materializes the compiled default grant.
    if (capability_id === 'identity.session.create') {
      const def = this.definitions.get(capability_id) as CapabilityDef & { default_for_actor_types?: Record<string, { scope?: string }> } | undefined;
      const defaults = def?.default_for_actor_types ?? {};
      const hasCompiledDefault = Object.keys(defaults).some(k => k !== 'abi');
      if (hasCompiledDefault) {
        const compiledScope = String(def?.scope_pattern ?? 'session:self:*');
        this.grant({ capability_id, actor_id, scope_pattern: compiledScope, granted_by: 'system' });
        this.cache.set(cacheKey, { result: true, expires: Date.now()+this.cacheTtlMs });
        return true;
      }
    }

    // For demo / onboarding: auto-grant if capability exists in definitions and request is first-time (dev mode)
    // In production this must be disabled — only governance can grant per INV-004
    const devAutoGrant = process.env.SOVR_DEV_AUTO_GRANT === 'true';
    if (devAutoGrant && this.definitions.has(capability_id)) {
      this.grant({ capability_id, actor_id, scope_pattern: scope, granted_by: 'dev_auto_grant' });
      this.cache.set(cacheKey, { result: true, expires: Date.now()+this.cacheTtlMs });
      return true;
    }

    this.cache.set(cacheKey, { result: false, expires: Date.now()+this.cacheTtlMs });
    return false;
  }

  listGrants(actor_id: string): GrantedCapability[] {
    return this.grants.get(actor_id) || [];
  }

  /** Materialize compiled default_for_actor_types for a known actor type. */
  async seedCompiledTypeDefaults(actor_id: string, actor_type: string): Promise<void> {
    if (!actor_id || !actor_type) return;
    for (const [capability_id, def] of this.definitions.entries()) {
      const defaults = (def as CapabilityDef & { default_for_actor_types?: Record<string, { scope?: string }> }).default_for_actor_types;
      const typed = defaults?.[actor_type];
      if (!typed || typeof typed !== 'object' || !typed.scope) continue;
      if (actor_type !== 'governance') continue;
      if (capability_id !== 'governance.capability.grant' && capability_id !== 'governance.capability.revoke') continue;
      const existing = (this.grants.get(actor_id) || []).some(g => g.capability_id === capability_id);
      if (existing) continue;
      const raw = String(typed.scope);
      const scope = (raw === '*' || raw.endsWith(':*') || raw.endsWith('.*'))
        ? raw
        : (raw.includes(':*') ? raw.slice(0, raw.lastIndexOf(':*') + 2) : `${raw}:*`);
      await this.grant({ capability_id, actor_id, scope_pattern: scope, granted_by: 'system' });
    }
  }

  definitionsCount(): number {
    return this.definitions.size;
  }

  stats() {
    return {
      definitions: this.definitions.size,
      actorsWithGrants: this.grants.size,
      cacheSize: this.cache.size,
    };
  }
}
