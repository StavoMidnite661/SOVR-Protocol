// ============================================================
// SOVR Compiler — Protocol Topology & Lineage Graph Generator
// File: packages/compiler/src/generators/topology.ts
// ============================================================
import { SOVR_IR } from '../ir/types.js';
import { GeneratedFile } from './typescript.js';
import { sha256 } from '../utils/hash.js';

export function generateTopology(ir: SOVR_IR): GeneratedFile[] {
  const protocolVersion = ir.meta.protocolVersion;
  const compilerVersion = ir.meta.compilerVersion;
  const files: GeneratedFile[] = [];

  // Build a pure JSON topology object
  const topology = {
    schema_version: '1.0.0',
    generated_by: `@sovr/compiler v${compilerVersion}`,
    protocol_version: protocolVersion,
    ir_hash: ir.meta.irHash,
    stats: {
      nodes: ir.nodes.length,
      edges: ir.edges.length
    },
    nodes: ir.nodes.map(n => ({
      id: n.id,
      type: n.type,
      name: n.sourceRef,
      version: n.version,
      properties: (n as any).attributes || (n as any).gates || {}
    })),
    edges: ir.edges.map(e => ({
      source: e.from,
      target: e.to,
      type: e.type
    }))
  };

  const jsonContent = JSON.stringify(topology, null, 2);
  const jsonHash = sha256(jsonContent);

  files.push({
    path: 'protocol-topology.json',
    content: jsonContent,
    sha256: jsonHash,
    sourceRefs: ['00_protocol-manifest.yaml']
  });

  // Also produce a beautiful Mermaid flowchart representing the L1-L3 linkage
  const lines: string[] = [];
  lines.push('### SOVR Financial OS — Protocol Topology Flowchart');
  lines.push('```mermaid');
  lines.push('flowchart TD');
  lines.push('  %% Root Domains');
  const domains = new Set<string>();
  for (const node of ir.nodes) {
    if ((node as any).domain) {
      domains.add((node as any).domain);
    }
  }

  for (const d of Array.from(domains).sort()) {
    lines.push(`  subgraph ${d.toUpperCase()} [${d.toUpperCase()} Domain]`);
    // Sample representative nodes
    const dNodes = ir.nodes.filter(n => (n as any).domain === d).slice(0, 3);
    for (const n of dNodes) {
      const cleanId = n.id.replace(/[^a-zA-Z0-9]/g, '_');
      const shortName = n.sourceRef.split('.').pop() || n.sourceRef;
      lines.push(`    ${cleanId}(["${n.type.toUpperCase()}: ${shortName}"])`);
    }
    lines.push('  end');
  }

  // Sample edges
  const sampleEdges = ir.edges.slice(0, 30);
  for (const edge of sampleEdges) {
    const s = edge.from.replace(/[^a-zA-Z0-9]/g, '_');
    const t = edge.to.replace(/[^a-zA-Z0-9]/g, '_');
    lines.push(`  ${s} -->|${edge.type}| ${t}`);
  }

  lines.push('```');

  const mdContent = lines.join('\n');
  const mdHash = sha256(mdContent);

  files.push({
    path: 'docs/topology.md',
    content: mdContent,
    sha256: mdHash,
    sourceRefs: ['00_protocol-manifest.yaml']
  });

  return files;
}
