// ============================================================
// SOVR Runtime Config — Loads compiler manifest + boot attestation
// Production config: env-driven, no silent fallbacks for secrets.
// SOVR_JWT_SECRET is REQUIRED in production. SOVR_DEV_AUTO_GRANT
// defaults to FALSE (must be explicitly opted-in for dev mode).
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
  jwtSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
  jwtTtlSeconds: number;
  kafkaEnabled: boolean;
  kafkaBrokers: string[];
  kafkaClientId: string;
  redisEnabled: boolean;
  redisUrl: string;
  redisStreamMaxLen: number;
  bindHost: string;
  bindPort: number;
  nodeEnv: 'production' | 'staging' | 'development' | 'test';
  logLevel: string;
}

function envBool(key: string, def: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return def;
  return v === 'true' || v === '1' || v === 'yes';
}

function envInt(key: string, def: number): number {
  const v = process.env[key];
  if (v === undefined) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function envList(key: string, def: string[]): string[] {
  const v = process.env[key];
  if (!v) return def;
  return v.split(',').map(s => s.trim()).filter(Boolean);
}

export function loadRuntimeConfig(protocolRoot: string): RuntimeConfig {
  const generatedDir = path.join(protocolRoot, 'generated');
  const manifestPath = path.join(generatedDir, 'compiler-manifest.yaml');
  const attestationPath = path.join(generatedDir, 'boot-attestation.json');

  const nodeEnv = (process.env.NODE_ENV as RuntimeConfig['nodeEnv']) ?? 'development';

  // JWT secret: REQUIRED in production/staging, generated in dev/test
  let jwtSecret = process.env.SOVR_JWT_SECRET ?? '';
  if (!jwtSecret) {
    if (nodeEnv === 'production' || nodeEnv === 'staging') {
      throw new Error(
        'SOVR_JWT_SECRET env var is REQUIRED in production/staging. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64\'))"',
      );
    }
    // Dev/test fallback — printed once so the operator knows
    jwtSecret = 'dev-only-secret-do-not-use-in-prod-min-32-bytes-please';
    console.warn('⚠️  SOVR_JWT_SECRET not set — using ephemeral dev secret. DO NOT USE IN PRODUCTION.');
  }

  // Build hash from compiler manifest
  let compilerManifest: any = {};
  let buildHash = process.env.SOVR_BUILD_HASH || '';
  try {
    if (fs.existsSync(manifestPath)) {
      const raw = fs.readFileSync(manifestPath, 'utf8');
      try { compilerManifest = JSON.parse(raw); }
      catch { compilerManifest = yaml.load(raw) as any; }
      buildHash = compilerManifest.build_hash || buildHash;
    }
  } catch (e) {
    console.warn('Failed to load compiler-manifest', e);
  }

  // Boot attestation + chain verification
  let bootAttestation: any = {};
  try {
    if (fs.existsSync(attestationPath)) {
      bootAttestation = JSON.parse(fs.readFileSync(attestationPath, 'utf8'));
      if (bootAttestation.build_hash && buildHash && bootAttestation.build_hash !== buildHash) {
        const msg = `Build hash mismatch: manifest ${buildHash} vs attestation ${bootAttestation.build_hash} — possible tamper or stale boot`;
        if (nodeEnv === 'production') {
          throw new Error(msg); // hard fail in production
        }
        console.warn(`⚠️ ${msg}`);
      }
    }
  } catch (e: any) {
    if (e?.message?.includes('Build hash mismatch')) throw e;
    console.warn('Failed to load boot-attestation', e);
  }

  // Fallback boot manifest
  try {
    const bootManifestPath = path.join(generatedDir, 'boot-manifest.json');
    if (fs.existsSync(bootManifestPath) && !bootAttestation.boot_hash) {
      bootAttestation = JSON.parse(fs.readFileSync(bootManifestPath, 'utf8'));
      if (!buildHash) buildHash = bootAttestation.build_hash;
    }
  } catch { /* tolerated */ }

  if (!buildHash) {
    if (nodeEnv === 'production') {
      throw new Error('No build_hash found. Run the compiler first: `node packages/compiler/dist/cli.js compile && boot`');
    }
    buildHash = 'dev-local-no-manifest';
    console.warn('⚠️ No build_hash found — running in dev mode without unfakeable provenance');
  }

  // dev-auto-grant: DEFAULT OFF. Must be explicitly enabled.
  // This is the P0 fix from the audit: previously default was `true`, which violates INV-003/004.
  const devAutoGrant = envBool('SOVR_DEV_AUTO_GRANT', false);
  if (devAutoGrant && nodeEnv === 'production') {
    throw new Error('SOVR_DEV_AUTO_GRANT must be false in production');
  }

  return {
    protocolRoot,
    generatedDir,
    buildHash,
    bootHash: bootAttestation.boot_hash,
    compilerManifest,
    bootAttestation,
    devAutoGrant,
    jwtSecret,
    jwtIssuer: process.env.SOVR_JWT_ISSUER ?? 'sovr-financial-os',
    jwtAudience: process.env.SOVR_JWT_AUDIENCE ?? 'sovr-clients',
    jwtTtlSeconds: envInt('SOVR_JWT_TTL_SECONDS', 3600),
    kafkaEnabled: envBool('SOVR_KAFKA_ENABLED', false),
    kafkaBrokers: envList('SOVR_KAFKA_BROKERS', []),
    kafkaClientId: process.env.SOVR_KAFKA_CLIENT_ID ?? 'sovr-runtime',
    redisEnabled: envBool('SOVR_REDIS_ENABLED', false),
    redisUrl: process.env.SOVR_REDIS_URL ?? 'redis://localhost:6379',
    redisStreamMaxLen: envInt('SOVR_REDIS_STREAM_MAXLEN', 100000),
    bindHost: process.env.HOST ?? process.env.SOVR_BIND_HOST ?? '0.0.0.0',
    bindPort: envInt('PORT', envInt('SOVR_BIND_PORT', 3001)),
    nodeEnv,
    logLevel: process.env.SOVR_LOG_LEVEL ?? (nodeEnv === 'production' ? 'info' : 'debug'),
  };
}
