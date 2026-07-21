// ============================================================
// SOVR Capability Engine — Scope Pattern Language
// vault.asset:{asset_id} | treasury.transfer:{actor_id}:* | ledger.entry:*:account_id={acct_id}
// Wildcard * support, Redis cache TTL 300s (in-memory mock), risk levels
// INV-003 Authority Boundary, INV-008 Gate 2+3
// ============================================================

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

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
  private cache = new Map<string, { result: boolean; expires: number }>();
  private cacheTtlMs = 300000; // 5 min as per spec

  constructor(private protocolRoot: string) {
    this.loadDefinitions();
    this.seedGovernanceGrants();
  }

  private loadDefinitions() {
    try {
      const file = path.join(this.protocolRoot, '08_security-capabilities.yaml');
      if (fs.existsSync(file)) {
        const doc: any = yaml.load(fs.readFileSync(file, 'utf8'));
        const caps = doc.capabilities || [];
        for (const c of caps) {
          if (c.capability_id) {
            this.definitions.set(c.capability_id, c);
          }
        }
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

  grant(cap: GrantedCapability) {
    if (!this.grants.has(cap.actor_id)) this.grants.set(cap.actor_id, []);
    this.grants.get(cap.actor_id)!.push(cap);
    this.cache.clear(); // invalidate on grant
  }

  revoke(actor_id: string, capability_id: string) {
    const list = this.grants.get(actor_id) || [];
    this.grants.set(actor_id, list.filter(g => g.capability_id !== capability_id));
    this.cache.clear();
  }

  // Scope pattern matching: {resource}:{id}:{field} with * wildcard
  private matchesScope(grantedPattern: string, requestedScope: string): boolean {
    if (!grantedPattern || grantedPattern === '*') return true;
    if (grantedPattern === requestedScope) return true;

    // wildcard support: vault.asset:* matches vault.asset:123
    // treasury.transfer:{actor_id}:* matches treasury.transfer:actor_123:*
    const regexStr = grantedPattern
      .replace(/\./g, '\\.')
      .replace(/\{[^}]+\}/g, '[^:]+') // {id} placeholder
      .replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexStr}$`);
    return regex.test(requestedScope);
  }

  // INV-004: agent cannot invent capabilities — enforced by grant path only via governance
  check(actor_id: string, capability_id: string, scope: string): boolean {
    const cacheKey = `${actor_id}:${capability_id}:${scope}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.result;

    // governance.* wildcard
    const actorGrants = this.grants.get(actor_id) || [];
    const govGrants = this.grants.get('governance') || [];
    const all = [...actorGrants, ...govGrants, ...(this.grants.get('*')||[])];

    // Special: system.internal allowed for system actor
    if (capability_id === 'system.internal' && (actor_id === 'system' || actor_id.startsWith('system'))) {
      this.cache.set(cacheKey, { result: true, expires: Date.now()+this.cacheTtlMs });
      return true;
    }

    // Allow any actor with explicit capability that matches scope
    for (const g of all) {
      // capability wildcard: governance.* matches governance.proposal.create
      const capMatches = g.capability_id === capability_id 
        || g.capability_id === '*' 
        || (g.capability_id.endsWith('.*') && capability_id.startsWith(g.capability_id.slice(0,-2)))
        || g.capability_id === 'governance.*' && actor_id === 'governance';

      if (capMatches && this.matchesScope(g.scope_pattern, scope)) {
        // check expiry
        if (g.expires_at && new Date(g.expires_at).getTime() < Date.now()) continue;
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
