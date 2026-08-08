import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MerkleRootService } from '../MerkleRootService.js';
import type { AuditProof } from './AuditReconstructor.js';
import { EvidenceCollector } from './EvidenceCollector.js';
import { TimelineBuilder } from './TimelineBuilder.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../');

export class ProofManifestGenerator {
  private merkleRootService = new MerkleRootService();

  generate(scenarioId: string, events: any[], commands: any[]): AuditProof {
    const collector = new EvidenceCollector();
    const timelineBuilder = new TimelineBuilder();

    const partial = collector.collect(scenarioId, events, commands);
    const merkleResult = this.merkleRootService.compute(events);

    const crypto = require('crypto');
    const deterministicHash = crypto
      .createHash('sha256')
      .update(events.map(e => `${e.event_name}:${e.aggregate_id}:${e.correlation_id}`).join('|'))
      .digest('hex');

    const projectionHashes = events
      .map(e => e.projection_effect?.target)
      .filter((t: any) => t && t !== 'none');
    const projectionHash = crypto
      .createHash('sha256')
      .update(JSON.stringify([...new Set(projectionHashes)]))
      .digest('hex');

    return {
      scenario_id: partial.scenario_id ?? scenarioId,
      build_hash: partial.build_hash ?? 'unknown',
      command_sequence: partial.command_sequence ?? [],
      event_sequence: partial.event_sequence ?? [],
      state_transitions: timelineBuilder.build(events),
      projection_hash: projectionHash,
      merkle_root: merkleResult.root_hash,
      deterministic_hash: deterministicHash,
    };
  }

  write(proof: AuditProof): void {
    const outDir = join(ROOT, 'generated', 'audit');
    try {
      mkdirSync(outDir, { recursive: true });
    } catch {
      // directory may already exist
    }
    const outPath = join(outDir, `${proof.scenario_id}-proof.json`);
    writeFileSync(outPath, JSON.stringify(proof, null, 2) + '\n');
  }
}
