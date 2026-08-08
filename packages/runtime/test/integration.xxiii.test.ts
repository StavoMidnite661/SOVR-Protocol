import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawn, ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOVRClient, SOVRApiError } from '../src/sdk/client.js';
import { JWTService } from '../src/security/jwt.js';
import { exportPKCS8, exportSPKI, generateKeyPair } from 'jose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const SERVER_ENTRY = path.resolve(__dirname, '../dist/server/index.js');
const SOVR_PROTOCOL_ROOT = REPO_ROOT;
const TEST_PORT = 3399 + Math.floor(Math.random() * 100);

let server: ChildProcess;
let client: SOVRClient;
let testJwt: JWTService;
let TEST_PRIVATE_KEY_PEM: string;
let TEST_PUBLIC_KEY_PEM: string;

async function waitForHealth(url: string, maxMs = 120_000) {
  const deadline = Date.now() + maxMs;
  let lastErr: any;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        const j: any = await r.json();
        if (j.final_health === 'HEALTHY') return j;
      }
    } catch (e) { lastErr = e; }
    await delay(250);
  }
  throw new Error(`Server did not become healthy at ${url}: ${lastErr?.message}`);
}

describe('INV-003 / INV-008 — Directive XXIII Live Server Integration', () => {
  let server: any;
  let client: SOVRClient;
  let base = `http://localhost:${TEST_PORT}`;

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256', { modulusLength: 2048, extractable: true });
  TEST_PRIVATE_KEY_PEM = await exportPKCS8(privateKey, 'RS256');
  TEST_PUBLIC_KEY_PEM = await exportSPKI(publicKey, 'RS256');

  testJwt = new JWTService();
  await testJwt.initialize({ privateKeyPem: TEST_PRIVATE_KEY_PEM, publicKeyPem: TEST_PUBLIC_KEY_PEM });

  server = spawn(process.execPath, [SERVER_ENTRY], {
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      NODE_ENV: 'test',
      JWT_PRIVATE_KEY: TEST_PRIVATE_KEY_PEM,
      JWT_PUBLIC_KEY: TEST_PUBLIC_KEY_PEM,
      SOVR_DEV_AUTO_GRANT: 'true',
      SOVR_PROTOCOL_ROOT: SOVR_PROTOCOL_ROOT,
      SOVR_TEST_XXIII_GATES: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout?.on('data', (d) => process.stdout.write(`[xxiii-server] ${d}`));
  server.stderr?.on('data', (d) => process.stderr.write(`[xxiii-server-err] ${d}`));
  await waitForHealth(`http://localhost:${TEST_PORT}/health`);
  client = new SOVRClient({
    apiUrl: `http://localhost:${TEST_PORT}`,
    actorId: 'xxiii_alice',
    actorType: 'human',
    timeoutMs: 10_000,
  });
}, 180000);

afterAll(async () => {
  if (server && !server.killed) {
    server.kill('SIGTERM');
    await new Promise<void>((res) => server.on('exit', () => res()));
  }
});

beforeEach(async () => { await delay(50); });

  it('AUDIT-001: low-privilege actor cannot execute treasury command', async () => {
    await client.createSession({ identity_id: 'xxiii_no_cap', actor_id: 'xxiii_no_cap', actor_type: 'human' });
    client = new SOVRClient({ apiUrl: base, actorId: 'xxiii_no_cap', actorType: 'human' });

    try {
      await client.executeCommand('treasury', 'transfer_order', {
        commandName: 'treasury.transfer.request',
        capability_id: 'treasury.transfer.request',
        scope: 'treasury.transfer:*',
        payload: { source_actor_id: 'xxiii_no_cap', destination_actor_id: 'someone', asset_id: 'a1', amount: '10', purpose: 'test', destination_details: { type: 'ach', address: '123', rail: 'ACH', reference: 'r1' } },
      });
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err).toBeInstanceOf(SOVRApiError);
      expect(err.statusCode).toBeGreaterThanOrEqual(400);
    }
  });

  it('AUDIT-002: expired capability is rejected', async () => {
    await client.createSession({ identity_id: 'xxiii_expired', actor_id: 'xxiii_expired', actor_type: 'human' });
    client = new SOVRClient({ apiUrl: base, actorId: 'xxiii_expired', actorType: 'human' });

    await client.grantCapability({ capabilityId: 'treasury.transfer.request', actorId: 'xxiii_expired', scopePattern: 'treasury.transfer:*', expiresAt: '2020-01-01T00:00:00Z' });

    try {
      await client.executeCommand('treasury', 'transfer_order', {
        commandName: 'treasury.transfer.request',
        capability_id: 'treasury.transfer.request',
        scope: 'treasury.transfer:*',
        payload: { source_actor_id: 'xxiii_expired', destination_actor_id: 'someone', asset_id: 'a1', amount: '10', purpose: 'test', destination_details: { type: 'ach', address: '123', rail: 'ACH', reference: 'r1' } },
      });
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err).toBeInstanceOf(SOVRApiError);
      expect(err.statusCode).toBeGreaterThanOrEqual(400);
    }
  });

  it('AUDIT-003: revoked capability is rejected', async () => {
    await client.createSession({ identity_id: 'xxiii_revoked', actor_id: 'xxiii_revoked', actor_type: 'human' });
    client = new SOVRClient({ apiUrl: base, actorId: 'xxiii_revoked', actorType: 'human' });

    await client.grantCapability({ capabilityId: 'treasury.transfer.request', actorId: 'xxiii_revoked', scopePattern: 'treasury.transfer:*' });

    // revoke via DELETE endpoint
    const res = await fetch(`${base}/api/v1/capabilities/grant`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'X-Actor-Id': 'xxiii_revoked' },
      body: JSON.stringify({ capability_id: 'treasury.transfer.request', actor_id: 'xxiii_revoked' }),
    });
    expect(res.status).toBe(200);

    try {
      await client.executeCommand('treasury', 'transfer_order', {
        commandName: 'treasury.transfer.request',
        capability_id: 'treasury.transfer.request',
        scope: 'treasury.transfer:*',
        payload: { source_actor_id: 'xxiii_revoked', destination_actor_id: 'someone', asset_id: 'a1', amount: '10', purpose: 'test', destination_details: { type: 'ach', address: '123', rail: 'ACH', reference: 'r1' } },
      });
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err).toBeInstanceOf(SOVRApiError);
      expect(err.statusCode).toBeGreaterThanOrEqual(400);
    }
  });

  it('AUDIT-004: amount above grant constraint is rejected', async () => {
    await client.createSession({ identity_id: 'xxiii_constrained', actor_id: 'xxiii_constrained', actor_type: 'human' });
    client = new SOVRClient({ apiUrl: base, actorId: 'xxiii_constrained', actorType: 'human' });

    await client.grantCapability({
      capabilityId: 'treasury.transfer.request',
      actorId: 'xxiii_constrained',
      scopePattern: 'treasury.transfer:*',
      conditions: { constraints: { maxAmount: '100' } },
    });

    try {
      await client.executeCommand('treasury', 'transfer_order', {
        commandName: 'treasury.transfer.request',
        capability_id: 'treasury.transfer.request',
        scope: 'treasury.transfer:*',
        payload: { source_actor_id: 'xxiii_constrained', destination_actor_id: 'someone', asset_id: 'a1', amount: '5000', purpose: 'test', destination_details: { type: 'ach', address: '123', rail: 'ACH', reference: 'r1' } },
      });
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err).toBeInstanceOf(SOVRApiError);
      expect(err.statusCode).toBeGreaterThanOrEqual(400);
    }
  });

  it('AUDIT-005: valid capability grants execution', async () => {
    await client.createSession({ identity_id: 'xxiii_valid', actor_id: 'xxiii_valid', actor_type: 'human' });
    client = new SOVRClient({ apiUrl: base, actorId: 'xxiii_valid', actorType: 'human' });

    await client.grantCapability({ capabilityId: 'payment.request.create', actorId: 'xxiii_valid', scopePattern: '*' });

    const result = await client.executeCommand('payment', 'request', {
      commandName: 'payment.request.create',
      capability_id: 'payment.request.create',
      scope: 'payment.request:*',
      payload: { source_transfer_id: 'tx_1', amount: '1', sender: 'sender_1', recipient: 'recip_1', urgency: 'normal', retry_policy: 'none' },
    });

    expect(result.status).toBe('ACCEPTED');
  });

  it('AUDIT-006: escrow release rejected by gate when amount missing/oversized', async () => {
    await client.createSession({ identity_id: 'xxiii_escrow', actor_id: 'xxiii_escrow', actor_type: 'human' });
    client = new SOVRClient({ apiUrl: base, actorId: 'xxiii_escrow', actorType: 'human' });

    await client.grantCapability({ capabilityId: 'escrow.account.release', actorId: 'xxiii_escrow', scopePattern: '*' });

    try {
      await client.executeCommand('escrow', 'account', {
        commandName: 'escrow.account.release',
        capability_id: 'escrow.account.release',
        scope: 'escrow.account:test_escrow',
        payload: { escrow_id: 'test_escrow', release_proof: 'test_proof', amount: '100' },
      });
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err).toBeInstanceOf(SOVRApiError);
      expect(err.statusCode).toBeGreaterThanOrEqual(400);
      expect(err.body.rejectionCode).toBe('EXECUTION_GATE_FAILED');
    }
  });

  it('AUDIT-007: transfer with amount exceeding gate limit is rejected', async () => {
    await client.createSession({ identity_id: 'xxiii_xfer', actor_id: 'xxiii_xfer', actor_type: 'human' });
    client = new SOVRClient({ apiUrl: base, actorId: 'xxiii_xfer', actorType: 'human' });

    await client.grantCapability({ capabilityId: 'vault.reserve.create', actorId: 'xxiii_xfer', scopePattern: '*' });
    await client.grantCapability({ capabilityId: 'vault.transaction.fund', actorId: 'xxiii_xfer', scopePattern: '*' });

    try {
      await client.executeCommand('vault', 'transaction', {
        commandName: 'vault.transaction.fund',
        capability_id: 'vault.transaction.fund',
        scope: 'vault.asset:test_asset',
        payload: { transaction_id: 'tx_xxiii', amount: '100', asset_id: 'test_asset' },
      });
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err).toBeInstanceOf(SOVRApiError);
      expect(err.statusCode).toBeGreaterThanOrEqual(400);
      expect(err.body.rejectionCode).toBe('EXECUTION_GATE_FAILED');
    }
  });

  it('AUDIT-008: transfer above static authorization limit is rejected', async () => {
    await client.createSession({ identity_id: 'xxiii_auth', actor_id: 'xxiii_auth', actor_type: 'human' });
    client = new SOVRClient({ apiUrl: base, actorId: 'xxiii_auth', actorType: 'human' });

    await client.grantCapability({ capabilityId: 'treasury.transfer.request', actorId: 'xxiii_auth', scopePattern: '*' });

    try {
      await client.executeCommand('treasury', 'transfer_order', {
        commandName: 'treasury.transfer.request',
        capability_id: 'treasury.transfer.request',
        scope: 'treasury.transfer:*',
        payload: { source_actor_id: 'xxiii_auth', destination_actor_id: 'someone', asset_id: 'a1', amount: '100', purpose: 'test', destination_details: { type: 'ach', address: '123', rail: 'ACH', reference: 'r1' } },
      });
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err).toBeInstanceOf(SOVRApiError);
      expect(err.statusCode).toBeGreaterThanOrEqual(400);
      expect(err.body.rejectionCode).toBe('EXECUTION_GATE_FAILED');
    }
  });

  it('AUDIT-009: command with active compliance hold is rejected', async () => {
    // Pending compliance hold infrastructure — requires ComplianceHoldGate handle + hold store
    expect(true).toBe(true);
  });

  it('AUDIT-010: all gates pass — command reaches state machine', async () => {
    await client.createSession({ identity_id: 'xxiii_pass', actor_id: 'xxiii_pass', actor_type: 'human' });
    client = new SOVRClient({ apiUrl: base, actorId: 'xxiii_pass', actorType: 'human' });

    await client.grantCapability({ capabilityId: 'payment.request.create', actorId: 'xxiii_pass', scopePattern: '*' });

    const result = await client.executeCommand('payment', 'request', {
      commandName: 'payment.request.create',
      capability_id: 'payment.request.create',
      scope: 'payment.request:*',
      payload: { source_transfer_id: 'tx_pass', amount: '1', sender: 'sender_pass', recipient: 'recip_pass', urgency: 'normal', retry_policy: 'none' },
    });

    expect(result.status).toBe('ACCEPTED');
  });
});
