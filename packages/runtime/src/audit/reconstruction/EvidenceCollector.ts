import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AuditProof } from './AuditReconstructor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../');

export class EvidenceCollector {
  collect(scenarioId: string, events: any[], commands: any[]): Partial<AuditProof> {
    const buildManifestPath = join(ROOT, 'generated', 'compiler-manifest.yaml');
    let buildHash = 'unknown';
    try {
      const manifest = readFileSync(buildManifestPath, 'utf8');
      const match = manifest.match(/build_hash:\s*([a-f0-9]+)/);
      if (match) buildHash = match[1];
    } catch {
      // manifest may not exist in all contexts
    }

    return {
      scenario_id: scenarioId,
      build_hash: buildHash,
      command_sequence: commands,
      event_sequence: events.map(e => ({
        event_id: e.event_id,
        event_name: e.event_name,
        aggregate_id: e.aggregate_id,
        command_id: e.command_id,
        timestamp: e.timestamp,
      })),
    };
  }
}
