# SOVR Protocol — Integration Guide
**Version:** v1.0.0-rc
**Date:** 2026-07-25
**Classification:** External / Institution Restricted

---

## API Surface

### Base URL

```
https://your-domain/api/v1
```

### Authentication

All financial command endpoints require a valid RS256 JWT in the `Authorization` header:

```
Authorization: Bearer {RS256_JWT}
```

JWT tokens are obtained via the identity session endpoint:

```bash
POST /api/v1/identity/session
Content-Type: application/json

{
  "identity_id": "institution_001",
  "actor_id": "operator_001",
  "actor_type": "human"
}
```

Response:
```json
{
  "jwt": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "session_id": "uuid",
  "identity_id": "institution_001",
  "actor_id": "operator_001",
  "trust_level": "HIGH",
  "event": { ... }
}
```

**Ground truth:** `packages/runtime/src/server/index.ts` lines 590-618 — `/api/v1/identity/session` endpoint.
**Ground truth:** `packages/runtime/src/security/jwt.ts` — RS256 JWT implementation using `jose` v6.2.

---

## REST Endpoints

### Health and Provenance

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | System health with subsystem detail |
| GET | `/api/v1/health` | Simplified health for API consumers |
| GET | `/api/v1/manifest` | Registry manifest + build hash |
| GET | `/manifest` | Registry manifest (unprefixed) |
| GET | `/api/v1/boot-attestation` | Boot attestation chain |
| GET | `/boot-attestation` | Boot attestation (unprefixed) |

### Identity and Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/identity/session` | Create JWT session |
| GET | `/api/v1/identity/did/:did` | Resolve DID document |
| POST | `/api/v1/identity/did/verify` | Verify DID signature |
| GET | `/api/v1/identity/credential/:id` | Retrieve verifiable credential |
| POST | `/api/v1/identity/credential/verify` | Verify verifiable credential |

### Events

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/events` | List events (filterable by domain, aggregate, limit) |
| GET | `/api/v1/events/:event_id` | Get single event by ID |
| GET | `/api/v1/audit/:correlation_id` | Get audit trail by correlation ID |

### Projections

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/projections` | List all projections |
| GET | `/api/v1/projections/:name` | Query projection by name |

### Capabilities

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/capabilities` | List capability definitions |
| GET | `/api/v1/capabilities/:actor_id` | List grants for actor |
| POST | `/api/v1/capabilities/grant` | Grant capability to actor |

### Sagas

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/sagas` | List compiled saga definitions |
| GET | `/api/v1/sagas/:sagaId` | Get saga instance state |
| POST | `/api/v1/:domain/saga` | Start saga execution |

### Command Execution

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/:domain/:aggregate` | Execute domain command |
| GET | `/api/v1/:domain/:aggregate/:id` | Get aggregate history + current state |

### Payment Rails

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/payment/rail/:railId/submit` | Submit payment to registered rail via `BoundaryEventBus` |
| GET | `/api/v1/payment/rails` | List registered rail driver IDs + circuit states |

### Discovery

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/commands` | List all domain routes from registry |
| GET | `/api/v1/topology` | Protocol topology |
| GET | `/api/v1/streams` | List active event streams |
| GET | `/openapi.yaml` | OpenAPI spec (dynamic or static) |
| GET | `/api/v1/openapi` | OpenAPI paths (JSON) |

### WebSocket

| Endpoint | Protocol | Purpose |
|---|---|---|
| `ws://host/api/v1/events/stream` | WebSocket | Real-time event stream |

Query parameters:
- `domain` — filter by source domain (e.g., `vault`)
- `aggregate` — filter by aggregate type
- `actor_id` — filter by actor ID

Message format:
```json
{"type": "hello", "server": "sovr", "build_hash": "b7d8221b...", "filters": {...}}
{"type": "event", "envelope": { ... 21-field event envelope ... }}
```

**Ground truth:** `packages/runtime/src/server/index.ts` lines 832-844 — WebSocket route registration.
**Ground truth:** Total of 35 REST endpoints (24 GET, 11 POST) extracted from `src/server/index.ts`.

---

## Command Execution

### Request Format

```bash
POST /api/v1/{domain}/{aggregate}
Authorization: Bearer {RS256_JWT}
Content-Type: application/json

{
  "commandName": "{domain}.{aggregate}.{action}",
  "capability_id": "{domain}.{aggregate}.create",
  "scope": "{domain}.{aggregate}:*",
  "payload": { ... }
}
```

### Success Response (ACCEPTED)

```json
{
  "status": "ACCEPTED",
  "events": [
    {
      "event_name": "{domain}.{aggregate}.{action}",
      "aggregate_id": "uuid",
      "timestamp": "2026-07-25T00:00:00.000Z",
      "schema_version": "1.0.0",
      ...
    }
  ],
  "state": "{new_state}"
}
```

### Error Response (REJECTED)

```json
{
  "status": "REJECTED",
  "error": "{RULE_VIOLATION | CAPABILITY_DENIED | UNAUTH | VALIDATION}",
  "statusCode": 400 | 403 | 409 | 422
}
```

**Ground truth:** `packages/runtime/src/server/index.ts` lines 711-766 — universal route handler.

---

## Available Domains (v0.6.0)

| Domain | Description | Source |
|---|---|---|
| agent | Agent management | `generated/registries/commands.registry.json` |
| escrow | Escrow accounts (proven XV3) | YAML constitution |
| governance | Capability grants and policy | YAML constitution |
| identity | DID/VC, sessions | YAML constitution |
| intent | Payment intents | YAML constitution |
| ledger | Double-entry bookkeeping (INV-002) | YAML constitution |
| payment | Rail execution (ACH) | YAML constitution |
| policy | Policy rules | YAML constitution |
| treasury | Multi-domain sagas | YAML constitution |
| vault | Asset registry | YAML constitution |

