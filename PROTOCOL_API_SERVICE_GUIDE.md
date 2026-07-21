# SOVR Protocol API Service — Source of Canonical Events (CE)

**Separation of Concerns — Final Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│ Explorer = Frontend / Operator Console                      │
│   Runs on :3000 (React, Vue, mobile, etc)                   │
│   Imports generated/src/types/* (machine-readable)          │
│   Uses SOVRClient SDK @sovr/runtime                         │
│   MUST wait for HEALTHY before financial commands           │
│   Connects via REST /api/v1 to Protocol API                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP Bearer JWT + capability_id + scope
                           │ POST /api/v1/{domain}/{aggregate}
                           │ GET  /api/v1/events?domain=vault
                           │ GET  /api/v1/projections/{name}
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ SOVR Protocol = Backend Financial Kernel                    │
│   Runs on :3001 as Source of Canonical Events (CE)          │
│   Fastify API Server — packages/runtime/src/server/index.ts │
│   Boot sequence 0-7, final health HEALTHY                   │
│   Event Store append-only immutable — generated/data/sovr-events.json │
│   15 Projections rebuilt from genesis (INV-006)            │
│   Capability Engine 107 caps, scope pattern language        │
│   Command Bus 7-stage pipeline INV-008                      │
│   Guardrail Bus INV-001 immutability + INV-002 double-entry │
└──────────────────────────┬──────────────────────────────────┘
                           │ Kafka topics sovr.{domain}.{aggregate}.{event}
                           │ Redis streams sovr:stream:{domain}:{aggregate}
                           │ Adapters (isolated, may not mutate constitutional state)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Boundary Systems (External)                                 │
│   Payment Rails: ACH, FEDNOW, WIRE, RTP, CARD, BLOCKCHAIN,  │
│                 STABLECOIN, SWIFT, SEPA, CASH, INTERNAL     │
│   Hybrid Engine: ethereum, base, polygon, future_chain      │
│   Oracles: CHAINLINK, PYTH, BAND, DIA, CUSTOM               │
│   Regulatory: batch_export audit trail                      │
└─────────────────────────────────────────────────────────────┘
```

## Why this separation is correct

Previously, Protocol repo contained specs + generated artifacts but no runnable backend. Frontend examples imported types directly, bypassing gates.

**Now:**

* **Protocol API Service is the ONLY writer to Event Store** — Source of CE. All financial state changes must flow through `POST /api/v1/{domain}/{aggregate}`.
* **Explorer never touches YAML directly** — it only knows `apiUrl: http://localhost:3001/api/v1` + `buildHash`. It verifies build_hash chain: `compiler-manifest build_hash == boot-attestation build_hash` — unfakeable.
* **External systems (any digitalizable financial infra) connect via adapters** — they POST commands with Bearer JWT, or subscribe to Kafka topics / Redis streams for events.

This satisfies INV-010: No autonomous bypass. Agent or external system cannot call domain service directly, must go through command bus.

## Protocol API Service — What it enforces

File: `packages/runtime/src/server/index.ts`
Built: `npm run build && PORT=3001 node dist/server/index.js`

**Boot Kernel (Linux analogy):**

- 🔌 [0] FIRMWARE_POST — Node version >=20, env isolation R10
- 🔐 [1] BOOTLOADER — loads `generated/compiler-manifest.yaml`, verifies `build_hash 20c57cfb...`, checks `boot-attestation.json` chain — tamper detection
- 🧠 [2] KERNEL_INIT — 10 invariants INV-001..010, envelope 18 fields, authority 4 actors
- 🏦 [3] CORE_DOMAINS — vault, ledger, treasury (topological order)
- 🛡️ [4] SECURITY_SUBSYSTEM — identity, policy pure function deterministic_hash, intent enrichment, agent bounded
- 🌐 [5] EXECUTION_BOUNDARY — payment 12 rails + hybrid 4 chains + 5 oracles, prohibition `ADAPTERS_MAY_NOT_MUTATE_CONSTITUTIONAL_STATE`
- 👁️ [6] INTERPRETATION — projection engine 15 read models rebuilt from genesis via `generated/data/sovr-events.json` — replay determinism INV-006
- 🚀 [7] USERLAND — SYSTEM HEALTHY — external can connect now

**Persistence:**

- Event log file: `generated/data/sovr-events.json` — append-only JSON array, atomic write via tmp rename. On boot, `EventStore.load()` restores from file, rebuilds causation graph + aggregate index + correlation groups, then projection engine replays.
- This file IS the Source of CE. Backup it like you backup ledger.

**API Routes — Universal Frontend Link:**

All external connect through these:

```
GET  /health                              -> SYSTEM HEALTHY, build_hash, boot_hash, invariants, event_store stats, projections stats
GET  /api/v1/health                       -> HEALTHY gate for frontend

GET  /api/v1/manifest                     -> compiler-manifest.yaml (input_hashes, ir_hash, output_hashes, build_hash)
GET  /api/v1/boot-attestation             -> boot-attestation.json (boot_hash chain)

GET  /openapi.yaml                        -> full OpenAPI 3.1 spec 44+ paths
GET  /api/v1/openapi                      -> summary

GET  /api/v1/events?domain=vault&limit=100&aggregate=asset&correlation_id=...
GET  /api/v1/events/:event_id
GET  /api/v1/audit/:correlation_id        -> complete trail INV-005

GET  /api/v1/projections                  -> list 15 models + counts
GET  /api/v1/projections/:name?actor_id=&asset_id=&order_id=&limit=100
     -> vault_asset_view, vault_balance_view, transfer_order_view, account_balance_view, chart_of_accounts_view, ledger_journal_view, identity_actor_view, identity_session_view, policy_rule_view, policy_evaluation_view, intent_view, agent_instance_view, payment_status_view, governance_proposal_view, reconciliation_dashboard_view

GET  /api/v1/capabilities                 -> 107 definitions count + grants stats
GET  /api/v1/capabilities/:actor_id       -> grants for actor
POST /api/v1/capabilities/grant           -> {capability_id, actor_id, scope_pattern} -> governance.capability.granted

POST /api/v1/identity/session             -> login: {identity_id, actor_id, actor_type} -> {jwt, session_id} — Bearer JWT is base64 JSON for demo, in prod use real JWT

POST /api/v1/:domain/:aggregate           -> UNIVERSAL COMMAND ROUTE
     Body can be:
     {commandName: vault.asset.register, capability_id: vault.asset.create, scope: vault.asset:*, payload: {asset_id, asset_type, ...}, meta: {commandId, correlationId, causationId}}
     OR inferred: {asset_id, asset_type} -> server infers vault.asset.register as first command for vault/asset

     Returns:
     {status: ACCEPTED|REJECTED, commandId, correlationId, events: [envelope...], gates: {identity, capability_scope, policy, constitutional}, error}

GET  /api/v1/:domain/:aggregate/:id       -> aggregate history + current projection state (event log authoritative per INV-006)

GET  /api/v1/commands                     -> DOMAIN_ROUTES map 101 commands grouped by domain
GET  /api/v1/topology                     -> protocol-topology.json machine graph for regulators
GET  /api/v1/streams                      -> Kafka topics + Redis streams + how to subscribe externally
```

**7-Stage Pipeline enforced on POST /api/v1/{domain}/{aggregate}:**

1. Identity Verification (gate1) — Bearer JWT must decode to actor, must be allowed actor_type per command issuer.actor_types
2. Capability Check (gate2) — CapabilityEngine.check(actor_id, capability_id, scope) with wildcard `*` + scope pattern `{resource}:{id}:{field}`
3. Scope Validation (gate3) — same engine, Redis TTL mock 300s
4. Policy Evaluation (gate4) — deterministic pure function, returns decisionId + ALLOW/DENY/ESCALATE, amount >1M for ai_agent => ESCALATE per INV-004
5. Constitutional Compliance (gate5) — Guardrail: INV-002 debits==credits for ledger.entry.post, INV-004 agent cannot grant authority
6. Execution (stage6) — append events from `03_command-catalog.yaml` resulting_events.success -> eventStore.append -> freeze payload (immutability)
7. Event Publication (stage7) — projectionEngine.handleEvent -> invalidates cache keys from envelope projection_effect.invalidation_keys

## How Explorer (frontend) connects via /api/v1

**Example using SOVRClient SDK — same for React, Vue, mobile:**

```ts
import { SOVRClient } from '@sovr/runtime/src/sdk/client.ts'

const client = new SOVRClient({
  apiUrl: 'http://localhost:3001/api/v1',
  buildHash: '20c57cfb56b202ce975b4932c06b3c4fe81feaefb2b63eccc11a628e009ebb1e'
})

// 1. Wait for HEALTHY — frontend gate
const health = await fetch('http://localhost:3001/health').then(r=>r.json())
if (health.final_health !== 'HEALTHY') throw Error('Kernel not healthy')

// 2. Verify unfakeable provenance
const manifest = await fetch('http://localhost:3001/api/v1/manifest').then(r=>r.json())
const attestation = await fetch('http://localhost:3001/api/v1/boot-attestation').then(r=>r.json())
assert(manifest.build_hash === attestation.build_hash) // same chain
assert(client.config.buildHash === manifest.build_hash) // same YAML + compiler

// 3. Login — get Bearer JWT
const sess = await fetch('http://localhost:3001/api/v1/identity/session', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({identity_id: 'actor_alice', actor_id: 'actor_alice', actor_type: 'human'})
}).then(r=>r.json())
const jwt = sess.jwt

// 4. Grant capabilities via governance (dev mode auto-grants if SOVR_DEV_AUTO_GRANT=true)
await fetch('http://localhost:3001/api/v1/capabilities/grant', {
  method: 'POST',
  headers: {'Content-Type':'application/json','X-Actor-Id':'governance'},
  body: JSON.stringify({capability_id: 'vault.asset.create', actor_id: 'actor_alice', scope_pattern: 'vault.asset:*'})
})

// 5. Execute financial commands — universal route
const asset = await fetch('http://localhost:3001/api/v1/vault/asset', {
  method: 'POST',
  headers: {'Content-Type':'application/json','Authorization': `Bearer ${jwt}`, 'X-Actor-Id': 'actor_alice'},
  body: JSON.stringify({
    commandName: 'vault.asset.register',
    capability_id: 'vault.asset.create',
    scope: 'vault.asset:*',
    payload: {
      asset_id: crypto.randomUUID(),
      asset_type: 'stablecoin',
      issuer_id: 'actor_alice',
      ownership_id: 'actor_alice',
      custody_provider: 'sovr_internal',
      custody_location: 'vault_1',
      native_unit: 'USD',
      precision: 2,
      risk_classification: 'low',
      valuation_source: 'chainlink',
      reserve_ratio: '1.0',
      face_value: '100000'
    }
  })
}).then(r=>r.json())
// Returns {status: ACCEPTED, commandId, correlationId, events: [{event_name: vault.asset.registered, envelope 18 fields...}], gates}

// 6. Query events — Source of CE
const events = await fetch('http://localhost:3001/api/v1/events?domain=vault&limit=10').then(r=>r.json())
// events.events[0] has full envelope: event_id, command_id, causation_id, correlation_id, identity_context, policy_decision_id, capability_id, audit.retention_class permanent

// 7. Query projection — read model (not authoritative)
const assets = await fetch('http://localhost:3001/api/v1/projections/vault_asset_view').then(r=>r.json())
// If projection disagrees with event log, event log wins per INV-006

// 8. Treasury movement — Can value move?
await fetch('http://localhost:3001/api/v1/vault/reservation', {
  method: 'POST',
  headers: {'Content-Type':'application/json','Authorization': `Bearer ${jwt}`},
  body: JSON.stringify({
    commandName: 'vault.reserve.create',
    capability_id: 'vault.reserve.create',
    scope: 'vault.asset:asset_001',
    payload: {asset_id: 'asset_001', amount: '10000', expiration: '2026-12-31T00:00:00Z', purpose: 'merchant payment'}
  })
})

// 9. Payment rail — Can execution leave system?
// After treasury.transfer.request -> payment.request.create -> execution.plan -> rail adapter (mock) -> receipt

// 10. External system subscribes via Kafka / Redis mock
// GET /api/v1/streams shows topics: sovr.vault.asset.registered, sovr.treasury.transfer_order.settled, etc.
// Real deployment would wire to actual Kafka cluster from generated/config/kafka/topics.yaml
```

**Existing example-frontend updated:**

`example-frontend/src/App.ts` now points to `http://localhost:3001/api/v1` and build_hash `20c57cfb...` instead of `3000`.

To run Explorer as operator console:

```bash
# Terminal 1: Protocol API Service = Source of CE on :3001
cd packages/runtime
npm run build
PORT=3001 node dist/server/index.js
# -> boot 0-7, SYSTEM HEALTHY, event store 1+ events, OpenAPI at /openapi.yaml

# Terminal 2: Explorer frontend on :3000 (example)
cd example-frontend
npm install # if you add vite/react
npm run dev # or tsx src/App.ts for CLI demo

# Or simple CLI demo:
cd ../..
node --loader tsx example-frontend/src/App.ts
```

## External Connect — How any digitalizable financial infra connects

Any system that can POST JSON can connect — no SDK required:

**1. Via REST — synchronous financial commands:**

```bash
curl -X POST http://localhost:3001/api/v1/identity/session -d '{"actor_id":"external_bank","actor_type":"external_system"}'
# -> jwt

curl -X POST http://localhost:3001/api/v1/vault/asset \
-H "Authorization: Bearer $jwt" \
-H "X-Actor-Id: external_bank" \
-d '{"commandName":"vault.asset.register","capability_id":"vault.asset.create","scope":"vault.asset:*","payload":{...}}'
```

**2. Via Events — async, eventual consistency, source of CE:**

```bash
# Poll events
curl http://localhost:3001/api/v1/events?domain=treasury&limit=100
# Audit trail by correlation
curl http://localhost:3001/api/v1/audit/{correlation_id}

# In production: Kafka consumer
# Kafka topics file: generated/config/kafka/topics.yaml
# Topic naming: sovr.{domain}.{aggregate}.{event_type}
# e.g. consumer.subscribe('sovr.vault.asset.registered', 'sovr.treasury.transfer_order.settled')

# Or Redis streams
# XREAD STREAMS sovr:stream:treasury:transfer_order 0
# Streams file: generated/config/redis/streams.yaml
```

**3. Via Boundary Adapters — external rails:**

Adapters are isolated: `ADAPTERS_MAY_NOT_MUTATE_CONSTITUTIONAL_STATE` — they can only produce rail events:

* `payment.rail.prepared` -> `payment.rail.executed` -> `payment.rail.confirmed` -> `payment.execution.completed` -> `payment.receipt.issued`
* On failure: `payment.rail.failed` retryable flag -> `payment.compensation.started` (sequential_reverse)

Payment rails defined in `hybrid-boundary.yaml` + `domains/payment.yaml`: ACH, FEDNOW, WIRE, RTP, CARD, BLOCKCHAIN, STABLECOIN, SWIFT, SEPA, CASH, INTERNAL, FUTURE_ADAPTER.

Hybrid Engine chains: ethereum, base, polygon, future_chain — attestation_based handoff, probabilistic finality.

**4. Via Projections — read models for UI:**

```bash
curl http://localhost:3001/api/v1/projections/vault_asset_view
curl http://localhost:3001/api/v1/projections/transfer_order_view?actor_id=actor_alice
curl http://localhost:3001/api/v1/projections/account_balance_view
curl http://localhost:3001/api/v1/projections/payment_status_view
# 15 total, rebuilt from genesis on boot per INV-006
```

## File Inventory for Source of CE

New files created for API service:

```
packages/runtime/src/server/
  eventStore.ts         — Append-only immutable store + file persistence generated/data/sovr-events.json, causation graph, correlation groups, INV-001 enforcement
  capabilityEngine.ts   — 107 caps, scope pattern language vault.asset:{id} with wildcard *, cache TTL 300s, governance.* wildcard
  projectionEngine.ts   — 15 read models, rebuildFromGenesis(), handleEvent() with cache invalidation
  commandBus.ts         — 7-stage pipeline identity->capability->scope->policy->constitutional->execution->publication, guardrail INV-002 double-entry check
  handlers.ts           — DOMAIN_ROUTES 101 commands grouped by domain, getRouteForCommand(), buildOpenApiFromCommands()
  config.ts             — Loads compiler-manifest.yaml + boot-attestation.json, verifies build_hash chain unfakeable
  index.ts              — Fastify server on :3001, universal route POST /api/v1/:domain/:aggregate, health/manifest/boot/events/projections/capabilities routes, CORS *

generated/data/
  sovr-events.json      — Source of CE durable file, append-only, atomic tmp rename write

example-frontend/src/App.ts — Updated to apiUrl http://localhost:3001/api/v1, buildHash 20c57cfb...
```

## Verification — How to prove it works

```bash
# 1 Compile spec -> artifacts
node packages/compiler/dist/cli.js compile
# -> build_hash 20c57cfb... byte-identical

# 2 Boot kernel API service on :3001
cd packages/runtime && npm run build && PORT=3001 node dist/server/index.js
# -> 🔌 FIRMWARE_POST, 🔐 BOOTLOADER build_hash verified, ... 🚀 USERLAND SYSTEM HEALTHY

# 3 Health gate — Explorer must wait for this
curl http://localhost:3001/health
# -> {"status":"HEALTHY","build_hash":"20c57cfb...","boot_hash":"87c2a236...","runlevel":7,"final_health":"HEALTHY","invariants":10...}

# 4 Manifest chain — unfakeable
curl http://localhost:3001/api/v1/manifest | jq .build_hash
curl http://localhost:3001/api/v1/boot-attestation | jq .build_hash
# -> both must equal 20c57cfb...

# 5 Explorer connects via SDK
curl -X POST http://localhost:3001/api/v1/identity/session -d '{"actor_id":"alice","actor_type":"human"}' | jq .jwt
# -> Bearer token

# 6 Financial command through universal route
curl -X POST http://localhost:3001/api/v1/vault/asset \
-H "Authorization: Bearer $jwt" \
-d '{"commandName":"vault.asset.register","payload":{"asset_id":"asset_1","asset_type":"stablecoin",...}}'
# -> ACCEPTED, events[0].event_name = vault.asset.registered, envelope 18 fields, audit.retention permanent

# 7 Source of CE proves audit completeness
curl http://localhost:3001/api/v1/events?domain=vault | jq .stats
# -> totalEvents++, event log wins per INV-006
curl http://localhost:3001/api/v1/projections/vault_asset_view | jq .records

# 8 Persistence — restart and events remain
cat generated/data/sovr-events.json | jq length
# -> number grows, load on reboot
```

## Bottom line

* **Before:** Protocol repo was contracts + generated stubs. Explorer imported types directly, no gates enforced. No runnable backend. External couldn't connect.

* **After:** Protocol repo now has **real Protocol API Service on localhost:3001** that IS the Source of Canonical Events. It enforces all 7 gates, 10 invariants, 107 capabilities, produces 251 events with 18-field envelope, persists to `sovr-events.json`, rebuilds 15 projections from genesis, exposes universal route `POST /api/v1/{domain}/{aggregate}`.

* **Explorer (frontend)** runs on `:3000`, connects only via `/api/v1` using `SOVRClient`, waits for HEALTHY, verifies build_hash chain. It never reads YAML directly.

* **External (any digitalizable financial infra)** connects via same universal route with Bearer JWT, or subscribes to Kafka topics `sovr.*.*` / Redis streams `sovr:stream:*` for async events, or uses boundary adapters for payment rails / blockchain.

Run `PORT=3001 node packages/runtime/dist/server/index.js` and you have a backend/API service to connect to.
