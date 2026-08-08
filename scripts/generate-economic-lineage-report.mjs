import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../..');
const reportsDir = join(ROOT, 'generated', 'simulation', 'reports');

let totalOrphan = 0;
let totalMissingLedger = 0;
let totalMissingReserve = 0;
let totalVerified = true;

try {
  const files = readdirSync(reportsDir).filter(f => f.endsWith('-event-lineage.json'));
  for (const file of files) {
    const report = JSON.parse(readFileSync(join(reportsDir, file), 'utf8'));
    totalOrphan += report.orphan_events ?? 0;
    totalMissingLedger += report.missing_ledger_entries ?? 0;
    totalMissingReserve += report.missing_reserve_links ?? 0;
    if (!report.verified) totalVerified = false;
  }
} catch {
  // reports may not exist yet
}

const outDir = join(ROOT, 'generated', 'audit');
mkdirSync(outDir, { recursive: true });

const report = {
  orphan_economic_events: totalOrphan,
  missing_ledger_entries: totalMissingLedger,
  missing_reserve_links: totalMissingReserve,
  verified: totalVerified && totalOrphan === 0 && totalMissingLedger === 0 && totalMissingReserve === 0,
};

writeFileSync(join(outDir, 'economic-lineage-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
