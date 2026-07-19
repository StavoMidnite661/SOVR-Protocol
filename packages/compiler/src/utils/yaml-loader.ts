import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
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
    relativePath: relative(rootDir, fullPath),
    content,
    parsed,
    sha256: hash,
  };
}

export function discoverProtocolInputs(rootDir: string): string[] {
  // Closed, ordered discovery per protocol/DOMAIN_REGISTRY and 00_protocol-manifest.yaml
  // For working kernel: enumerate root-level *.yaml, domains/*.yaml, compiler/*.yaml, protocol/*.yaml
  const candidates: string[] = [];
  const rootFiles = readdirSync(rootDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  for (const f of rootFiles) {
    // Exclude certification and generated (derived)
    if (f.startsWith('DEPENDENCY') || f.startsWith('DOMAIN_STATUS') || f.startsWith('MILESTONE')) continue;
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
  // Sort lexicographically for determinism (R2: file lists sorted before hashing)
  candidates.sort();
  return candidates;
}
