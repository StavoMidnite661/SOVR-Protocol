import { ParsedProtocol } from '../pipeline/parse.js';
import { SOVR_IR, ProtocolNode, Diagnostic } from './types.js';
import { sha256, canonicalJson } from '../utils/hash.js';

export function buildIR(parsed: ParsedProtocol, extraDiagnostics: Diagnostic[]): { ir: SOVR_IR; diagnostics: Diagnostic[] } {
  const nodes: ProtocolNode[] = [];
  const edges: Array<{ from: string; to: string; type: string }> = [];
  const diagnostics: Diagnostic[] = [...extraDiagnostics];

  const domainModel = parsed.canonicalList['02_domain-model.yaml'] || parsed.canonicalList['domains/vault.yaml'] ? parsed.files.find(f=>f.relativePath.includes('02_domain-model'))?.parsed : null;
  const commandCatalog = parsed.files.find(f=>f.relativePath.includes('03_command-catalog'))?.parsed;
  const eventCatalog = parsed.files.find(f=>f.relativePath.includes('04_event-catalog'))?.parsed;
  const capCatalog = parsed.files.find(f=>f.relativePath.includes('08_security-capabilities'))?.parsed;
  const stateMachines = parsed.files.find(f=>f.relativePath.includes('05_state-machines'))?.parsed;
  const protocolManifest = parsed.files.find(f=>f.relativePath.includes('00_protocol-manifest'))?.parsed;

  // Domains from manifest
  const manifestDomains = protocolManifest?.domains ? Object.keys(protocolManifest.domains) : ['vault','ledger','treasury','payment','identity','policy','agent','governance','intent'];

  // Sort domains alphabetically for determinism
  manifestDomains.sort();

  for (const dName of manifestDomains) {
    nodes.push({
      id: `domain:${dName}`,
      type: 'domain',
      sourceFile: '00_protocol-manifest.yaml',
      sourceRef: dName,
      version: protocolManifest?.protocol?.version || '1.0.0',
      constitutionalRefs: [],
      // @ts-ignore extra
      name: dName,
      description: protocolManifest?.domains?.[dName]?.description || '',
      entities: [],
      priority: protocolManifest?.domains?.[dName]?.priority || 0,
      layer: protocolManifest?.domains?.[dName]?.layer || 'L1',
    } as any);
  }

  // Entities
  const dm = parsed.files.find(f=>f.relativePath.includes('02_domain-model'))?.parsed;
  if (dm?.domains) {
    for (const [domainName, domainDef] of Object.entries(dm.domains as any)) {
      const ents = (domainDef as any).entities || {};
      for (const [entityName, entityDef] of Object.entries(ents as any)) {
        const id = `${domainName}.${entityName}`;
        nodes.push({
          id: `entity:${id}`,
          type: 'entity',
          sourceFile: '02_domain-model.yaml',
          sourceRef: id,
          version: '1.0.0',
          constitutionalRefs: [],
          domain: domainName,
          entityName,
          attributes: (entityDef as any).attributes || {},
        } as any);
        edges.push({ from: `domain:${domainName}`, to: `entity:${id}`, type: 'domain_contains_entity' });
      }
    }
  }

  // Commands
  if (commandCatalog?.commands) {
    const cmdNames = Object.keys(commandCatalog.commands).sort();
    for (const cmdName of cmdNames) {
      const def = commandCatalog.commands[cmdName];
      const parts = cmdName.split('.');
      const domain = parts[0];
      nodes.push({
        id: `command:${cmdName}`,
        type: 'command',
        sourceFile: '03_command-catalog.yaml',
        sourceRef: cmdName,
        version: def.version || '1.0.0',
        constitutionalRefs: def.constitutional_gates?.invariants || [],
        domain,
        aggregate: def.aggregate || '',
        requiredPayload: def.required_payload || [],
        resultingEvents: [...(def.resulting_events?.success||[]), ...(def.resulting_events?.failure||[])],
        capability: def.authorization_requirements?.capability || def.issuer?.minimum_capability || '',
        gates: def.constitutional_gates || {},
      } as any);
      edges.push({ from: `domain:${domain}`, to: `command:${cmdName}`, type: 'entity_accepts_command' });
      // edges command -> events
      for (const ev of [...(def.resulting_events?.success||[]), ...(def.resulting_events?.failure||[])]) {
        edges.push({ from: `command:${cmdName}`, to: `event:${ev}`, type: 'command_produces_event' });
      }
      if (def.authorization_requirements?.capability) {
        edges.push({ from: `command:${cmdName}`, to: `capability:${def.authorization_requirements.capability}`, type: 'command_requires_capability' });
      }
    }
  }

  // Events
  if (eventCatalog?.events) {
    const evNames = Object.keys(eventCatalog.events).sort();
    for (const evName of evNames) {
      const def = eventCatalog.events[evName];
      nodes.push({
        id: `event:${evName}`,
        type: 'event',
        sourceFile: '04_event-catalog.yaml',
        sourceRef: evName,
        version: def.version || '1.0.0',
        constitutionalRefs: [],
        domain: def.source_domain || evName.split('.')[0],
        aggregate: def.aggregate || '',
        dataFields: def.data_fields || {},
        envelope: eventCatalog.event_envelope,
      } as any);
    }
  }

  // Capabilities
  if (capCatalog?.capabilities) {
    for (const cap of capCatalog.capabilities) {
      nodes.push({
        id: `capability:${cap.capability_id}`,
        type: 'capability',
        sourceFile: '08_security-capabilities.yaml',
        sourceRef: cap.capability_id,
        version: '1.0.0',
        constitutionalRefs: cap.constitutional_constraint ? [cap.constitutional_constraint] : [],
        capabilityId: cap.capability_id,
        domain: (cap.domain || '').toLowerCase(),
        resourceType: cap.resource_type || '',
        action: cap.action || '',
        riskLevel: cap.risk_level || '',
        scopePattern: cap.scope_pattern || '',
      } as any);
    }
  }

  // State machines
  if (stateMachines?.state_machines) {
    for (const [smName, smDef] of Object.entries(stateMachines.state_machines as any)) {
      nodes.push({
        id: `state_machine:${smName}`,
        type: 'state_machine',
        sourceFile: '05_state-machines.yaml',
        sourceRef: smName,
        version: '1.0.0',
        constitutionalRefs: [],
      });
      const def = smDef as any;
      edges.push({ from: `domain:${def.domain}`, to: `state_machine:${smName}`, type: 'state_machine_governs_entity' });
    }
  }

  // Deterministic sorting: nodes sorted by id, edges sorted by type then target
  nodes.sort((a,b)=>a.id.localeCompare(b.id));
  edges.sort((a,b)=>{
    if (a.type!==b.type) return a.type.localeCompare(b.type);
    if (a.from!==b.from) return a.from.localeCompare(b.from);
    return a.to.localeCompare(b.to);
  });

  const ir: SOVR_IR = {
    meta: {
      protocolVersion: parsed.protocolVersion,
      compilerVersion: '0.2.0-kernel-working',
      generatedWithoutWallClock: true,
    },
    nodes,
    edges,
    diagnostics,
  };

  const irJson = canonicalJson({ nodes, edges, protocolVersion: ir.meta.protocolVersion, compilerVersion: ir.meta.compilerVersion });
  const irHash = sha256(irJson);
  ir.meta.irHash = irHash;

  return { ir, diagnostics };
}
