import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const rootDir = 'D:\\sovr-financial-os-protocol-v1.0.0\\SOVR-Protocol';
const reconDir = path.join(rootDir, 'generated', 'reconciliation');

function loadYaml(rel) {
  return yaml.load(fs.readFileSync(path.join(rootDir, rel), 'utf8'));
}

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, rel), 'utf8'));
}

// Source commands
const cmdSrc = loadYaml('03_command-catalog.yaml');
const commands = cmdSrc.commands;
const cmdNames = Object.keys(commands);

// Registry
const cmdReg = loadJson('generated/registries/commands.registry.json');
const regEntries = cmdReg.entries || {};
const regCmdKeys = Object.keys(regEntries);

// Compiler manifest coverage
const compilerManifest = loadJson('generated/compiler-manifest.yaml');
const coverage = compilerManifest.command_lifecycle_coverage || {};
const coveredSet = new Set((coverage.covered || []).map(c => c.command));
const exemptions = coverage.lifecycle_exemptions || {};
const exemptSet = new Set(Object.keys(exemptions));

// Registry exemptions (may differ from compiler manifest)
const regExemptions = cmdReg.command_lifecycle_coverage?.lifecycle_exemptions || {};
const regExemptSet = new Set(Object.keys(regExemptions));

const results = [];
for (const name of cmdNames) {
  const inReg = regCmdKeys.includes(name);
  const entry = regEntries[name] || {};
  const isExempt = exemptSet.has(name);
  const isRegExempt = regExemptSet.has(name);
  const isCovered = coveredSet.has(name);
  
  let status;
  if (!inReg) status = 'STALE';
  else if (isExempt) status = 'EXEMPT';
  else if (isCovered) status = 'WIRED';
  else if (isRegExempt) status = 'EXEMPT';
  else status = 'UNWIRED';
  
  results.push({
    command: name,
    domain: entry.domain || commands[name]?.source_domain || 'unknown',
    source_location: '03_command-catalog.yaml',
    machine_coverage: isCovered ? (coveredSet.has(name) ? (coverage.covered.find(c => c.command === name)?.machine || null) : null) : null,
    validation: entry.constitutional_gates ? 'present' : 'missing',
    capability_requirement: entry.authorization_requirements?.capability || commands[name]?.issuer?.minimum_capability || 'none',
    runtime_handler: inReg ? 'present' : 'missing',
    event_output: entry.resulting_events?.success || [],
    lifecycle_status: status,
    governance_ref: isExempt ? (exemptions[name]?.lifecycle_exempt_governance_ref || exemptions[name]?.governance_ref || null) : null
  });
}

const counts = {
  WIRED: results.filter(r => r.lifecycle_status === 'WIRED').length,
  EXEMPT: results.filter(r => r.lifecycle_status === 'EXEMPT').length,
  UNWIRED: results.filter(r => r.lifecycle_status === 'UNWIRED').length,
  STALE: results.filter(r => r.lifecycle_status === 'STALE').length,
  INVALID: results.filter(r => r.lifecycle_status === 'INVALID').length,
};

const matrix = {
  schema_version: '1.0.0',
  reconciliation_id: 'RECON-000001',
  total_commands: cmdNames.length,
  source_count: cmdNames.length,
  registry_count: regCmdKeys.length,
  classification_counts: counts,
  commands: results
};

fs.writeFileSync(path.join(reconDir, 'COMMAND-COVERAGE-MATRIX.json'), JSON.stringify(matrix, null, 2));
console.log(JSON.stringify({total: cmdNames.length, counts, regCount: regCmdKeys.length}, null, 2));
