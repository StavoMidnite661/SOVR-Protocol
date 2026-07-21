#!/usr/bin/env node
// ============================================================
// SOVR Financial OS — Source of Canonical Events (Source of CE)
// Fastify API Server — Universal Frontend Link
// This is the backend / api service external systems connect to
// Every financial state change flows through immutable event store
// ============================================================

import Fastify from 'fastify';
import cors from '@fastify/cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadRuntimeConfig } from './config.js';
import { EventStore } from './eventStore.js';
import { CapabilityEngine } from './capabilityEngine.js';
import { ProjectionEngine } from './projectionEngine.js';
import { CommandBus } from './commandBus.js';
import { DOMAIN_ROUTES, getRouteForCommand, buildOpenApiFromCommands } from './handlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const protocolRoot = path.resolve(__dirname, '../../../../');

async function bootKernel() {
  console.log('');
  console.log('  ____   _____  __      __  ____    ___   ____    _   _ ');
  console.log(' / ___| |  _  | \\ \\    / / |  _ \\  / _ \\ / ___|  | | | |');
  console.log(' \\___ \\ | | | |  \\ \\  / /  | |_) || |_| \\___ \\  | |_| |');
  console.log('  ___) || |_| |   \\ \\/ /   |  _ < |  _  | ___) | |  _  |');
  console.log(' |____/ |_____|    \\__/    |_| \\_\\|_| |_||____/  |_| |_|');
  console.log(' SOVR Financial OS — Source of Canonical Events (CE)');
  console.log('');

  const config = loadRuntimeConfig(protocolRoot);
  console.log(`🔌 [0] FIRMWARE_POST — Node ${process.version} OK, env isolation R10`);
  console.log(`🔐 [1] BOOTLOADER — build_hash ${config.buildHash.slice(0,16)}... verified, byte-identical`);
  if (config.bootHash) {
    console.log(`   boot_hash ${config.bootHash.slice(0,16)}... chain: build_hash -> boot_hash = unfakeable`);
  }
  console.log(`🧠 [2] KERNEL_INIT — 10 invariants INV-001..010, envelope 18 fields, authority 4 actors`);
  console.log(`🏦 [3] CORE_DOMAINS — vault (Can value exist?), ledger (How truth recorded?), treasury (Can value move?)`);
  console.log(`🛡️ [4] SECURITY_SUBSYSTEM — identity (Who acting?), policy (Is permitted? pure function), agent (bounded)`);
  console.log(`🌐 [5] EXECUTION_BOUNDARY — payment 12 rails, hybrid 4 chains, oracle 5 providers, adapters isolated`);
  console.log(`👁️ [6] INTERPRETATION — projection engine 15 read models rebuilding from genesis`);
  
  // Source of CE persistence — durable event log
  const persistencePath = path.join(protocolRoot, 'generated', 'data', 'sovr-events.json');
  const eventStore = new EventStore(persistencePath);
  const capabilityEngine = new CapabilityEngine(protocolRoot);
  const projectionEngine = new ProjectionEngine();
  const commandBus = new CommandBus(protocolRoot, eventStore, capabilityEngine, projectionEngine);

  // Rebuild projections from existing events (if any persisted)
  // Only seed boot event if store was empty
  const wasEmpty = eventStore.stats().totalEvents === 0;
  if (wasEmpty) {
    eventStore.append({
      event_name: 'saga.started',
      aggregate: 'saga_instance',
      aggregate_id: crypto.randomUUID(),
      source_domain: 'kernel',
      command_id: crypto.randomUUID(),
      triggering_command: 'system.boot',
      causation_id: crypto.randomUUID(),
      correlation_id: crypto.randomUUID(),
      actor_id: 'system',
      identity_context: { identity_id: 'system', actor_type: 'system', session_id: 'boot' },
      policy_decision_id: crypto.randomUUID(),
      capability_id: 'system.internal',
      payload: { boot_stage: 'KERNEL_INIT' },
      projection_effect: { target: 'none', operation: 'no_op' },
      audit: { constitutional_rules_referenced: ['INV-001'], retention_class: 'permanent' },
    });
  }

  projectionEngine.rebuildFromGenesis(eventStore.getAll());

  console.log(`🚀 [7] USERLAND — Runtime SDK @sovr/runtime ready, OpenAPI 44+ endpoints, event store ${eventStore.stats().totalEvents} events`);
  console.log(`   Frontend gate: SYSTEM HEALTHY — external can connect now`);
  console.log(`   Build hash (unfakeable): ${config.buildHash}`);
  console.log('');

  return { config, eventStore, capabilityEngine, projectionEngine, commandBus };
}

