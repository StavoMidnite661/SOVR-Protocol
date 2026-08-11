import fs from 'fs';
import path from 'path';

const rootDir = 'D:\\sovr-financial-os-protocol-v1.0.0\\SOVR-Protocol';
const reconDir = path.join(rootDir, 'generated', 'reconciliation');

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, rel), 'utf8'));
}

// Load registries
const cmdReg = loadJson('generated/registries/commands.registry.json');
const evReg = loadJson('generated/registries/events.registry.json');

const cmdNames = new Set(Object.keys(cmdReg.entries || {}));
const evNames = new Set(Object.keys(evReg.entries || {}));

// Specific files and patterns to check
const checks = [
  { file: 'packages/runtime/src/adapters/BoundaryEventBus.ts', patterns: ['payment.rail.submitted', 'payment.rail.rejected', 'payment.rail.pending', 'payment.rail.unknown_state', 'payment.rail.settled', 'payment.rail.returned', 'payment.rail.reversed', 'payment.rail.confirmed', 'payment.rail.noc_received', 'payment.rail.status_update', 'system.rail.circuit_opened'] },
  { file: 'packages/runtime/src/adapters/achAdapter.ts', patterns: ['adapter.ach', 'payment.rail.prepare', 'payment.rail.confirm', 'payment.compensation.start'] },
];

const findings = [];
for (const check of checks) {
  const fullPath = path.join(rootDir, check.file);
  if (!fs.existsSync(fullPath)) continue;
  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');
  
  for (const pattern of check.patterns) {
    const found = lines.find((line, idx) => line.includes(pattern));
    if (found) {
      const lineNum = lines.indexOf(found) + 1;
      const inCmdReg = cmdNames.has(pattern);
      const inEvReg = evNames.has(pattern);
      
      let type, recommendation;
      if (inCmdReg || inEvReg) {
        type = 'SPEC_BACKED';
        recommendation = 'Literal is present in canonical registry';
      } else if (pattern.startsWith('adapter.') || pattern.startsWith('system.rail.')) {
        type = 'INTENTIONAL_RUNTIME_PRIMITIVE';
        recommendation = 'Boundary/rail primitive; consider adding to command catalog or documenting as runtime exception';
      } else {
        type = 'SPEC_VIOLATION';
        recommendation = 'Add to 03_command-catalog.yaml and regenerate';
      }
      
      findings.push({
        file: check.file,
        line: lineNum,
        literal: pattern,
        type,
        registry_match: inCmdReg || inEvReg,
        recommendation
      });
    }
  }
}

// Check for forbidden patterns
const runtimeSrcDir = path.join(rootDir, 'packages', 'runtime', 'src');
function scanDir(dir, relPath) {
  try {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const rel = path.join(relPath, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        scanDir(full, rel);
      } else if (stat.isFile() && (entry.endsWith('.ts') || entry.endsWith('.js'))) {
        const content = fs.readFileSync(full, 'utf8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (/switch\s*\(\s*commandName\s*\)/i.test(line) || /switch\s*\(\s*domain\s*\)/i.test(line) || /if\s*\(\s*command\s*===?\s*["']/.test(line)) {
            findings.push({
              file: rel,
              line: i + 1,
              literal: line.trim(),
              type: 'SPEC_VIOLATION',
              registry_match: false,
              recommendation: 'Remove hardcoded routing; use registry-driven dispatch'
            });
          }
        }
      }
    }
  } catch (e) {}
}
scanDir(runtimeSrcDir, 'packages/runtime/src');

const specBacked = findings.filter(f => f.type === 'SPEC_BACKED').length;
const specViolations = findings.filter(f => f.type === 'SPEC_VIOLATION').length;
const intentionalPrimitives = findings.filter(f => f.type === 'INTENTIONAL_RUNTIME_PRIMITIVE').length;
const forbiddenPatterns = findings.filter(f => f.type === 'FORBIDDEN_PATTERN').length;

const audit = {
  schema_version: '1.0.0',
  reconciliation_id: 'RECON-000001',
  total_runtime_literals_checked: findings.length,
  spec_backed: specBacked,
  generated: 0,
  system_primitive: 0,
  intentional_runtime_primitive: intentionalPrimitives,
  stale: 0,
  spec_violation: specViolations,
  forbidden_patterns_found: forbiddenPatterns,
  findings
};

fs.writeFileSync(path.join(reconDir, 'RUNTIME-CONFORMANCE-AUDIT.json'), JSON.stringify(audit, null, 2));
console.log(JSON.stringify({total: findings.length, specBacked, specViolations, intentionalPrimitives, forbiddenPatterns}, null, 2));
