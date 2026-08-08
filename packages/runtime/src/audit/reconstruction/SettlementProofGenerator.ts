import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MerkleRootService } from '../MerkleRootService.js';
import type { AuditProof } from './AuditReconstructor.js';
import { EvidenceCollector } from './EvidenceCollector.js';
import { TimelineBuilder } from './TimelineBuilder.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../');

export interface SettlementProof extends AuditProof {
  settlement_id: string;
  commands: any[];
  events: any[];
  ledger_entries: any[];
  reserve_changes: any[];
}

export class SettlementProofGenerator {
  private merkleRootService = new MerkleRootService();

  generate(scenarioId: string, events: any[], commands: any[]): SettlementProof {
    const collector = new EvidenceCollector();
    const timelineBuilder = new TimelineBuilder();

    const partial = collector.collect(scenarioId, events, commands);
    const merkleResult = this.merkleRootService.compute(events);

    const crypto = require('crypto');
    const deterministicHash = crypto
      .createHash('sha256')
      .update(events.map(e => `${e.event_name}:${e.aggregate_id}:${e.correlation_id}`).join('|'))
      .digest('hex');

    const ledgerEntries = events.filter(e => e.event_name === 'ledger.entry.posted').map(e => ({
      event_id: e.event_id,
      transaction_id: e.payload?.transaction_id,
      postings: e.payload?.postings ?? [],
    }));

    const reserveChanges = events.filter(e =>
      e.event_name === 'treasury.transfer.reserved' || e.event_name === 'treasury.transfer.settled'
    ).map(e => ({
      event_id: e.event_id,
      amount: e.payload?.amount,
      order_id: e.payload?.order_id,
    }));

    const settlementId = events.find(e => e.event_name === 'treasury.settlement.confirmed')?.payload?.settlement_id ?? 'unknown';

    return {
      scenario_id: partial.scenario_id ?? scenarioId,
      settlement_id: settlementId,
      build_hash: partial.build_hash ?? 'unknown',
      command_sequence: partial.command_sequence ?? [],
      event_sequence: partial.event_sequence ?? [],
      ledger_entries: ledgerEntries,
      reserve_changes: reserveChanges,
      state_transitions: timelineBuilder.build(events),
      projection_hash: crypto.createHash('sha256').update(JSON.stringify([...new Set(events.map(e => e.projection_effect?.target).filter((t: any) => t && t !== 'none'))])).digest('hex'),
      merkle_root: merkleResult.root_hash,
      deterministic_hash: deterministicHash,
    };
  }

  write(proof: SettlementProof): void {
    const outDir = join(ROOT, 'generated', 'audit', 'settlements');
    try {
      mkdirSync(outDir, { recursive: true });
    } catch {
      // directory may already exist
    }
    const outPath = join(outDir, `SETTLEMENT-${proof.scenario_id.replace(/[^A-Z0-9]/g, '')}-PROOF.json`);
    writeFileSync(outPath, JSON.stringify(proof, null, 2) + '\n');
  }
}
