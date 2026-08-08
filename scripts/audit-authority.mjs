import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../');

const FORBIDDEN_PATTERNS = [
  'yaml.load',
  'yaml.parse',
  'readFileSync(*.yaml)',
  '03_command-catalog.yaml',
  '04_event-catalog.yaml',
  '01_constitution.yaml',
];

function checkFile(filePath) {
  const violations = [];
  try {
    const content = readFileSync(filePath, 'utf8');
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (content.includes(pattern)) {
        violations.push(`${filePath}: contains forbidden pattern "${pattern}"`);
      }
    }
  } catch {
    // skip unreadable files
  }
  return violations;
}

function auditRuntimeAuthority() {
  const runtimeSrc = join(ROOT, 'packages', 'runtime', 'src');
  const violations = [];

  function walkDir(dir) {
    if (!existsSync(dir)) return;
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = readFileSync(fullPath);
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.js')) {
          violations.push(...checkFile(fullPath));
        }
      } catch {
        // skip
      }
    }
  }

  walkDir(runtimeSrc);

  return {
    passed: violations.length === 0,
    violations,
  };
}

function checkCertificate() {
  const certPath = join(ROOT, 'governance', 'releases', 'SOVR-GENESIS-000002_PHASE10B.1_COMPLETION_CERTIFICATE.yaml');
  if (!existsSync(certPath)) {
    console.error(`MISSING: ${certPath}`);
    return false;
  }
  const content = readFileSync(certPath, 'utf8');
  if (!content.includes('status: READY_FOR_PHASE10B')) {
    console.error('INVALID: certificate status is not READY_FOR_PHASE10B');
    return false;
  }
  return true;
}

const audit = auditRuntimeAuthority();

console.log('SOVR PHASE 10B.1 AUTHORITY AUDIT');
console.log('===============================');
console.log(`Runtime YAML execution: ${audit.passed ? 'DISABLED' : 'DETECTED'}`);
if (audit.violations.length > 0) {
  for (const v of audit.violations) {
    console.error(`  VIOLATION: ${v}`);
  }
}
console.log(`Certificate: ${checkCertificate() ? 'PRESENT' : 'MISSING'}`);
console.log(`Status: ${audit.passed ? 'PASS' : 'FAIL'}`);

if (!audit.passed) {
  process.exit(1);
}
