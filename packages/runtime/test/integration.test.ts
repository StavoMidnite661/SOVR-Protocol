// ============================================================
// SOVR Runtime — Integration tests (real HTTP, real EventStore,
// real 7-stage pipeline, real JWT, real WebSocket, real ACH adapter).
// Runs against a server started in-process on a free port.
// ============================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawn, ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { SOVRClient, SOVRApiError } from '../src/sdk/client.js';
import { SOVRJwt } from '../src/server/jwt.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const SERVER_ENTRY = path.resolve(__dirname, '../dist/server/index.js');
const SOVR_PROTOCOL_ROOT = REPO_ROOT;
const TEST_PORT = 3399 + Math.floor(Math.random() * 100);
const JWT_SECRET = 'integration-test-secret-32-bytes-min-padding-aaaaaaaaaaa';

let server: ChildProcess;
let client: SOVRClient;

async function waitForHealth(url: string, maxMs = 30_000) {
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

beforeAll(async () => {
  server = spawn(process.execPath, [SERVER_ENTRY], {
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      NODE_ENV: 'test',
      SOVR_JWT_SECRET: JWT_SECRET,
      SOVR_DEV_AUTO_GRANT: 'true',
      SOVR_PROTOCOL_ROOT: SOVR_PROTOCOL_ROOT,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout?.on('data', (d) => process.stdout.write(`[server] ${d}`));
  server.stderr?.on('data', (d) => process.stderr.write(`[server-err] ${d}`));
  await waitForHealth(`http://localhost:${TEST_PORT}/health`);
  client = new SOVRClient({
    apiUrl: `http://localhost:${TEST_PORT}`,
    actorId: 'test_alice',
    actorType: 'human',
    timeoutMs: 10_000,
  });
}, 60_000);

afterAll(async () => {
  if (server && !server.killed) {
    server.kill('SIGTERM');
    await new Promise<void>((res) => server.on('exit', () => res()));
  }
});

beforeEach(async () => { await delay(50); });

// ----------------------------------------------------------------------------
// Health & provenance
// ----------------------------------------------------------------------------

describe('health and provenance', () => {
  it('returns final_health HEALTHY with computed subsystem detail', async () => {
    const r = await fetch(`http://localhost:${TEST_PORT}/health`);
    expect(r.ok).toBe(true);
    const j: any = await r.json();
    expect(j.final_health).toBe('HEALTHY');
    expect(j.subsystems.event_store.ok).toBe(true);
    expect(j.subsystems.capabilities.ok).toBe(true);
    expect(j.subsystems.projections.ok).toBe(true);
    expect(j.subsystems.build_provenance.ok).toBe(true);
    expect(j.invariants).toEqual(expect.arrayContaining(['INV-001', 'INV-010']));
  });

  it('manifest and attestation build_hashes match (unfakeable chain)', async () => {
    const m: any = await (await fetch(`http://localhost:${TEST_PORT}/api/v1/manifest`)).json();
    const a: any = await (await fetch(`http://localhost:${TEST_PORT}/api/v1/boot-attestation`)).json();
    expect(m.build_hash).toBeTruthy();
    expect(m.build_hash).toBe(a.build_hash);
  });
});

// ----------------------------------------------------------------------------
// JWT
// ----------------------------------------------------------------------------

describe('JWT (real HMAC-SHA256)', () => {
  it('produces a 3-part JWT with valid HS256 signature', async () => {
    const r: any = await (await fetch(`http://localhost:${TEST_PORT}/api/v1/identity/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity_id: 'jwt_test', actor_id: 'jwt_test', actor_type: 'human' }),
    })).json();
    expect(r.jwt).toBeTruthy();
    expect(r.jwt.split('.').length).toBe(3);
    const [h, p] = r.jwt.split('.');
    const header = JSON.parse(Buffer.from(h, 'base64url').toString());
    expect(header.alg).toBe('HS256');
    expect(header.typ).toBe('JWT');
    const jwt = new SOVRJwt({ secret: JWT_SECRET });
    const result = jwt.verify(r.jwt);
    expect(result.valid).toBe(true);
    expect(result.payload?.actor_id).toBe('jwt_test');
  });

  it('rejects a tampered JWT (bad signature)', () => {
    const jwt = new SOVRJwt({ secret: JWT_SECRET });
    const token = jwt.signPayload({ sub: 'x', identity_id: 'x', actor_id: 'x', actor_type: 'human', session_id: 's' });
    const parts = token.split('.');
    parts[2] = parts[2].slice(0, -2) + (parts[2].endsWith('a') ? 'bb' : 'aa');
    const tampered = parts.join('.');
    const result = jwt.verify(tampered);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('bad_signature');
  });

  it('rejects a JWT signed with a different secret', () => {
    const jwtA = new SOVRJwt({ secret: 'secret-A-32-bytes-padding-padding-padding-pad' });
    const jwtB = new SOVRJwt({ secret: 'secret-B-32-bytes-padding-padding-padding-pad' });
    const token = jwtA.signPayload({ sub: 'x', identity_id: 'x', actor_id: 'x', actor_type: 'human', session_id: 's' });
    const result = jwtB.verify(token);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('bad_signature');
  });

  it('rejects an expired JWT (no clock skew)', async () => {
    const jwt = new SOVRJwt({ secret: JWT_SECRET, defaultTtlSeconds: 0 });
    const token = jwt.signPayload({ sub: 'x', identity_id: 'x', actor_id: 'x', actor_type: 'human', session_id: 's' });
    // Wait long enough for clock to advance past the 0-TTL expiration window
    await delay(1100);
    const result = jwt.verify(token, { clockSkewSeconds: 0 });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired');
  });
});

// ----------------------------------------------------------------------------
// 7-stage pipeline
// ----------------------------------------------------------------------------

describe('7-stage pipeline (real flow)', () => {
  beforeAll(async () => {
    await client.createSession({ identity_id: 'flow_alice', actor_id: 'flow_alice', actor_type: 'human' });
  });

  it('REJECTS unknown command and emits system.command.unknown event', async () => {
    let err: SOVRApiError | null = null;
    try {
      await client.executeCommand('vault', 'asset', { commandName: 'vault.does.not.exist', payload: {} });
    } catch (e) { err = e as SOVRApiError; }
    expect(err).toBeInstanceOf(SOVRApiError);
    // 400 from server
    expect(err!.statusCode).toBe(400);
    expect(err!.body.events.length).toBe(1);
    expect(err!.body.events[0].event_name).toBe('system.command.unknown');
  });

  it('REJECTS when required_payload is missing (real validation)', async () => {
    await client.grantCapability({ capabilityId: 'vault.asset.create', actorId: 'flow_alice', scopePattern: 'vault.asset:*' });
    let err: SOVRApiError | null = null;
    try {
      await client.executeCommand('vault', 'asset', { commandName: 'vault.asset.register', payload: {} });
    } catch (e) { err = e as SOVRApiError; }
    expect(err).toBeInstanceOf(SOVRApiError);
    expect(err!.statusCode).toBe(400);
    expect(err!.body.error).toMatch(/VALIDATION.*required field/);
  });

  it('REJECTS ai_agent actor type on governance grant (INV-004)', async () => {
    const agentClient = new SOVRClient({
      apiUrl: `http://localhost:${TEST_PORT}`,
      actorId: 'evil_agent',
      actorType: 'ai_agent',
    });
    await agentClient.createSession({ identity_id: 'evil_agent', actor_id: 'evil_agent', actor_type: 'ai_agent' });
    let err: SOVRApiError | null = null;
    try {
      await agentClient.executeCommand('governance', 'capability_grant', {
        commandName: 'governance.capability.grant',
        payload: { capability_id: 'vault.asset.create', actor_id: 'evil_agent', scope_pattern: 'vault.asset:*' },
      });
    } catch (e) { err = e as SOVRApiError; }
    expect(err).toBeInstanceOf(SOVRApiError);
    // 403 from server
    expect([403, 422]).toContain(err!.statusCode);
    expect(err!.body.error).toMatch(/UNAUTHORIZED ACTOR TYPE|INV-004/);
  });

  it('ACCEPTS a valid asset register and emits the event end-to-end', async () => {
    const assetId = `test_asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const r = await client.registerAsset({
      assetId,
      assetType: 'stablecoin',
      issuerId: 'flow_alice',
      ownershipId: 'flow_alice',
      custodyProvider: 'sovr_internal',
      custodyLocation: 'sovr_internal_vault_1',
      nativeUnit: 'wei',
      precision: 18,
      valuationSource: 'chainlink',
      reserveRatio: '1.0',
    });
    expect(r.status).toBe('ACCEPTED');
    expect(r.events.length).toBe(1);
    expect(r.events[0].event_name).toBe('vault.asset.registered');
    expect(r.events[0].aggregate_id).toBe(assetId);

    // Round-trip via event log
    const events: any = await client.listEvents({ domain: 'vault', aggregate: 'asset', limit: 200 });
    const found = events.events.find((e: any) => e.aggregate_id === assetId);
    expect(found).toBeTruthy();

    // Round-trip via projection
    const proj: any = await client.queryProjection('vault_asset_view', { assetId });
    expect(proj.records.length).toBeGreaterThanOrEqual(1);
    expect(proj.records.find((r: any) => r.asset_id === assetId)).toBeTruthy();
  });
});

// ----------------------------------------------------------------------------
// INV-002 double-entry
// ----------------------------------------------------------------------------

describe('INV-002 double-entry (live)', () => {
  beforeAll(async () => {
    await client.createSession({ identity_id: 'ledger_alice', actor_id: 'ledger_alice', actor_type: 'human' });
    await client.grantCapability({ capabilityId: 'ledger.journal_entry.create', actorId: 'ledger_alice', scopePattern: 'ledger.journal_entry:*' });
  });

  it('ACCEPTS balanced postings', async () => {
    const r = await client.postLedgerEntry({
      journalId: `j_test_${Date.now()}_bal`,
      postings: [
        { direction: 'DEBIT', account_id: 'a1', amount: 100 },
        { direction: 'CREDIT', account_id: 'a2', amount: 100 },
      ],
    });
    expect(r.status).toBe('ACCEPTED');
  });

  it('REJECTS unbalanced postings with INV-002 message', async () => {
    let err: SOVRApiError | null = null;
    try {
      await client.postLedgerEntry({
        journalId: `j_test_${Date.now()}_unbal`,
        postings: [
          { direction: 'DEBIT', account_id: 'a1', amount: 100 },
          { direction: 'CREDIT', account_id: 'a2', amount: 50 },
        ],
      });
    } catch (e) { err = e as SOVRApiError; }
    expect(err).toBeInstanceOf(SOVRApiError);
    expect(err!.statusCode).toBe(422);
    expect(err!.body.error).toMatch(/INV-002 VIOLATION/);
  });
});

// ----------------------------------------------------------------------------
// WebSocket
// ----------------------------------------------------------------------------

describe('WebSocket event stream', () => {
  it('delivers events to a connected WS client with filter', async () => {
    const wsClient = new SOVRClient({
      apiUrl: `http://localhost:${TEST_PORT}`,
      actorId: 'ws_alice',
      actorType: 'human',
    });
    await wsClient.createSession({ identity_id: 'ws_alice', actor_id: 'ws_alice', actor_type: 'human' });
    await wsClient.grantCapability({ capabilityId: 'vault.asset.create', actorId: 'ws_alice', scopePattern: 'vault.asset:*' });

    const received: any[] = [];
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}/api/v1/events/stream?domain=vault`);
    const helloPromise = new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('hello timeout')), 5000);
      ws.once('message', (m) => {
        const j = JSON.parse(m.toString());
        if (j.type === 'hello') { clearTimeout(t); resolve(); }
      });
      ws.once('error', (e) => { clearTimeout(t); reject(e); });
    });
    await helloPromise;
    ws.on('message', (m) => {
      const j = JSON.parse(m.toString());
      if (j.type === 'event' && j.envelope.event_name === 'vault.asset.registered') {
        received.push(j.envelope);
      }
    });
    await delay(100);

    const assetId = `ws_asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const r = await wsClient.registerAsset({
      assetId, assetType: 'stablecoin',
      issuerId: 'ws_alice', ownershipId: 'ws_alice',
      custodyProvider: 'sovr_internal', custodyLocation: 'sovr_internal_vault_1',
      nativeUnit: 'wei', precision: 18, valuationSource: 'chainlink', reserveRatio: '1.0',
    });
    expect(r.status).toBe('ACCEPTED');

    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && received.length === 0) await delay(50);
    ws.close();

    expect(received.length).toBeGreaterThan(0);
    expect(received[0].aggregate_id).toBe(assetId);
  });
});

