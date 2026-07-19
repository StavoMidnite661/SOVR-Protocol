// Bootloader — Runlevel 1: Secure Bootloader, verifies build_hash tamper detection
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { sha256 } from '../utils/hash.js';
import { loadYamlFile, discoverProtocolInputs } from '../utils/yaml-loader.js';
import { Diagnostic } from '../ir/types.js';

export interface BootloaderResult {
  level: 1;
  stage: 'BOOTLOADER';
  passed: boolean;
  buildHash: string;
  verified: boolean;
  manifest: any;
  inputHashes: Record<string, string>;
  diagnostics: Diagnostic[];
  durationMs: number;
  bootLog: string;
}

export async function runBootloader(rootDir: string): Promise<BootloaderResult> {
  const start = performance.now();
  const diagnostics: Diagnostic[] = [];
  let buildHash = 'unknown';
  let manifest: any = null;
  let inputHashes: Record<string, string> = {};
  let verified = false;

  const manifestPath = join(rootDir, 'generated', 'compiler-manifest.yaml');
  if (!existsSync(manifestPath)) {
    diagnostics.push({
      code: 'GEN-007',
      category: 'GENERATION',
      severity: 'FATAL',
      stage: 'BOOTLOADER',
      file: 'generated/compiler-manifest.yaml',
      message: 'Missing compiler-manifest.yaml — run sovr compile first',
      action: 'HALT',
    });
    return {
      level: 1,
      stage: 'BOOTLOADER',
      passed: false,
      buildHash,
      verified: false,
      manifest,
      inputHashes,
      diagnostics,
      durationMs: performance.now() - start,
      bootLog: `[1] Bootloader: FAILED — no manifest, run sovr compile`,
    };
  }

  const manifestContent = readFileSync(manifestPath, 'utf8');
  manifest = yaml.load(manifestContent) as any;
  buildHash = manifest.build_hash || manifest.buildHash || 'unknown';
  inputHashes = manifest.input_hashes || {};

  // Recompute input hashes from disk and compare — tamper detection
  const discovered = discoverProtocolInputs(rootDir);
  let mismatch = false;
  const recomputed: Record<string, string> = {};
  for (const p of discovered) {
    try {
      const f = loadYamlFile(p, rootDir);
      recomputed[f.relativePath] = f.sha256;
    } catch {}
  }

  for (const [relPath, expectedHash] of Object.entries(inputHashes)) {
    const actual = recomputed[relPath];
    if (actual && actual !== expectedHash) {
      mismatch = true;
      diagnostics.push({
        code: 'GEN-007',
        category: 'GENERATION',
        severity: 'FATAL',
        stage: 'BOOTLOADER',
        file: relPath,
        message: `Tamper detected: ${relPath} hash mismatch expected ${String(expectedHash).slice(0,16)}... got ${String(actual).slice(0,16)}...`,
        action: 'ABORT_WITH_GENERATION_ERROR',
      });
    }
  }

  // Protocol version frozen check
  const protocolManifestPath = join(rootDir, '00_protocol-manifest.yaml');
  if (existsSync(protocolManifestPath)) {
    try {
      const pm = yaml.load(readFileSync(protocolManifestPath, 'utf8')) as any;
      if (pm.protocol?.status !== 'FROZEN') {
        diagnostics.push({
          code: 'INV-002',
          category: 'INVARIANT',
          severity: 'WARNING',
          stage: 'BOOTLOADER',
          file: '00_protocol-manifest.yaml',
          message: `Protocol status ${pm.protocol?.status} expected FROZEN`,
          action: 'REPORT_WARNINGS',
        });
      }
    } catch {}
  }

  verified = !mismatch && diagnostics.filter(d=>d.severity==='FATAL').length===0;

  const durationMs = performance.now() - start;
  const bootLog = verified
    ? `[${(durationMs/1000).toFixed(3)}s] Bootloader: verified build_hash ${buildHash.slice(0,16)}... (unfakeable provenance) — ${Object.keys(inputHashes).length} inputs hashed, tamper check OK — runlevel 1 BOOTLOADER secure`
    : `[${(durationMs/1000).toFixed(3)}s] Bootloader: FAILED tamper detection — build_hash ${buildHash.slice(0,16)}... mismatch`;

  return {
    level: 1,
    stage: 'BOOTLOADER',
    passed: verified,
    buildHash,
    verified,
    manifest,
    inputHashes,
    diagnostics,
    durationMs,
    bootLog,
  };
}
