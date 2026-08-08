import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import yaml from 'js-yaml';

export interface YamlFile {
  path: string;
  relativePath: string;
  content: string;
  parsed: any;
  sha256: string;
}

import { hashFileContent } from './hash.js';

export function loadYamlFile(fullPath: string, rootDir: string): YamlFile {
  const content = readFileSync(fullPath, 'utf8');
  const hash = hashFileContent(content);
  let parsed: any;
  try {
    parsed = yaml.load(content, { filename: fullPath });
  } catch (e: any) {
    throw new Error(`SYNTAX-001 Invalid YAML ${fullPath}: ${e.message}`);
  }
  return {
    path: fullPath,
    // Normalize to POSIX separators. relativePath is hashed into build_hash,
    // so a raw Windows '\' would make the build hash platform-dependent and
    // break cross-platform reproducibility (audit finding F-3).
    relativePath: relative(rootDir, fullPath).split(sep).join('/'),
    content,
    parsed,
    sha256: hash,
  };
}

export function discoverProtocolInputs(rootDir: string): string[] {
  // Closed, ordered discovery per protocol/DOMAIN_REGISTRY and 00_protocol-manifest.yaml
  // For working kernel: enumerate root-level *.yaml, domains/*.yaml, compiler/*.yaml, protocol/*.yaml
  // Exclusions: status/milestone docs that are derived, not protocol inputs per compiler.yaml
  const candidates: string[] = [];
  const rootFiles = readdirSync(rootDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  for (const f of rootFiles) {
    // Exclude derived/status files that are not part of frozen spec frontier
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
    candidates.push(join(rootDir, f));
  }
  const domainsDir = join(rootDir, 'domains');
  try {
    const domainFiles = readdirSync(domainsDir).filter(f => f.endsWith('.yaml'));
    for (const f of domainFiles) candidates.push(join(domainsDir, f));
  } catch {}
  const compilerDir = join(rootDir, 'compiler');
  try {
    const compFiles = readdirSync(compilerDir).filter(f => f.endsWith('.yaml'));
    for (const f of compFiles) candidates.push(join(compilerDir, f));
  } catch {}
  const protocolDir = join(rootDir, 'protocol');
  try {
    const protoFiles = readdirSync(protocolDir).filter(f => f.endsWith('.yaml'));
    for (const f of protoFiles) candidates.push(join(protocolDir, f));
  } catch {}
  const simulationDir = join(rootDir, 'governance', 'simulation', 'scenarios');
  try {
    const simFiles = readdirSync(simulationDir).filter(f => f.endsWith('.yaml'));
    for (const f of simFiles) candidates.push(join(simulationDir, f));
  } catch {}
  // Sort lexicographically for determinism (R2: file lists sorted before hashing)
  candidates.sort();
  return candidates;
}