// ----------------------------------------------------------------------------
// ACH boundary adapter
// ----------------------------------------------------------------------------

describe('ACH boundary adapter (real)', () => {
  it('prepare → execute → confirm emits 3 events with full envelope', async () => {
    const prepRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/payment/rail/ACH/prepare`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_request_id: `pr_${Date.now()}`, amount: '100' }),
    });
    expect(prepRes.ok).toBe(true);
    const prep: any = await prepRes.json();
    expect(prep.railPreparationId).toMatch(/^ach-prep-/);
    expect(prep.fees).toBe('0.10');

    const execRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/payment/rail/ACH/execute`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rail_preparation_id: prep.railPreparationId }),
    });
    expect(execRes.ok).toBe(true);
    const exec: any = await execRes.json();
    expect(exec.railExecutionId).toMatch(/^ach-exec-/);
    expect(exec.railReferenceId).toMatch(/^ACH-/);

    const confRes = await fetch(`http://localhost:${TEST_PORT}/api/v1/payment/rail/ACH/confirm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rail_execution_id: exec.railExecutionId }),
    });
    expect(confRes.ok).toBe(true);
    const conf: any = await confRes.json();
    expect(conf.confirmed).toBe(true);

    // Verify the 3 events made it to the event log with 21-field envelope
    const evs: any = await (await fetch(`http://localhost:${TEST_PORT}/api/v1/events?domain=payment&limit=200`)).json();
    const names = evs.events.map((e: any) => e.event_name);
    expect(names).toContain('payment.rail.prepared');
    expect(names).toContain('payment.rail.executed');
    expect(names).toContain('payment.rail.confirmed');
    const sample = evs.events[0];
    expect(Object.keys(sample).length).toBe(21);
    expect(sample.schema_version).toBe('1.0.0');
  });

  it('REJECTS unknown rail type with 404 and unknown_rail error', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/v1/payment/rail/UNKNOWN_RAIL/prepare`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_request_id: 'x', amount: '1' }),
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
    const j: any = await res.json();
    expect(j.error).toBe('unknown_rail');
    expect(j.supported).toContain('ACH');
  });
});

// ----------------------------------------------------------------------------
// SDK error surfacing
// ----------------------------------------------------------------------------

describe('SDK error surfacing', () => {
  it('throws SOVRApiError on 4xx with parsed body', async () => {
    const c = new SOVRClient({ apiUrl: `http://localhost:${TEST_PORT}` });
    await c.createSession({ identity_id: 'err', actor_id: 'err', actor_type: 'human' });
    await c.grantCapability({ capabilityId: 'ledger.journal_entry.create', actorId: 'err', scopePattern: 'ledger.journal_entry:*' });
    let err: SOVRApiError | null = null;
    try {
      await c.postLedgerEntry({
        journalId: 'j_err',
        postings: [
          { direction: 'DEBIT', account_id: 'a', amount: 1 },
          { direction: 'CREDIT', account_id: 'b', amount: 2 },
        ],
      });
    } catch (e) { err = e as SOVRApiError; }
    expect(err).toBeInstanceOf(SOVRApiError);
    expect(err!.statusCode).toBe(422);
    expect(err!.body.status).toBe('REJECTED');
  });
});
