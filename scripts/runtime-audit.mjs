import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = [
  { pattern: /switch\s*\(\s*command(?:Name)?\b/, label: 'switch on command' },
  { pattern: /switch\s*\(\s*domain\b/, label: 'switch on domain' },
  { pattern: /switch\s*\(\s*event(?:Name)?\b/, label: 'switch on event' },
  { pattern: /if\s*\(\s*(?:request\.|ctx\.)?command(?:Name)?\s*===\s*['"]/, label: 'if on commandName' },
  { pattern: /if\s*\(\s*(?:request\.|ctx\.)?domain\s*===\s*['"]/, label: 'if on domain' },
  { pattern: /case\s+['"]vault['"]/, label: 'hardcoded vault' },
  { pattern: /case\s+['"]ledger['"]/, label: 'hardcoded ledger' },
  { pattern: /case\s+['"]treasury['"]/, label: 'hardcoded treasury' },
  { pattern: /case\s+['"]payment['"]/, label: 'hardcoded payment' },
  { pattern: /case\s+['"]identity['"]/, label: 'hardcoded identity' },
  { pattern: /require\(['"].*sovr-ir\.json['"]\)/, label: 'runtime IR dependency' },
  { pattern: /import.*sovr-ir\.json/, label: 'runtime IR import' }
];

const SCAN_DIRS = [
  'packages/runtime/src/server',
  'packages/runtime/src/execution',
  'packages/runtime/src/adapters'
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

let violations = 0;
const files = SCAN_DIRS.flatMap(walk);
for (const file of files) {
  if (file.includes('.generated.') || file.includes('generated/')) continue;
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  for (const { pattern, label } of FORBIDDEN) {
    lines.forEach((line, i) => {
      if (pattern.test(line)) {
        console.error(`VIOLATION [${label}]: ${file}:${i + 1}\n  ${line.trim()}`);
        violations++;
      }
    });
  }
}

if (violations > 0) {
  console.error(`\nRUNTIME PURITY AUDIT: FAIL — ${violations} violation(s)`);
  process.exit(1);
}
console.log('RUNTIME PURITY AUDIT: PASS — 0 violations');
