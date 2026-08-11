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

// Source capabilities
const capSrc = loadYaml('08_security-capabilities.yaml');
const capabilities = capSrc.capabilities || [];
const capIds = capabilities.map(c => c.capability_id);

// Registry
const capReg = loadJson('generated/registries/capabilities.registry.json');
const regEntries = capReg.entries || {};
const regCapIds = Object.keys(regEntries);

// Command catalog for requirements
const cmdSrc = loadYaml('03_command-catalog.yaml');
const cmdEntries = cmdSrc.commands || {};

// Build command->capabilities map
const cmdToCaps = {};
for (const [cmdName, cmdDef] of Object.entries(cmdEntries)) {
  const cap = cmdDef.authorization_requirements?.capability || cmdDef.issuer?.minimum_capability || null;
  if (cap) {
    if (!cmdToCaps[cap]) cmdToCaps[cap] = [];
    cmdToCaps[cap].push(cmdName);
  }
}

const results = [];
for (const capId of capIds) {
  const inReg = regCapIds.includes(capId);
  const requiredBy = cmdToCaps[capId] || [];
  const srcDef = capabilities.find(c => c.capability_id === capId) || {};
  
  results.push({
    capability_id: capId,
    domain: srcDef.domain || 'unknown',
    source_location: '08_security-capabilities.yaml',
    in_registry: inReg,
    in_source: true,
    required_by_commands: requiredBy,
    grant_type: srcDef.grant_type || srcDef.type || 'UNKNOWN',
    scope: srcDef.scope || 'UNKNOWN',
    classification: inReg ? 'BOTH' : 'SOURCE_ONLY'
  });
}

// Check for registry-only capabilities
for (const regCapId of regCapIds) {
  if (!capIds.includes(regCapId)) {
    results.push({
      capability_id: regCapId,
      domain: 'unknown',
      source_location: null,
      in_registry: true,
      in_source: false,
      required_by_commands: [],
      grant_type: 'UNKNOWN',
      scope: 'UNKNOWN',
      classification: 'REGISTRY_ONLY'
    });
  }
}

const counts = {
  SOURCE_ONLY: results.filter(r => r.classification === 'SOURCE_ONLY').length,
  REGISTRY_ONLY: results.filter(r => r.classification === 'REGISTRY_ONLY').length,
  BOTH: results.filter(r => r.classification === 'BOTH').length,
  DUPLICATE: 0,
  INVALID: 0,
  FILTERED_BY_DESIGN: 0,
};

const matrix = {
  schema_version: '1.0.0',
  reconciliation_id: 'RECON-000001',
  total_capabilities: capIds.length,
  source_count: capIds.length,
  registry_count: regCapIds.length,
  classification_counts: counts,
  capabilities: results
};

fs.writeFileSync(path.join(reconDir, 'CAPABILITY-COVERAGE-MATRIX.json'), JSON.stringify(matrix, null, 2));
console.log(JSON.stringify({total: capIds.length, counts, regCount: regCapIds.length}, null, 2));
