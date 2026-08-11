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

// Source events
const evSrc = loadYaml('04_event-catalog.yaml');
const events = evSrc.events || {};
const eventNames = Object.keys(events);

// Registry
const evReg = loadJson('generated/registries/events.registry.json');
const regEntries = evReg.entries || {};
const regEventKeys = Object.keys(regEntries);

// Build producer->events map from event catalog
const producerToEvents = {};
const eventProducers = {};
for (const [name, def] of Object.entries(events)) {
  const producer = def.producer || (def.triggered_by ? def.triggered_by : null);
  eventProducers[name] = producer;
  if (producer) {
    if (!producerToEvents[producer]) producerToEvents[producer] = [];
    producerToEvents[producer].push(name);
  }
}

// Build command->events map from command catalog
const cmdSrc = loadYaml('03_command-catalog.yaml');
const cmdEntries = cmdSrc.commands || {};
const cmdToEvents = {};
for (const [cmdName, cmdDef] of Object.entries(cmdEntries)) {
  const successEvents = cmdDef.resulting_events?.success || [];
  const failureEvents = cmdDef.resulting_events?.failure || [];
  const allEvents = [...successEvents, ...failureEvents];
  for (const ev of allEvents) {
    if (!cmdToEvents[ev]) cmdToEvents[ev] = [];
    cmdToEvents[ev].push(cmdName);
  }
}

// Projections for consumers
const projReg = loadJson('generated/registries/projections.registry.json');
const projections = projReg.entries || {};
const projNames = Object.keys(projections);

// Build projection->events map
const projToEvents = {};
for (const [projName, projDef] of Object.entries(projections)) {
  const evts = projDef.event_dependencies || projDef.events || [];
  projToEvents[projName] = evts;
}

// Extension domains
const extensionDomains = ['commercial', 'settlement', 'certification', 'representation', 'gateway'];

const results = [];
for (const name of eventNames) {
  const inReg = regEventKeys.includes(name);
  const cmdProducers = cmdToEvents[name] || [];
  const catalogProducer = eventProducers[name];
  const consumers = projNames.filter(p => (projToEvents[p] || []).includes(name));
  const srcDef = events[name] || {};
  const domain = srcDef.source_domain || srcDef.domain || 'unknown';
  const isExtension = extensionDomains.includes(domain);
  const hasConsumers = (srcDef.consumers || []).length > 0 || consumers.length > 0;
  
  let classification;
  if (!inReg) {
    classification = 'STALE';
  } else if (cmdProducers.length === 0 && !catalogProducer) {
    classification = 'DECLARED_ONLY';
  } else if (cmdProducers.length > 0 && !hasConsumers && !isExtension) {
    classification = 'UNREACHABLE';
  } else if (cmdProducers.length === 0 && hasConsumers) {
    classification = 'PROJECTION_ONLY';
  } else if (isExtension) {
    classification = 'EXTENSION_EVENT';
  } else if (domain === 'kernel' || domain === 'system') {
    classification = 'SYSTEM_EVENT';
  } else {
    classification = 'WIRED';
  }
  
  results.push({
    event_name: name,
    domain: domain,
    command_producer: cmdProducers[0] || catalogProducer || null,
    state_machine_producer: null,
    projection_consumer: consumers,
    runtime_emitter: inReg ? 'present' : 'missing',
    schema: srcDef.data_fields || srcDef.payload ? 'present' : 'missing',
    retention_class: srcDef.retention_class || 'PERMANENT',
    constitutional_references: srcDef.constitutional_refs || [],
    classification
  });
}

const counts = {
  WIRED: results.filter(r => r.classification === 'WIRED').length,
  DECLARED_ONLY: results.filter(r => r.classification === 'DECLARED_ONLY').length,
  UNREACHABLE: results.filter(r => r.classification === 'UNREACHABLE').length,
  PROJECTION_ONLY: results.filter(r => r.classification === 'PROJECTION_ONLY').length,
  SYSTEM_EVENT: results.filter(r => r.classification === 'SYSTEM_EVENT').length,
  EXTENSION_EVENT: results.filter(r => r.classification === 'EXTENSION_EVENT').length,
  STALE: results.filter(r => r.classification === 'STALE').length,
  INVALID: results.filter(r => r.classification === 'INVALID').length,
};

const matrix = {
  schema_version: '1.0.0',
  reconciliation_id: 'RECON-000001',
  total_events: eventNames.length,
  source_count: eventNames.length,
  registry_count: regEventKeys.length,
  classification_counts: counts,
  events: results
};

fs.writeFileSync(path.join(reconDir, 'EVENT-COVERAGE-MATRIX.json'), JSON.stringify(matrix, null, 2));
console.log(JSON.stringify({total: eventNames.length, counts, regCount: regEventKeys.length}, null, 2));
