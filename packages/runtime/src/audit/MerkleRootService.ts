import type { EventEnvelope } from '../server/eventStore.js';

export interface MerkleRootResult {
  event_count: number;
  root_hash: string;
  generated_at: string;
  algorithm: 'SHA-256';
}

export class MerkleRootService {
  private algorithm = 'SHA-256' as const;

  compute(events: EventEnvelope[]): MerkleRootResult {
    const generatedAt = new Date().toISOString();
    const eventCount = events.length;

    if (eventCount === 0) {
      return {
        event_count: 0,
        root_hash: this.hashEmpty(),
        generated_at: generatedAt,
        algorithm: this.algorithm,
      };
    }

    const leaves = events.map((env) =>
      this.hashLeaf(JSON.stringify(env, (k, v) => (k === 'payload' && v !== null && typeof v === 'object' ? this.sortedStringify(v) : v)))
    );

    const root = this.buildMerkleTree(leaves);

    return {
      event_count: eventCount,
      root_hash: root,
      generated_at: generatedAt,
      algorithm: this.algorithm,
    };
  }

  private hashEmpty(): string {
    const empty = this.hashLeaf('');
    return this.hashConcat(empty, empty);
  }

  private hashLeaf(data: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private hashConcat(left: string, right: string): string {
    const crypto = require('crypto');
    const sorted = [left, right].sort();
    return crypto.createHash('sha256').update(sorted.join('')).digest('hex');
  }

  private buildMerkleTree(leaves: string[]): string {
    if (leaves.length === 1) return leaves[0];

    const next: string[] = [];
    for (let i = 0; i < leaves.length; i += 2) {
      const left = leaves[i];
      const right = i + 1 < leaves.length ? leaves[i + 1] : left;
      next.push(this.hashConcat(left, right));
    }

    return this.buildMerkleTree(next);
  }

  private sortedStringify(obj: Record<string, unknown>): string {
    const keys = Object.keys(obj).sort();
    const sorted: Record<string, unknown> = {};
    for (const key of keys) {
      const value = (obj as Record<string, unknown>)[key];
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        sorted[key] = JSON.parse(this.sortedStringify(value as Record<string, unknown>));
      } else {
        sorted[key] = value;
      }
    }
    return JSON.stringify(sorted);
  }
}
