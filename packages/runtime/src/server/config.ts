// ============================================================
// SOVR Runtime Config — Loads compiler manifest + boot attestation
// Source of CE must prove build_hash chain is unfakeable
// ============================================================

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export interface RuntimeConfig {
  protocolRoot: string;
  generatedDir: string;
  buildHash: string;
  bootHash?: string;
  compilerManifest: any;
  bootAttestation: any;
  devAutoGrant: boolean;
}

export function loadRuntimeConfig(protocolRoot: string): RuntimeConfig {
  const generatedDir = path.join(protocolRoot, 'generated');
  const manifestPath = path.join(generatedDir, 'compiler-manifest.yaml');
  const attestationPath = path.join(generatedDir, 'boot-attestation.json');
  
  let compilerManifest: any = {};
  let buildHash = process.env.SOVR_BUILD_HASH || '';
  
  try {
    if (fs.existsSync(manifestPath)) {
      const raw = fs.readFileSync(manifestPath, 'utf8');
      // manifest is JSON per build? In repo it's JSON actually despite .yaml extension
      try {
        compilerManifest = JSON.parse(raw);
      } catch {
        compilerManifest = yaml.load(raw) as any;
      }
      buildHash = compilerManifest.build_hash || buildHash;
    }
  } catch (e) {
    console.warn('Failed to load compiler-manifest', e);
  }

  let bootAttestation: any = {};
  try {
    if (fs.existsSync(attestationPath)) {
      bootAttestation = JSON.parse(fs.readFileSync(attestationPath,'utf8'));
      // Verify chain
      if (bootAttestation.build_hash && buildHash && bootAttestation.build_hash !== buildHash) {
        console.warn(`⚠️ Build hash mismatch: manifest ${buildHash} vs attestation ${bootAttestation.build_hash} — possible tamper or stale boot`);
        // In production: HALT
      }
    }
  } catch (e) {
    console.warn('Failed to load boot-attestation', e);
  }

  // Fallback: read boot-manifest.json
  try {
    const bootManifestPath = path.join(generatedDir, 'boot-manifest.json');
    if (fs.existsSync(bootManifestPath) && !bootAttestation.boot_hash) {
      bootAttestation = JSON.parse(fs.readFileSync(bootManifestPath,'utf8'));
      if (!buildHash) buildHash = bootAttestation.build_hash;
    }
  } catch {}

  if (!buildHash) {
    buildHash = 'dev-local-no-manifest';
    console.warn('⚠️ No build_hash found — running in dev mode without unfakeable provenance');
  }

  return {
    protocolRoot,
    generatedDir,
    buildHash,
    bootHash: bootAttestation.boot_hash,
    compilerManifest,
    bootAttestation,
    devAutoGrant: process.env.SOVR_DEV_AUTO_GRANT !== 'false', // default true for demo
  };
}
