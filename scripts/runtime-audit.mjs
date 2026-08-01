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

// Scan the whole runtime source tree. Restricting this to three directories
// previously hid an orphaned capability literal in src/sdk (audit finding F-9).
const SCAN_DIRS = ['packages/runtime/src'];

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

// ── Registry cross-validation (advisory) ────────────────────────────────────────────────
// Hardcoded command/capability literals must resolve against the compiled
// registries. Drift here is invisible to the pattern scan above.
const drift = [];
const registryDir = 'packages/runtime/../../generated/registries';
try {
  const commands = JSON.parse(readFileSync(join(registryDir, 'commands.registry.json'), 'utf-8')).entries ?? {};
  const capabilities = JSON.parse(readFileSync(join(registryDir, 'capabilities.registry.json'), 'utf-8')).entries ?? {};
  for (const file of files) {
    // Tests and fixtures legitimately reference synthetic commands; only
    // production source must resolve against the compiled corpus.
    if (file.includes('__tests__') || file.includes('.test.')) continue;
    const content = readFileSync(file, 'utf-8');
    for (const m of content.matchAll(/commandName:\s*'([^']+)'/g)) {
      if (m[1].includes('*') || m[1].includes('${')) continue;
      if (!commands[m[1]]) {
        drift.push(`${file}: commandName "${m[1]}" is not in commands.registry.json`);
      }
    }
    for (const m of content.matchAll(/capability_id:\s*'([^']+)'/g)) {
      if (m[1].includes('*') || m[1].includes('${')) continue;
      if (!capabilities[m[1]]) {
        drift.push(`${file}: capability_id "${m[1]}" is not in capabilities.registry.json`);
      }
    }
  }
} catch (err) {
  console.error(`Registry cross-validation skipped: ${err.message}`);
}

// Registry drift is BLOCKING, not advisory (audit finding D8).
//
// The YAML corpus is authoritative for this protocol. A command or capability
// literal in runtime source that does not resolve against the compiled
// registries is a constitutional violation: it means the runtime is acting on
// a vocabulary the spec never granted. Treating that as a warning let a real
// bug ship — SovrLedgerDriver dispatched 'treasury.transfer.initiate', which
// kernel-executor rejects with UNKNOWN_COMMAND, so every private-ledger
// submission would have failed at runtime while the audit printed a warning
// and exited 0.
if (drift.length > 0) {
  console.error(`\nREGISTRY DRIFT — ${drift.length} literal(s) do not resolve against the compiled corpus:`);
  for (const d of drift) console.error(`  ❌ ${d}`);
  console.error('  The YAML corpus is authoritative: either define these in the spec');
  console.error('  and recompile, or remove them from the runtime.');
}

if (violations > 0 || drift.length > 0) {
  const parts = [];
  if (violations > 0) parts.push(`${violations} purity violation(s)`);
  if (drift.length > 0) parts.push(`${drift.length} registry drift literal(s)`);
  console.error(`\nRUNTIME AUDIT: FAIL — ${parts.join(', ')}`);
  process.exit(1);
}
console.log('RUNTIME AUDIT: PASS — 0 purity violations, 0 registry drift');
