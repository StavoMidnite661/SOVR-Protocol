# SOVR Protocol API Service — Source of Canonical Events (CE)

This folder is the **runnable backend** for SOVR Financial OS. It turns the frozen YAML spec into a live Fastify API on `localhost:3001`.

## Quick Start

```bash
cd packages/runtime
npm install
npm run build
PORT=3001 node dist/server/index.js
# or npm run server
```

Expected boot:

```
  ____   _____  __      __  ____    ___   ____    _   _ 
 SOVR Financial OS — Source of Canonical Events (CE)

🔌 [0] FIRMWARE_POST Node v22 OK
🔐 [1] BOOTLOADER build_hash 20c57cfb... verified
🧠 [2] KERNEL_INIT 10 invariants
🏦 [3] CORE_DOMAINS vault, ledger, treasury
🛡️ [4] SECURITY_SUBSYSTEM identity, policy, agent
🌐 [5] EXECUTION_BOUNDARY 12 rails, 4 chains, 5 oracles
👁️ [6] INTERPRETATION 15 projections rebuilt from genesis
🚀 [7] USERLAND SYSTEM HEALTHY

✅ Source of CE running on http://localhost:3001
   Health: /health
   API: POST /api/v1/{domain}/{aggregate}
   Events: /api/v1/events?domain=vault
   OpenAPI: /openapi.yaml
```

## Universal Frontend Link

**This is what Explorer and any external system connects to:**

```
POST /api/v1/:domain/:aggregate
Headers: Authorization: Bearer <jwt>, X-Actor-Id, Content-Type: application/json
Body: {commandName, capability_id, scope, payload, meta: {commandId, correlationId, causationId}}
```

Examples:

```bash
# Login
curl -X POST http://localhost:3001/api/v1/identity/session -d '{"actor_id":"alice"}'

# Grant cap (governance)
curl -X POST http://localhost:3001/api/v1/capabilities/grant -d '{"capability_id":"vault.asset.create","actor_id":"alice","scope_pattern":"vault.asset:*"}'

# Register asset (financial command)
curl -X POST http://localhost:3001/api/v1/vault/asset \
-H "Authorization: Bearer $jwt" \
-d '{"commandName":"vault.asset.register","payload":{"asset_id":"a1","asset_type":"stablecoin",...}}'

# Query events — Source of CE
curl http://localhost:3001/api/v1/events?domain=vault

# Query projection — read model (not authoritative)
curl http://localhost:3001/api/v1/projections/vault_asset_view
```

## Architecture

- `eventStore.ts` — append-only, immutable, causation graph, file persistence `generated/data/sovr-events.json`
- `capabilityEngine.ts` — 107 caps, scope pattern `vault.asset:{id}` with `*`, cache TTL 300s
- `projectionEngine.ts` — 15 read models, `rebuildFromGenesis()` per INV-006
- `commandBus.ts` — 7 gates: identity, capability, scope, policy, constitutional, execution, publication
- `handlers.ts` — DOMAIN_ROUTES 101 commands
- `config.ts` — loads compiler-manifest + boot-attestation, verifies build_hash chain
- `index.ts` — Fastify server, CORS *, port 3001

## Explorer Connection

Explorer = frontend on :3000
Protocol = backend on :3001

`example-frontend/src/App.ts`:

```ts
import { SOVRClient } from '@sovr/runtime'
const client = new SOVRClient({apiUrl: 'http://localhost:3001/api/v1', buildHash: '20c57cfb...'})
await fetch('http://localhost:3001/health') // must be HEALTHY
await client.verifyBuildManifest(buildHash) // unfakeable
```

## External Connect

Any system that can POST JSON:

- REST sync: POST /api/v1/{domain}/{aggregate}
- Async events: GET /api/v1/events?domain=... or Kafka topic `sovr.{domain}.{aggregate}.{event}` or Redis stream `sovr:stream:{domain}:{aggregate}`
- Rails: via payment adapters — `payment.rail.prepared -> executed -> confirmed` — isolated, cannot mutate constitutional state

## Persistence

File: `generated/data/sovr-events.json`
- Atomic write via .tmp rename
- Loaded on boot, indexes rebuilt
- Backup like ledger
- To reset: rm generated/data/sovr-events.json and restart — boot seeds 1 saga.started event

## ENV

```
PORT=3001
SOVR_DEV_AUTO_GRANT=true # auto grants caps for demo, disable in prod (only governance can grant per INV-004)
SOVR_BUILD_HASH=20c57cfb... # optional override
```

## Health Gate

Frontend MUST NOT call treasury.transfer.request before:

```ts
const health = await fetch('http://localhost:3001/health').then(r=>r.json())
if (health.final_health !== 'HEALTHY') throw Error('halt')
```
