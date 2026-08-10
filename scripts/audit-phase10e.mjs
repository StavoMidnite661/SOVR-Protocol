import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const certificates = [
  'governance/releases/PHASE10D_LEDGER_COMPATIBILITY_CERTIFICATE.yaml',
  'governance/releases/PHASE10D_TIGERBEETLE_GENESIS_CERTIFICATE.yaml',
  'governance/releases/PHASE10D_REPLAY_CERTIFICATE.yaml',
  'governance/tigerbeetle/PHASE10E_GENESIS_WRITE_CERTIFICATE.yaml',
  'governance/tigerbeetle/TIGERBEETLE_POST_WRITE_CERTIFICATE.yaml',
];

const artifacts = [
  'packages/runtime/src/ledger/tigerbeetle/tigerbeetle-transport.ts',
  'packages/runtime/src/ledger/tigerbeetle/account-mapper.ts',
  'packages/runtime/src/ledger/tigerbeetle/transfer-mapper.ts',
  'packages/runtime/src/ledger/tigerbeetle/ledger-adapter.ts',
  'packages/runtime/src/ledger/tigerbeetle/shadow-ledger.ts',
  'packages/runtime/src/ledger/tigerbeetle/genesis-write-ceremony.ts',
  'governance/tigerbeetle/TIGERBEETLE_ENVIRONMENT_CERTIFICATE.yaml',
  'governance/tigerbeetle/SOVR_ACCOUNT_SCHEMA.yaml',
  'governance/tigerbeetle/REAL_WRITE_AUTHORIZATION.yaml',
  'governance/tigerbeetle/GENESIS_WRITE_MANIFEST.yaml',
  'governance/tigerbeetle/GENESIS_TRANSACTION_SET.json',
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

function checkWriteAuthorization() {
  const path = join(ROOT, 'governance/tigerbeetle/REAL_WRITE_AUTHORIZATION.yaml');
  const content = readFileSync(path, 'utf8');
  const enabledMatch = content.match(/enabled:\s*(true|false)/);
  const genesisOnlyMatch = content.match(/authorized_operation:\s*genesis_only/);
  return enabledMatch?.[1] === 'true' && !!genesisOnlyMatch;
}

console.log('Phase 10E TigerBeetle Genesis Audit');
console.log('===================================');

let allPass = true;
for (const cert of certificates) {
  const result = checkCertificate(cert);
  if (result.exists && result.status === 'PASS') {
    console.log(`PASS: ${cert}`);
  } else if (result.exists && result.status === 'PENDING_GENESIS_EXECUTION') {
    console.log(`PENDING: ${cert} (status=${result.status})`);
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

const writeAuthEnabled = checkWriteAuthorization();
console.log(`\nWrite Authorization: ${writeAuthEnabled ? 'ENABLED (GENESIS ONLY)' : 'DISABLED'}`);

const genesisCeremonyPath = join(ROOT, 'generated', 'audit', 'tigerbeetle-genesis-ceremony.json');
let genesisExecuted = false;
if (existsSync(genesisCeremonyPath)) {
  const ceremony = JSON.parse(readFileSync(genesisCeremonyPath, 'utf8'));
  genesisExecuted = ceremony.success === true;
  console.log(`Genesis Ceremony: ${genesisExecuted ? 'EXECUTED' : 'PENDING'}`);
}

const report = {
  phase: 'PHASE10E',
  timestamp: new Date().toISOString(),
  certificates_passed: allPass,
  writes_enabled: writeAuthEnabled,
  genesis_executed: genesisExecuted,
  status: allPass && writeAuthEnabled && genesisExecuted ? 'GENESIS_LEDGER_ACTIVATED' : 'PENDING_GENESIS_CEREMONY',
};

const outDir = join(ROOT, 'generated', 'audit');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'phase10e-audit-report.json'), JSON.stringify(report, null, 2) + '\n');

if (allPass && writeAuthEnabled && genesisExecuted) {
  console.log('\nPHASE10E_AUDIT_PASS — GENESIS LEDGER ACTIVATED');
  process.exit(0);
} else {
  console.log('\nPHASE10E_AUDIT_PENDING — GENESIS CEREMONY REQUIRED');
  process.exit(1);
}
