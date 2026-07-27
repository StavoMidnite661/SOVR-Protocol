#!/usr/bin/env node
/**
 * certify-production.mjs
 *
 * Production certification gate. This script FAILS when the repository does
 * not meet the bar — it does not rubber-stamp.
 *
 * Written in response to the 2026-07-27 independent audit, which found
 * certification artifacts asserting "green" status against evidence files
 * that did not exist on disk (finding F-7). Every check below reads real
 * bytes and reports what it actually observed.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
let failures = 0;
let warnings = 0;

function pass(label, detail = '') {
  console.log(`  \u2705 ${label}${detail ? ` ${detail}` : ''}`);
}
function fail(label, detail = '') {
  console.error(`  \u274c ${label}${detail ? ` ${detail}` : ''}`);
  failures++;
}
function warn(label, detail = '') {
  console.warn(`  \u26a0\ufe0f  ${label}${detail ? ` ${detail}` : ''}`);
  warnings++;
}
function check(cond, label, detail = '') {
  cond ? pass(label, detail) : fail(label, detail);
  return cond;
}

console.log('\nSOVR Protocol \u2014 Production Certification');
console.log('\u2501'.repeat(46));

// ── 1. Registry integrity ────────────────────────────────────────────────────
console.log('\nRegistry integrity:');
const regDir = join(ROOT, 'generated', 'registries');
const manifestPath = join(regDir, 'registry.manifest.json');

if (!existsSync(manifestPath)) {
  fail('registry.manifest.json exists');
} else {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  let mismatches = 0;
  for (const [name, meta] of Object.entries(manifest.registries ?? {})) {
    const p = join(regDir, name);
    if (!existsSync(p)) {
      fail(`${name} present`);
      mismatches++;
      continue;
    }
    const buf = readFileSync(p);
    const hash = createHash('sha256').update(buf).digest('hex');
    const parsed = JSON.parse(buf.toString('utf8'));
    const count = Number(parsed.entry_count ?? Object.keys(parsed.entries ?? {}).length);
    if (hash !== meta.sha256 || count !== meta.entry_count) mismatches++;
  }
  check(mismatches === 0, 'all registries match manifest (hash + entry count)',
    mismatches === 0 ? '' : `(${mismatches} mismatch)`);
}

// ── 2. Build reproducibility ─────────────────────────────────────────────────
console.log('\nBuild provenance:');
const compilerManifestPath = join(ROOT, 'generated', 'compiler-manifest.yaml');
if (!existsSync(compilerManifestPath)) {
  fail('compiler-manifest.yaml exists');
} else {
  const m = JSON.parse(readFileSync(compilerManifestPath, 'utf8'));
  check(/^[0-9a-f]{64}$/.test(m.build_hash ?? ''), 'build_hash is a valid sha256',
    `(${(m.build_hash ?? '').slice(0, 12)}\u2026)`);
  check((m.stats?.errors ?? 0) === 0, 'compiler reports 0 errors',
    `(warnings=${m.stats?.warnings ?? 0})`);

  // Path separators must be POSIX or the hash is platform-dependent (F-3).
  const winPaths = Object.keys(m.input_hashes ?? {}).filter((k) => k.includes('\\'));
  check(winPaths.length === 0, 'input paths are platform-neutral',
    winPaths.length ? `(${winPaths.length} contain backslashes)` : '');

  const attestationPath = join(ROOT, 'generated', 'boot-attestation.json');
  if (existsSync(attestationPath)) {
    const a = JSON.parse(readFileSync(attestationPath, 'utf8'));
    check(a.build_hash === m.build_hash, 'boot attestation matches build hash');
  } else {
    warn('boot-attestation.json not present');
  }
}

// ── 3. Formal models ─────────────────────────────────────────────────────────
console.log('\nFormal verification artifacts:');
const tlaDir = join(ROOT, 'generated', 'verification', 'tla');
if (!existsSync(tlaDir)) {
  warn('no TLA+ directory');
} else {
  const tla = readdirSync(tlaDir).filter((f) => f.endsWith('.tla'));
  const cfg = readdirSync(tlaDir).filter((f) => f.endsWith('.cfg'));
  check(tla.length > 0, 'TLA+ models generated', `(${tla.length})`);
  check(cfg.length === tla.length, 'every model has a TLC config',
    `(${cfg.length}/${tla.length})`);

  let syntaxDefects = 0;
  let vacuous = 0;
  for (const f of tla) {
    const content = readFileSync(join(tlaDir, f), 'utf8');
    for (const line of content.split('\n')) {
      const t = line.trim();
      if (t.startsWith('* ')) syntaxDefects++;
      if (/^\d+\s*==/.test(t)) syntaxDefects++;
    }
    // An invariant over a variable never assigned outside UNCHANGED is a
    // tautology and proves nothing.
    if (/ledger_balanced = TRUE/.test(content) &&
        !/ledger_balanced' = (?!.*UNCHANGED)/.test(content)) vacuous++;
  }
  check(syntaxDefects === 0, 'models are syntactically valid TLA+',
    syntaxDefects ? `(${syntaxDefects} defects)` : '');
  check(vacuous === 0, 'no vacuous (frozen-variable) invariants',
    vacuous ? `(${vacuous} models)` : '');

  if (!existsSync(join(ROOT, 'tla2tools.jar')) && !process.env.TLC_JAR) {
    warn('TLC not available \u2014 models generated but not model-checked');
  }
}

// ── 4. Security posture ──────────────────────────────────────────────────────
console.log('\nSecurity posture:');
const composeFiles = ['deployment/docker-compose.dev.yml',
  'deployment/docker-compose.yml',
  'deployment/docker-compose.production.yml'].filter((f) => existsSync(join(ROOT, f)));

let hardcoded = 0;
for (const f of composeFiles) {
  const content = readFileSync(join(ROOT, f), 'utf8');
  for (const rawLine of content.split('\n')) {
    if (/^\s*#/.test(rawLine)) continue;

    // Blank out every ${...} substitution FIRST, so a ':?' or ':-' inside a
    // placeholder cannot be mistaken for the key/value separator.
    const masked = rawLine.replace(/\$\{[^}]*\}/g, '\u0000');

    const m = masked.match(/(?:PASSWORD|SECRET|TOKEN|_KEY)[A-Z_]*\s*[:=]\s*(.+)$/i);
    if (!m) continue;

    const residue = m[1].replace(/\u0000/g, '').trim();
    // What remains after removing substitutions must contain no credential
    // literal. URL scaffolding (scheme, host, port, db name) is not a secret.
    const meaningful = residue
      .replace(/^[@:\/]+|[@:\/]+$/g, '')
      .replace(/\b(postgres|redis|kafka|https?|localhost|sovr[a-z_]*|\d+)\b/gi, '')
      .replace(/[^A-Za-z0-9_]/g, '');

    // A ':-' default on a secret variable bakes in a credential.
    const secretDefault = /\$\{[A-Z_]*(?:PASSWORD|SECRET|TOKEN|_KEY)[A-Z_]*:-[^}]+\}/i.test(rawLine);

    if (meaningful.length > 0 || secretDefault) {
      console.error(`     ${f}: ${rawLine.trim().slice(0, 90)}`);
      hardcoded++;
    }
  }
}
check(hardcoded === 0, 'no hardcoded secrets in compose files',
  hardcoded ? `(${hardcoded} found)` : `(${composeFiles.length} files scanned)`);

const serverIndex = join(ROOT, 'packages/runtime/src/server/index.ts');
if (existsSync(serverIndex)) {
  const content = readFileSync(serverIndex, 'utf8');
  check(!/origin:\s*['"]\*['"]/.test(content), 'CORS is not wildcard');
}

// ── 5. Documentation honesty ─────────────────────────────────────────────────
console.log('\nDocumentation consistency:');
const debtPath = join(ROOT, 'certification', 'TECHNICAL_DEBT.md');
if (existsSync(debtPath)) {
  const openItems = (readFileSync(debtPath, 'utf8').match(/^\| TD-/gm) ?? []).length;
  const summaryPath = join(ROOT, 'DUE_DILIGENCE', 'EXECUTIVE_SUMMARY.md');
  if (existsSync(summaryPath)) {
    const summary = readFileSync(summaryPath, 'utf8');
    const claimsZero = /Open Findings\s*\|\s*0\s*\|/.test(summary);
    check(!(claimsZero && openItems > 0),
      'executive summary does not claim 0 findings while debt is open',
      claimsZero && openItems > 0 ? `(claims 0, register lists ${openItems})` : `(${openItems} open)`);
  }
}

// ── Verdict ──────────────────────────────────────────────────────────────────
console.log('\n' + '\u2501'.repeat(46));
if (failures > 0) {
  console.error(`\n\u274c PRODUCTION CERTIFICATION FAILED \u2014 ${failures} blocking issue(s), ${warnings} warning(s)\n`);
  process.exit(1);
}
console.log(`\n\u2705 PRODUCTION CERTIFICATION PASSED \u2014 0 blocking issues, ${warnings} warning(s)\n`);
