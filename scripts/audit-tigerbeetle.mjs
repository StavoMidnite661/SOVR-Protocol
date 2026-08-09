import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const certificates = [
  'governance/releases/PHASE10D_LEDGER_COMPATIBILITY_CERTIFICATE.yaml',
  'governance/releases/PHASE10D_TIGERBEETLE_GENESIS_CERTIFICATE.yaml',
  'governance/releases/PHASE10D_REPLAY_CERTIFICATE.yaml',
];

const artifacts = [
  'packages/runtime/src/ledger/tigerbeetle/tigerbeetle-client.ts',
  'packages/runtime/src/ledger/tigerbeetle/account-mapper.ts',
  'packages/runtime/src/ledger/tigerbeetle/transfer-mapper.ts',
  'packages/runtime/src/ledger/tigerbeetle/ledger-adapter.ts',
  'packages/runtime/src/ledger/tigerbeetle/shadow-ledger.ts',
  'governance/tigerbeetle/TIGERBEETLE_ENVIRONMENT_CERTIFICATE.yaml',
  'governance/tigerbeetle/SOVR_ACCOUNT_SCHEMA.yaml',
  'governance/tigerbeetle/REAL_WRITE_AUTHORIZATION.yaml',
];

function checkCertificate(path) {
  const fullPath = join(ROOT, path);
  if (!existsSync(fullPath)) {
    return { exists: false, status: 'MISSING' };
  }
  const content = readFileSync(fullPath, 'utf8');
  const statusMatch = content.match(/status:\s*(.+)/);
  return { exists: true, status: statusMatch ? statusMatch[1].trim() : 'UNKNOWN' };
}

function checkArtifact(path) {
  const fullPath = join(ROOT, path);
  return existsSync(fullPath);
}

console.log('Phase 10D TigerBeetle Audit');
console.log('===========================');

let allPass = true;
for (const cert of certificates) {
  const result = checkCertificate(cert);
  if (result.exists && result.status === 'PASS') {
    console.log(`PASS: ${cert}`);
  } else {
    console.log(`FAIL: ${cert} (exists=${result.exists}, status=${result.status})`);
    allPass = false;
  }
}

for (const artifact of artifacts) {
  if (checkArtifact(artifact)) {
    console.log(`PRESENT: ${artifact}`);
  } else {
    console.log(`MISSING: ${artifact}`);
    allPass = false;
  }
}

const writeAuthPath = join(ROOT, 'governance/tigerbeetle/REAL_WRITE_AUTHORIZATION.yaml');
const writeAuthContent = readFileSync(writeAuthPath, 'utf8');
const writesEnabled = writeAuthContent.includes('enabled: true') && !writeAuthContent.includes('enabled: false');
console.log(`\nWrite Authorization: ${writesEnabled ? 'ENABLED' : 'DISABLED'}`);

const report = {
  phase: 'PHASE10D',
  timestamp: new Date().toISOString(),
  certificates_passed: allPass,
  writes_enabled: writesEnabled,
  status: allPass && !writesEnabled ? 'READY_FOR_PHASE10E' : 'PENDING_CERTIFICATION',
};

const outDir = join(ROOT, 'generated', 'audit');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'phase10d-audit-report.json'), JSON.stringify(report, null, 2) + '\n');

if (allPass && !writesEnabled) {
  console.log('\nPHASE10D_AUDIT_PASS');
  process.exit(0);
} else {
  console.log('\nPHASE10D_AUDIT_FAIL');
  process.exit(1);
}
