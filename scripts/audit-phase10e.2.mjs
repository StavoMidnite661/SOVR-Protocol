import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

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
  'governance/tigerbeetle/GENESIS_OPERATOR_AUTHORIZATION.yaml',
];

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

function checkGenesisAuthorization() {
  const path = join(ROOT, 'governance/tigerbeetle/GENESIS_OPERATOR_AUTHORIZATION.yaml');
  if (!existsSync(path)) return false;
  const content = readFileSync(path, 'utf8');
  return content.includes('operation: genesis_only') && content.includes('approved: true');
}

console.log('Phase 10E.2 TigerBeetle Genesis Ceremony Final Readiness Audit');
console.log('=============================================================');

let allPass = true;
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

const genesisAuth = checkGenesisAuthorization();
console.log(`Genesis Operator Authorization: ${genesisAuth ? 'PRESENT' : 'MISSING'}`);

const attestationPath = join(ROOT, 'generated/audit/tigerbeetle-genesis-runtime-attestation.json');
const attestationPresent = existsSync(attestationPath);
console.log(`Runtime Attestation: ${attestationPresent ? 'PRESENT' : 'MISSING'}`);

const readinessReportPath = join(ROOT, 'generated/audit/phase10e.2-readiness-report.json');
const readinessPresent = existsSync(readinessReportPath);
console.log(`Readiness Report: ${readinessPresent ? 'PRESENT' : 'MISSING'}`);

const report = {
  phase: 'PHASE10E.2',
  timestamp: new Date().toISOString(),
  artifacts_present: allPass,
  write_authorization_enabled: writeAuthEnabled,
  genesis_authorization_present: genesisAuth,
  runtime_attestation_present: attestationPresent,
  readiness_report_present: readinessPresent,
  status: allPass && writeAuthEnabled && genesisAuth && attestationPresent && readinessPresent ? 'PHASE10E.2_PASS' : 'PHASE10E.2_PENDING',
};

const outDir = join(ROOT, 'generated', 'audit');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'phase10e.2-audit-report.json'), JSON.stringify(report, null, 2) + '\n');

if (allPass && writeAuthEnabled && genesisAuth && attestationPresent && readinessPresent) {
  console.log('\nPHASE10E.2_AUDIT_PASS — READY FOR GENESIS CEREMONY');
  process.exit(0);
} else {
  console.log('\nPHASE10E.2_AUDIT_PENDING — READINESS CHECKS REQUIRED');
  process.exit(1);
}
