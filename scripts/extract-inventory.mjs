import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const rootDir = 'D:\\sovr-financial-os-protocol-v1.0.0\\SOVR-Protocol';

function loadYaml(rel) {
  return yaml.load(fs.readFileSync(path.join(rootDir, rel), 'utf8'));
}

function countKeys(obj, key) {
  if (!obj || !obj[key]) return 0;
  if (Array.isArray(obj[key])) return obj[key].length;
  if (typeof obj[key] === 'object') return Object.keys(obj[key]).length;
  return 0;
}

// Source counts
const cmdSrc = loadYaml('03_command-catalog.yaml');
const evSrc = loadYaml('04_event-catalog.yaml');
const machSrc = loadYaml('05_state-machines.yaml');
const capSrc = loadYaml('08_security-capabilities.yaml');
const domainSrc = loadYaml('02_domain-model.yaml');

const sourceCounts = {
  commands: countKeys(cmdSrc, 'commands'),
  events: countKeys(evSrc, 'events'),
  machines: countKeys(machSrc, 'machines') || countKeys(machSrc, 'state_machines'),
  capabilities: countKeys(capSrc, 'capabilities') || countKeys(capSrc, 'capability'),
  domains: countKeys(domainSrc, 'domains') || Object.keys(domainSrc.domains || {}).length,
};

// Registry counts
function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, rel), 'utf8'));
}

const regDir = 'generated/registries';
const regFiles = fs.readdirSync(path.join(rootDir, regDir)).filter(f => f.endsWith('.json')).sort();

const registryCounts = {};
for (const f of regFiles) {
  const data = loadJson(path.join(regDir, f));
  const entryCount = data.entry_count || (data.entries ? Object.keys(data.entries).length : (data.registries ? Object.keys(data.registries).length : 0));
  registryCounts[f] = entryCount;
}

// Domain files
const domainFiles = fs.readdirSync(path.join(rootDir, 'domains')).filter(f => f.endsWith('.yaml')).sort();

// Protocol YAML files
const protoYamls = fs.readdirSync(rootDir).filter(f => f.endsWith('.yaml')).sort();
const compilerYamls = fs.readdirSync(path.join(rootDir, 'compiler')).filter(f => f.endsWith('.yaml')).sort();
const protocolDirYamls = [];
try { protocolDirYamls = fs.readdirSync(path.join(rootDir, 'protocol')).filter(f => f.endsWith('.yaml')).sort(); } catch(e) {}

const allInputs = [
  ...protoYamls.map(f => path.join(rootDir, f)),
  ...domainFiles.map(f => path.join(rootDir, 'domains', f)),
  ...compilerYamls.map(f => path.join(rootDir, 'compiler', f)),
  ...protocolDirYamls.map(f => path.join(rootDir, 'protocol', f)),
].sort();

console.log(JSON.stringify({
  sourceCounts,
  registryCounts,
  domainFiles,
  protoYamls,
  compilerYamls,
  protocolDirYamls,
  totalInputs: allInputs.length,
  allInputs: allInputs.map(f => f.replace(rootDir + path.sep, ''))
}, null, 2));
