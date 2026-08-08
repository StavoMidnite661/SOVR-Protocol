// ============================================================
// SOVR Financial OS — Registry Integrity Validator
// Phase 10B.1: Verifies compiler-generated authority artifacts
// have not been silently modified since compilation.
// ============================================================

import { createHash } from 'node:crypto';

export interface IntegrityBlock {
  algorithm: 'SHA256';
  hash: string;
  generated_by: { compiler_version: string };
  timestamp: string;
}

export class AuthorityRegistryIntegrityError extends Error {
  constructor(readonly artifact: string, readonly actual: string, readonly expected: string) {
    super(`AUTHORITY_ARTIFACT_INTEGRITY_FAILURE: ${artifact}\n  expected: ${expected}\n  actual:   ${actual}`);
    this.name = 'AuthorityRegistryIntegrityError';
  }
}

export interface IntegrityVerifyResult {
  verified: boolean;
  artifact: string;
  expected: string;
  actual: string;
}

function sortKeys(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: any = {};
    const keys = Object.keys(value).sort();
    for (const k of keys) {
      sorted[k] = sortKeys(value[k]);
    }
    return sorted;
  }
  return value;
}

export function canonicalizeJson(obj: any): string {
  return JSON.stringify(sortKeys(obj), null, 2).replace(/\r\n/g, '\n');
}

export class IntegrityValidator {
  verify(registry: any, artifact: string): IntegrityVerifyResult {
    const integrity = registry?.integrity;
    if (!integrity || !integrity.hash) {
      return {
        verified: false,
        artifact,
        expected: 'missing',
        actual: 'missing',
      };
    }

    const hashPayload: any = { ...registry };
    delete hashPayload.integrity;
    const canonical = canonicalizeJson(hashPayload);
    const actual = createHash('sha256').update(canonical).digest('hex');

    if (actual !== integrity.hash) {
      return {
        verified: false,
        artifact,
        expected: integrity.hash,
        actual,
      };
    }

    return {
      verified: true,
      artifact,
      expected: integrity.hash,
      actual,
    };
  }

  assert(registry: any, artifact: string): void {
    const integrity = registry?.integrity;
    if (!integrity || !integrity.hash) {
      return;
    }
    const result = this.verify(registry, artifact);
    if (!result.verified) {
      throw new AuthorityRegistryIntegrityError(result.artifact, result.actual, result.expected);
    }
  }
}