**Ground truth:** 10 domains extracted from `generated/registries/commands.registry.json`.
**Ground truth:** 105 commands, 43 state machines, 113 capabilities.

---

## Event Structure

All state transitions emit events to the tamper-evident PostgreSQL event store.

```json
{
  "event_id": "uuid",
  "event_name": "vault.asset.registered",
  "event_version": "1.0.0",
  "schema_version": "1.0.0",
  "aggregate": "asset",
  "aggregate_id": "uuid",
  "source_domain": "vault",
  "command_id": "uuid",
  "triggering_command": "vault.asset.register",
  "causation_id": "uuid",
  "correlation_id": "uuid",
  "actor_id": "operator_001",
  "identity_context": { "identity_id": "...", "actor_type": "human", "session_id": "..." },
  "policy_decision_id": "uuid",
  "capability_id": "vault.asset.create",
  "timestamp": "2026-07-25T00:00:00.000Z",
  "payload": { ... },
  "projection_effect": { "target": "vault_asset_view", "operation": "insert" },
  "audit": {
    "constitutional_rules_referenced": ["INV-001", "INV-006"],
    "retention_class": "permanent"
  },
  "actor_chain": [],
  "retention_metadata": { "legal_hold": true }
}
```

**Field count:** 21 fields.
**Ground truth:** `packages/runtime/src/adapters/postgres-event-store.ts` — `buildEnvelope()` function, lines 236-260.
**Ground truth:** `test/integration.test.ts` line 376 — `expect(Object.keys(sample).length).toBe(21)`.

---

## Registry Manifest

```bash
GET /api/v1/manifest
```

Response:
```json
{
  "build_hash": "b7d8221b0d7359a7...",
  "commands": 105,
  "events": 259,
  "machines": 43,
  "capabilities": 111,
  "projections": 15,
  "generated": "2026-07-25T00:00:00.000Z"
}
```

**Ground truth:** `generated/registries/registry.manifest.json` — verified counts.
**Ground truth:** Runtime boot log: "Capability engine loaded 111 definitions", "Projection engine registered 15 read models".

---

## WebSocket Event Stream

```bash
ws://host/api/v1/events/stream?domain=vault&aggregate=asset&actor_id=operator_001
```

Protocol: native WebSocket (no subprotocol required).

Message types:
- `hello` — server greeting with build_hash and active filters
- `event` — real-time event emission matching filters

**Ground truth:** `test/integration.test.ts` — WebSocket event stream test, lines 290-335.

---

## SDK Integration

The `packages/shared` workspace contains:

- VEL (Validation Expression Language) parser
- TypeScript types for all registry objects
- Error classes with structured codes (`SOVRApiError`)
- `SOVRClient` — HTTP client with JWT management

```typescript
import { SOVRClient, SOVRApiError } from '@sovr/shared';

const client = new SOVRClient({
  apiUrl: 'https://your-domain/api/v1',
  actorId: 'operator_001',
  actorType: 'human',
  timeoutMs: 10000,
});

// Create session (obtains JWT)
await client.createSession({ identity_id: '...', actor_id: '...', actor_type: 'human' });

// Execute command
const result = await client.registerAsset({ assetId: '...', assetType: 'stablecoin', ... });

// Query projection
const proj = await client.queryProjection('vault_asset_view', { assetId: '...' });
```

**Ground truth:** `packages/runtime/src/sdk/client.ts` — `SOVRClient` implementation.
**Ground truth:** `test/integration.test.ts` — SDK usage throughout all test suites.

---

## Error Codes

| HTTP Status | Error Code | Meaning |
|---|---|---|
| 400 | VALIDATION | Missing required payload fields |
| 400 | UNCOVERED_COMMAND | Command not in registry |
| 403 | CAPABILITY_DENIED | Capability grant missing |
| 403 | UNAUTHORIZED_ACTOR_TYPE | Actor type not permitted (e.g., ai_agent on governance) |
| 409 | INVALID_STATE_TRANSITION | Guard rejected state change |
| 422 | CONSTITUTIONAL_VIOLATION | Invariant violation (e.g., INV-002 unbalanced) |
| 422 | ATOMIC_COMMIT_FAILURE | Event store write failed |
| 429 | RATE_LIMITED | Financial rate limit exceeded |
| 500 | INTERNAL | Unexpected runtime error |

**Ground truth:** `packages/runtime/src/server/index.ts` lines 752-762 — status code mapping.

---

## Production Configuration

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://sovr_user:password@postgres:5432/sovr_protocol?sslmode=require
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."
JWT_PUBLIC_KEY="-----BEGIN RSA PUBLIC KEY-----..."
LOG_LEVEL=info
SOVR_DEV_AUTO_GRANT=false
SOVR_KAFKA_ENABLED=false
SOVR_REDIS_ENABLED=false
```

**Ground truth:** `deployment/docker-compose.production.yml` — environment variables for api and worker services.
**Ground truth:** `docs/deployment/topologies.md` — configuration flags.

---

## Docker Production Stack

```bash
docker compose -f deployment/docker-compose.production.yml up -d
```

Services:
- `postgres` — PostgreSQL 16-alpine, persistent volume, healthcheck
- `api` — SOVR runtime API, depends_on postgres healthy
- `worker` — Event processor, optional
- `metrics` — Prometheus, optional

**Ground truth:** `deployment/docker-compose.production.yml` — full stack definition.
