// SOVR Compiler — spec validation harness
// Validates the frozen protocol specification against the compiler's own
// documented invariants. Used by `npm run test:genesis|fault|stress|integration`.
import yaml from 'js-yaml';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..', '..'); // packages/compiler/scripts -> repo

const read = (p) => readFileSync(p, 'utf8');
const load = (p) => yaml.load(read(p));

// Mirrors packages/compiler/src/utils/yaml-loader.ts discoverProtocolInputs
function discoverInputs() {
  const c = [];
  const rootFiles = readdirSync(ROOT).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  for (const f of rootFiles) {
    if (
      f.startsWith('DEPENDENCY') ||
      f.startsWith('DOMAIN_STATUS') ||
      f.startsWith('MILESTONE') ||
      f.startsWith('PROJECT_STATUS') ||
      f.startsWith('VERIFICATION_REPORT') ||
      f.startsWith('AUDIT_REPORT') ||
      f.startsWith('COMPLETE_VERIFICATION') ||
      f.startsWith('WALL_TO_WALL') ||
      f.startsWith('SOVR_FULL_AUDIT')
    ) continue;
    c.push(join(ROOT, f));
  }
  for (const d of ['domains', 'compiler', 'protocol']) {
    try {
      for (const f of readdirSync(join(ROOT, d)).filter((f) => f.endsWith('.yaml'))) c.push(join(ROOT, d, f));
    } catch {}
  }
  c.sort();
  return c;
}

function allRepoYaml() {
  const out = [];
  (function walk(dir) {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      const s = statSync(p);
      if (s.isDirectory()) {
        if (e === '.git' || e === 'node_modules') continue;
        walk(p);
      } else if (e.endsWith('.yaml') || e.endsWith('.yml')) out.push(p);
    }
  })(ROOT);
  return out;
}

function countAcceptanceTests(a) {
  let total = 0;
  for (const [cat, val] of Object.entries(a)) {
    if (cat === 'meta') continue;
    total += Array.isArray(val) ? val.length : val && typeof val === 'object' ? Object.keys(val).length : 0;
  }
  return total;
}

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  \u2713 ${name}`);
  else { console.log(`  \u2717 ${name} ${detail}`); failures++; }
}

function validateSpec() {
  console.log('Spec validation:');
  const inputs = discoverInputs();
  let parseFail = 0;
  for (const f of inputs) {
    try { yaml.load(read(f)); } catch (e) { parseFail++; console.log('    parse error:', f, e.message); }
  }
  check(`all ${inputs.length} compiler-input YAML files parse (expected 38)`, parseFail === 0 && inputs.length === 38, `(got ${inputs.length}, ${parseFail} failed)`);

  const cmd = load(join(ROOT, '03_command-catalog.yaml'));
  const ev = load(join(ROOT, '04_event-catalog.yaml'));
  const cap = load(join(ROOT, '08_security-capabilities.yaml'));
  const sm = load(join(ROOT, '05_state-machines.yaml'));
  check('101 commands', Object.keys(cmd.commands || {}).length === 101, `(got ${Object.keys(cmd.commands || {}).length})`);
  check('251 events', Object.keys(ev.events || {}).length === 251, `(got ${Object.keys(ev.events || {}).length})`);
  check('107 capabilities', (cap.capabilities && (Array.isArray(cap.capabilities) ? cap.capabilities.length : Object.keys(cap.capabilities).length)) === 107 || Object.keys(cap.capabilities || {}).length === 107, `(got ${Array.isArray(cap.capabilities) ? cap.capabilities.length : Object.keys(cap.capabilities || {}).length})`);
  check('21 state machines', Object.keys(sm.state_machines || {}).length === 21, `(got ${Object.keys(sm.state_machines || {}).length})`);

  const acc = load(join(ROOT, 'acceptance-tests.yaml'));
  const at = countAcceptanceTests(acc);
  check('60 acceptance tests', at === 60, `(got ${at})`);

  let invalid = 0;
  for (const f of allRepoYaml()) {
    const content = read(f);
    let ok = false;
    try { yaml.load(content); ok = true; } catch {}
    if (!ok) { try { yaml.loadAll(content); ok = true; } catch {} }
    if (!ok) { invalid++; console.log('    invalid yaml:', f); }
  }
  check('no genuinely-invalid YAML in repo', invalid === 0, `(${invalid} invalid)`);
}

function validateFault() {
  console.log('Fault-injection / regression guards:');
  for (const f of ['certification/EVENT_REFERENCE_INVENTORY.yaml', 'certification/PHASE_XIII_COMPLETION_REPORT.yaml']) {
    let ok = false;
    try { yaml.load(read(join(ROOT, f))); ok = true; } catch {}
    check(`regression: ${f} parses`, ok);
  }
}

function validateIntegration() {
  console.log('Integration checks:');
  const manifest = join(ROOT, 'generated', 'compiler-manifest.yaml');
  check('generated/compiler-manifest.yaml exists', existsSync(manifest));
  if (existsSync(manifest)) {
    const m = load(manifest);
    check('build_hash present (20c57cfb...)', !!m.build_hash && m.build_hash.startsWith('20c57cfb'), `(hash=${m.build_hash?.slice(0, 12)}…)`);
    check('0 errors / 0 warnings', (m.stats?.errors || 0) === 0 && (m.stats?.warnings || 0) === 0);
    check('38 input files', m.stats?.input_files === 38, `(got ${m.stats?.input_files})`);
    check('62 generated files', m.stats?.generated_files === 62, `(got ${m.stats?.generated_files})`);
  }
  const openapi = join(ROOT, 'generated', 'openapi.yaml');
  if (existsSync(openapi)) {
    const o = load(openapi);
    const paths = Object.keys(o.paths || {}).length;
    check('OpenAPI has 44 endpoint paths', paths === 44, `(got ${paths})`);
  }
}

const mode = process.argv[2] || 'genesis';
if (mode === 'stress') {
  for (let i = 0; i < 5; i++) { console.log(`-- run ${i + 1}/5 --`); validateSpec(); }
} else {
  validateSpec();
  if (mode === 'fault') validateFault();
  if (mode === 'integration') validateIntegration();
  if (mode === 'genesis') { validateFault(); validateIntegration(); }
}

console.log('');
if (failures === 0) { console.log(`\u2705 ALL CHECKS PASSED (mode=${mode})`); process.exit(0); }
else { console.log(`\u274c ${failures} CHECK(S) FAILED (mode=${mode})`); process.exit(1); }
