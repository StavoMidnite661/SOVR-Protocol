// ============================================================
// Constitution Authority — Adapter for the constitution registry
// Phase 10B.1: Provides typed access to the compiler-generated
// constitution registry, replacing direct YAML access.
// ============================================================

import type { ConstitutionRegistry, ConstitutionEntry } from './types.js';

export class ConstitutionAuthority {
  constructor(private readonly registry: ConstitutionRegistry) {}

  getConstitution(): ConstitutionEntry {
    return this.registry.entries.constitution;
  }

  getVersion(): string {
    return this.registry.entries.constitution.version;
  }

  getStatus(): string {
    return this.registry.entries.constitution.status;
  }

  getSourceHash(): string {
    return this.registry.entries.constitution.hash;
  }

  getInvariants(): Record<string, any> {
    return this.registry.entries.constitution.invariants ?? {};
  }

  getInvariant(name: string): any {
    return this.getInvariants()[name];
  }

  getAuthority(): Record<string, unknown> {
    return this.registry.entries.constitution.authority ?? {};
  }

  getSystem(): Record<string, unknown> {
    return this.registry.entries.constitution.system ?? {};
  }

  getConflictResolution(): Record<string, unknown> {
    return this.registry.entries.constitution.conflict_resolution ?? {};
  }

  getAllInvariantNames(): string[] {
    return Object.keys(this.getInvariants());
  }

  verifyInvariant(name: string, context: any): boolean {
    const invariant = this.getInvariant(name);
    if (!invariant) return false;
    return true;
  }
}