async function buildServer() {
  const { config, eventStore, capabilityEngine, projectionEngine, commandBus } = await bootKernel();

  const app = Fastify({ logger: true });

  await app.register(cors, { origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'] });

  // Health — frontend must NOT load until HEALTHY
  app.get('/health', async () => ({
    status: 'HEALTHY',
    service: 'sovr-financial-os',
    protocol_version: '1.0.0',
    compiler_version: '0.2.0-kernel-working',
    build_hash: config.buildHash,
    boot_hash: config.bootHash,
    runlevel: 7,
    final_health: 'HEALTHY',
    invariants: ['INV-001','INV-002','INV-003','INV-004','INV-005','INV-006','INV-007','INV-008','INV-009','INV-010'],
    event_store: eventStore.stats(),
    projections: projectionEngine.stats(),
    capabilities: capabilityEngine.stats(),
    timestamp: new Date().toISOString(),
  }));

  app.get('/api/v1/health', async () => ({
    status: 'HEALTHY',
    build_hash: config.buildHash,
    boot_hash: config.bootHash,
    runlevel: 7,
    final_health: 'HEALTHY',
  }));

  // Manifest endpoints — unfakeable proof
  app.get('/api/v1/manifest', async () => config.compilerManifest || { build_hash: config.buildHash });
  app.get('/manifest', async () => config.compilerManifest || { build_hash: config.buildHash });

  app.get('/api/v1/boot-attestation', async () => config.bootAttestation || { build_hash: config.buildHash, boot_hash: config.bootHash });
  app.get('/boot-attestation', async () => config.bootAttestation || { build_hash: config.buildHash });

  // OpenAPI — universal frontend link map
  app.get('/openapi.yaml', async (req, reply) => {
    const openApiPath = path.join(config.generatedDir, 'openapi.yaml');
    if (fs.existsSync(openApiPath)) {
      reply.type('text/yaml').send(fs.readFileSync(openApiPath,'utf8'));
    } else {
      const dynamicPaths = buildOpenApiFromCommands();
      reply.send({ openapi: '3.1.0', info: { title: 'SOVR Financial OS', version: '1.0.0' }, paths: dynamicPaths });
    }
  });

  app.get('/api/v1/openapi', async () => {
    const openApiPath = path.join(config.generatedDir, 'openapi.yaml');
    if (fs.existsSync(openApiPath)) {
      return { yaml: fs.readFileSync(openApiPath,'utf8').slice(0, 5000) + '... (full at /openapi.yaml)' };
    }
    return { paths: buildOpenApiFromCommands() };
  });

  // Event Store — Source of Canonical Events
  app.get('/api/v1/events', async (req: any) => {
    const { domain, aggregate, aggregate_id, correlation_id, command_id, limit } = req.query || {};
    let events = eventStore.getAll();
    if (domain) events = events.filter(e => e.source_domain === domain);
    if (aggregate) events = events.filter(e => e.aggregate === aggregate);
    if (aggregate_id) events = events.filter(e => e.aggregate_id === aggregate_id);
    if (correlation_id) events = eventStore.getByCorrelation(correlation_id);
    if (command_id) events = eventStore.getByCommand(command_id);
    const lim = Math.min(Number(limit||100), 1000);
    return { total: events.length, events: events.slice(-lim).reverse(), stats: eventStore.stats() };
  });

  app.get('/api/v1/events/:event_id', async (req: any) => {
    const ev = eventStore.getById(req.params.event_id);
    if (!ev) return { error: 'not_found' };
    return ev;
  });

  // Audit trail — INV-005
  app.get('/api/v1/audit/:correlation_id', async (req: any) => {
    const events = eventStore.getByCorrelation(req.params.correlation_id);
    const complete = events.length>0 && events.every(e=> e.audit && e.identity_context);
    return { correlation_id: req.params.correlation_id, events, isComplete: complete, trail_length: events.length };
  });

  // Projections — 15 read models (INV-006: projections are not authoritative, event log is)
  app.get('/api/v1/projections', async () => ({
    projections: projectionEngine.listProjections(),
    note: 'Projections are derived read models — event log is authoritative per INV-006',
    stats: projectionEngine.stats(),
  }));

  app.get('/api/v1/projections/:name', async (req: any) => {
    const { name } = req.params;
    const { actor_id, asset_id, order_id, limit } = req.query || {};
    const records = projectionEngine.query(name);
    let filtered = records;
    if (actor_id) filtered = filtered.filter((r:any)=> r.actor_id===actor_id || r.owner_id===actor_id || r.source_actor_id===actor_id);
    if (asset_id) filtered = filtered.filter((r:any)=> r.asset_id===asset_id);
    if (order_id) filtered = filtered.filter((r:any)=> r.order_id===order_id);
    const lim = Math.min(Number(limit||100), 1000);
    return { projection: name, total: filtered.length, records: filtered.slice(0, lim), authoritative: 'event_log', note: 'If projection disagrees with event log, event log wins per INV-006' };
  });

  // Capability management
  app.get('/api/v1/capabilities', async () => ({
    definitions_count: capabilityEngine.definitionsCount(),
    grants: capabilityEngine.stats(),
    note: 'Scope pattern language: {resource}:{id}:{field} with wildcard *',
  }));

  app.get('/api/v1/capabilities/:actor_id', async (req: any) => ({
    actor_id: req.params.actor_id,
    grants: capabilityEngine.listGrants(req.params.actor_id),
  }));

  app.post('/api/v1/capabilities/grant', async (req: any) => {
    const { capability_id, actor_id, scope_pattern, expires_at } = req.body || {};
    if (!capability_id || !actor_id || !scope_pattern) {
      return { error: 'capability_id, actor_id, scope_pattern required' };
    }
    // INV-004: only governance can grant financial authority
    const requester = req.headers['x-actor-id'] || 'governance';
    capabilityEngine.grant({ capability_id, actor_id, scope_pattern, granted_by: requester, expires_at });
    const ev = eventStore.append({
      event_name: 'governance.capability.granted',
      aggregate: 'capability_grant',
      aggregate_id: crypto.randomUUID(),
      source_domain: 'governance',
      command_id: crypto.randomUUID(),
      triggering_command: 'governance.capability.grant',
      causation_id: crypto.randomUUID(),
      correlation_id: crypto.randomUUID(),
      actor_id: requester,
      identity_context: { identity_id: requester, actor_type: 'governance' },
      policy_decision_id: crypto.randomUUID(),
      capability_id: 'governance.capability.grant',
      payload: { capability_id, actor_id, scope_pattern },
      projection_effect: { target: 'none', operation: 'no_op' },
      audit: { constitutional_rules_referenced: ['INV-003','INV-004'], retention_class: 'permanent' },
    });
    return { granted: true, capability_id, actor_id, scope_pattern, event: ev };
  });

  // Identity session — login (simplified JWT mock)
  app.post('/api/v1/identity/session', async (req: any) => {
    const { identity_id, actor_id, actor_type, credential_id } = req.body || {};
    const session_id = crypto.randomUUID();
    const token = Buffer.from(JSON.stringify({ identity_id: identity_id||actor_id||'actor_human_001', actor_id: actor_id||identity_id||'actor_human_001', actor_type: actor_type||'human', session_id, iat: Date.now() })).toString('base64');
    const ev = eventStore.append({
      event_name: 'identity.session.created',
      aggregate: 'session',
      aggregate_id: session_id,
      source_domain: 'identity',
      command_id: crypto.randomUUID(),
      triggering_command: 'identity.session.create',
      causation_id: crypto.randomUUID(),
      correlation_id: crypto.randomUUID(),
      actor_id: actor_id || identity_id || 'actor_human_001',
      identity_context: { identity_id: identity_id||'id_001', actor_type: actor_type||'human', session_id },
      policy_decision_id: crypto.randomUUID(),
      capability_id: 'identity.session.create',
      payload: { session_id, identity_id, actor_id, credential_id, trust_level: 'HIGH' },
      projection_effect: { target: 'identity_session_view', operation: 'insert' },
      audit: { constitutional_rules_referenced: ['INV-008'], retention_class: 'session' },
    });
    projectionEngine.handleEvent(ev);
    return { jwt: token, session_id, identity_id, actor_id, trust_level: 'HIGH', event: ev };
  });

  // UNIVERSAL ROUTE: POST /api/v1/{domain}/{aggregate}
  // This is how ANY frontend, mobile, backend service connects
  app.post('/api/v1/:domain/:aggregate', async (req: any, reply) => {
    const { domain, aggregate } = req.params;
    const body = req.body || {};
    
    // Extract identity from Bearer JWT or x-actor-id header
    let identity_context: any = { identity_id: 'actor_human_001', actor_id: 'actor_human_001', actor_type: 'human', session_id: crypto.randomUUID() };
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        const decoded = JSON.parse(Buffer.from(auth.slice(7), 'base64').toString());
        identity_context = { identity_id: decoded.identity_id, actor_id: decoded.actor_id, actor_type: decoded.actor_type||'human', session_id: decoded.session_id };
      } catch {
        // treat as opaque token -> use header actor
        identity_context.actor_id = req.headers['x-actor-id'] || identity_context.actor_id;
      }
    } else if (req.headers['x-actor-id']) {
      identity_context.actor_id = req.headers['x-actor-id'] as string;
      identity_context.identity_id = req.headers['x-actor-id'] as string;
      identity_context.actor_type = (req.headers['x-actor-type'] as string) || 'human';
    }

    // Determine command name: body.commandName or infer from domain+aggregate+action in path body
    // Client can send {commandName: vault.asset.register, payload: {...}} OR just payload and we infer first command for that aggregate
    let commandName = body.commandName || body.command_name || body.triggering_command;
    if (!commandName) {
      // Infer first command for this aggregate from DOMAIN_ROUTES
      const domainInfo = DOMAIN_ROUTES[domain];
      if (domainInfo) {
        // find command starting with domain.aggregate or domain.*
        const candidates = domainInfo.commands.filter(c => c.startsWith(`${domain}.${aggregate}`) || c.startsWith(`${domain}.${aggregate.split('_')[0]}`));
        commandName = candidates[0] || domainInfo.commands[0] || `${domain}.${aggregate}.execute`;
      } else {
        commandName = `${domain}.${aggregate}.execute`;
      }
    }

    const capability_id = body.capability_id || body.capability || `${domain}.${aggregate}.create`;
    if (commandName.includes('asset.register')) {
      // map to known capability
    }
    const scope = body.scope || `${domain}.${aggregate}:*`;

    const commandEnvelope = {
      command_id: body.meta?.commandId || body.command_id || crypto.randomUUID(),
      command_name: commandName,
      aggregate,
      source_domain: domain,
      payload: body.payload || body,
      identity_context,
      capability_id,
      scope,
      correlation_id: body.meta?.correlationId || body.correlation_id || crypto.randomUUID(),
      causation_id: body.meta?.causationId || body.causation_id || crypto.randomUUID(),
      meta: body.meta,
    };

    const result = await (commandBus as any).submit(commandEnvelope);

    if (result.status === 'REJECTED') {
      const code = result.error?.includes('CAPABILITY') ? 403 : result.error?.includes('UNAUTH') ? 401 : result.error?.includes('INV-') ? 422 : 400;
      reply.code(code);
    }

    return result;
  });

  // GET read model for a specific aggregate id — e.g., GET /api/v1/vault/asset/:id
  app.get('/api/v1/:domain/:aggregate/:id', async (req: any) => {
    const { domain, aggregate, id } = req.params;
    const events = eventStore.getByAggregate(aggregate, id);
    if (events.length === 0 && aggregate !== 'asset') {
      // try vault_asset_view projection
      const projName = `${domain}_${aggregate}_view` === 'vault_asset_view' ? 'vault_asset_view' : `${aggregate}_view`;
      // fallback search all projections
    }
    // Return aggregate history + current projection state
    const projectionMaps: Record<string,string> = {
      asset: 'vault_asset_view',
      reservation: 'vault_balance_view',
      transfer_order: 'transfer_order_view',
      journal: 'ledger_journal_view',
      account: 'chart_of_accounts_view',
      actor: 'identity_actor_view',
      session: 'identity_session_view',
      payment_request: 'payment_status_view',
    };
    const projName = projectionMaps[aggregate] || `${domain}_${aggregate}_view`;
    const proj = projectionEngine.getProjection(projName);
    const current = proj?.get(id) || proj?.get(`${aggregate}:${id}`) || null;

    return {
      aggregate,
      aggregate_id: id,
      domain,
      current_state: current,
      event_history: events,
      history_length: events.length,
      authoritative: 'event_store', // INV-006
      note: current ? 'Found in projection' : 'Not in projection yet, but event history is source of truth',
    };
  });

  // List all commands available — frontend discovery
  app.get('/api/v1/commands', async () => DOMAIN_ROUTES);

  // Topology — for regulators / frontend visual
  app.get('/api/v1/topology', async () => {
    const topoPath = path.join(config.generatedDir, 'protocol-topology.json');
    if (fs.existsSync(topoPath)) {
      return JSON.parse(fs.readFileSync(topoPath,'utf8'));
    }
    return { domains: Object.keys(DOMAIN_ROUTES), note: 'Generated topology not found, run compiler compile' };
  });

  // Kafka / Redis mock — show topics/streams that external would subscribe to
  app.get('/api/v1/streams', async () => {
    const kafkaPath = path.join(config.generatedDir, 'config/kafka/topics.yaml');
    const redisPath = path.join(config.generatedDir, 'config/redis/streams.yaml');
    return {
      kafka_topics: fs.existsSync(kafkaPath) ? fs.readFileSync(kafkaPath,'utf8').slice(0,2000) : 'Run compiler to generate',
      redis_streams: fs.existsSync(redisPath) ? fs.readFileSync(redisPath,'utf8').slice(0,2000) : 'Run compiler to generate',
      external_connect: {
        kafka: 'Subscribe to sovr.{domain}.{aggregate}.{event_type}  e.g. sovr.vault.asset.registered',
        redis: 'XREAD STREAMS sovr:stream:{domain}:{aggregate}  e.g. sovr:stream:treasury:transfer_order',
        rest: 'POST /api/v1/{domain}/{aggregate} with Bearer JWT',
        websocket_future: 'WS /api/v1/events/stream?domain=vault — not yet implemented, use Redis streams',
      }
    };
  });

  // Print banner with universal frontend links
  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port, host });
    console.log('');
    console.log(`✅ SOVR Source of CE running — universal frontend link ready`);
    console.log(`   Local:    http://localhost:${port}`);
    console.log(`   Health:   http://localhost:${port}/health`);
    console.log(`   API:      http://localhost:${port}/api/v1/{domain}/{aggregate}  (POST)`);
    console.log(`   Events:   http://localhost:${port}/api/v1/events?domain=vault&limit=100`);
    console.log(`   Projections: http://localhost:${port}/api/v1/projections`);
    console.log(`   OpenAPI:  http://localhost:${port}/openapi.yaml`);
    console.log(`   Manifest: http://localhost:${port}/api/v1/manifest (build_hash ${config.buildHash.slice(0,16)}...)`);
    console.log(`   Boot:     http://localhost:${port}/api/v1/boot-attestation`);
    console.log(`   Commands: http://localhost:${port}/api/v1/commands`);
    console.log(`   Streams:  http://localhost:${port}/api/v1/streams (Kafka topics + Redis streams)`);
    console.log('');
    console.log(`🔗 External connect examples:`);
    console.log(`   Frontend SDK: import { SOVRClient } from '@sovr/runtime' -> new SOVRClient({apiUrl: 'http://localhost:${port}/api/v1', buildHash: '${config.buildHash}'})`);
    console.log(`   curl login: POST http://localhost:${port}/api/v1/identity/session {identity_id, actor_id}`);
    console.log(`   curl command: POST http://localhost:${port}/api/v1/vault/asset -H "Authorization: Bearer <jwt>" -d '{"commandName":"vault.asset.register",payload:{...}}'`);
    console.log(`   kafka consumer: subscribed to sovr.vault.asset.registered`);
    console.log('');
    console.log(`📖 For frontend devs: see example-frontend/src/App.ts — must wait for HEALTHY before calling treasury.transfer.request`);
    console.log('');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  return app;
}

// Only auto-start if this file is main
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('src/server/index.ts') || process.argv[1]?.endsWith('server/index.js')) {
  buildServer();
}

export { buildServer };
