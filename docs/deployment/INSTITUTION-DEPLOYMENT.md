# SOVR Protocol — Institution Deployment Package
**Version:** v1.0.0-rc
**Classification:** External / Institution Restricted
**Date:** 2026-07-25
**Status:** RELEASE CANDIDATE

---

## What SOVR Protocol Is

SOVR Protocol is a spec-first, compiled financial kernel.

Every financial behavior is derived exclusively from a constitutional YAML corpus through deterministic compiler generation. No handwritten financial logic exists in the runtime. All behavior is registry-executed. All execution is tamper-evident and audit-logged.

The constitutional proof (XV3) demonstrated zero-runtime-code execution of a new domain (escrow). The compiler generated all artifacts from YAML alone. The runtime executed them without modification.

---

## System Components

| Component | Technology | Version | Role |
|---|---|---|---|
| Constitutional DB | YAML Corpus | v1.0.0 | Source of truth |
| Compiler | Node.js | v0.9.0 | Generates runtime artifacts |
| Runtime | Fastify v5 | v0.9.0 | Generic financial kernel |
| Event Store | PostgreSQL | 16+ | Tamper-evident audit log |
| Auth | RS256 JWT | jose v6.2 | Asymmetric identity layer |
| Rate Limiting | @fastify/rate-limit | v11.1 | Abuse prevention |
| Message Bus | Kafka / Redis | optional | External event streaming |
| Boundary Adapters | TypeScript | v0.9.0 | ACH rail execution |

**Verified artifact:** `packages/runtime/package.json` — dependency versions confirmed.
**Verified artifact:** `npm audit --omit=dev --audit-level=high` — 0 HIGH, 0 CRITICAL.

---

## Infrastructure Requirements

### Minimum Production Specification

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 4 cores | 8 cores |
| RAM | 8 GB | 16 GB |
| Storage | 100 GB SSD | 500 GB SSD |
| OS | Ubuntu 22.04 LTS or RHEL 9+ | Ubuntu 22.04 LTS |
| Node.js | v20 LTS | v20 LTS or v22 LTS |
| PostgreSQL | v16 | v16 or v17 |

**Ground truth:** `deployment/docker-compose.production.yml` uses `postgres:16-alpine`.
**Ground truth:** `docs/operations/RUNBOOK.md` prerequisites table specifies Node.js >= 20.0.0, PostgreSQL >= 16.

### Network Requirements

| Direction | Port | Protocol | Exposure |
|---|---|---|---|
| Inbound | 443 | HTTPS/TLS 1.2+ | Public (via reverse proxy) |
| Inbound | 3001 | HTTP | Internal only (or via LB) |
| Outbound | 5432 | PostgreSQL | Internal only |
| Outbound | 9092 | Kafka | Internal only (optional) |
| Outbound | 6379 | Redis | Internal only (optional) |

- No direct database exposure to public internet.
- PostgreSQL bound to private network interface only.
- API served behind nginx or institutional load balancer with TLS termination.

### TLS Requirements

- Certificate: CA-signed (institutional CA or public CA)
- Termination: nginx reverse proxy or institutional load balancer
- Minimum: TLS 1.2
- Preferred: TLS 1.3
- HSTS: Enforced at reverse proxy

---

## Deployment Procedure

### Step 1 — Environment Preparation

```bash
# Clone release tag (not main)
git clone https://github.com/StavoMidnite661/SOVR-Protocol
cd SOVR-Protocol
git checkout v0.9.0

# Install dependencies
npm install --workspaces
```

**Ground truth:** `docs/operations/RUNBOOK.md` — Deployment Procedure, Step 1.

### Step 2 — Secret Provisioning

```bash
# Generate RS256 keypair (4096-bit minimum)
openssl genrsa -out private.pem 4096
openssl rsa -in private.pem -pubout -out public.pem

# Set environment variables (never commit to repo)
export JWT_PRIVATE_KEY="$(cat private.pem)"
export JWT_PUBLIC_KEY="$(cat public.pem)"
export DATABASE_URL="postgresql://sovr_user:password@localhost:5432/sovr_prod?sslmode=require"
export NODE_ENV="production"
export SOVR_DEV_AUTO_GRANT="false"
```

**Ground truth:** `packages/runtime/src/security/jwt.ts` — RS256 key loading.
**Ground truth:** `docs/operations/RUNBOOK.md` — Key Rotation Procedure.
**Ground truth:** `docs/compliance/evidence/SOC2/CC6.2-authentication.md` — production fails-closed without keys.

### Step 3 — Database Initialization

Migrations run automatically on boot when `DATABASE_URL` is set.

```bash
# Verify DATABASE_URL is set, then start the server
# The runtime executes:
#   CREATE TABLE IF NOT EXISTS sovr_events (...) WITH IMMUTABLE TRIGGER
#   CREATE TABLE IF NOT EXISTS sovr_aggregate_states (...) WITH IMMUTABLE TRIGGER
```

**Ground truth:** `packages/runtime/src/adapters/postgres-event-store.ts` — `migrate()` executes `MIGRATION_SQL` and `MIGRATION_STATES_SQL` on boot.
**Ground truth:** Two tables created: `sovr_events` (19 columns, 5 indexes), `sovr_aggregate_states` (4 columns, 1 index). Both have PostgreSQL triggers preventing UPDATE/DELETE.

### Step 4 — Build and Start

```bash
# Build compiler
npm run build --workspace=packages/compiler

# Build runtime
npm run build --workspace=packages/runtime

# Start runtime
node packages/runtime/dist/server/index.js
```

**Ground truth:** `packages/runtime/package.json` scripts: `build`, `server`.

### Step 5 — Health Verification

```bash
# Health gate
curl https://your-domain/health
# Expected: {"status":"HEALTHY","final_health":"HEALTHY",...}

# Build hash chain
curl -s https://your-domain/api/v1/manifest | jq -r '.build_hash'
curl -s https://your-domain/api/v1/boot-attestation | jq -r '.build_hash'
# Both must match

# Demo smoke test
bash scripts/demo.sh
# Expected: 13/13 passed
```

**Ground truth:** `docs/operations/RUNBOOK.md` — Health Check Procedure.
**Ground truth:** `scripts/demo.sh` — 13 checks, all passing.
**Ground truth:** `test/integration.test.ts` — 16/16 integration tests pass.

---

## Health Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | System health + subsystem detail + version |
| `/api/v1/health` | GET | Simplified health for API consumers |
| `/api/v1/manifest` | GET | Registry manifest + build hash |
| `/boot-attestation` | GET | Boot attestation chain |
| `/api/v1/boot-attestation` | GET | Boot attestation chain (prefixed) |

**Health response includes:**
- `final_health`: HEALTHY | DEGRADED | UNHEALTHY
- `build_hash`: content-addressed compiler hash
- `boot_hash`: boot-time attestation hash
- `jwt.algorithm`: RS256
- `jwt.mode`: production | development
- `subsystems`: event_store, projections, capabilities, state_registry, build_provenance
- `invariants`: INV-001 through INV-010

**Ground truth:** `packages/runtime/src/server/index.ts` — `computeSubsystemHealth()`, lines 318-349.

---

## Verified API Surface

| Category | Count | Verified By |
|---|---|---|
| REST Endpoints | 35 | `src/server/index.ts` route extraction |
| GET Endpoints | 24 | Route extraction |
| POST Endpoints | 11 | Route extraction |
| WebSocket | 1 | `/api/v1/events/stream` |
| Domains | 10 | `commands.registry.json` domain extraction |
| Commands | 105 | `commands.registry.json` |
| State Machines | 43 | `machines.registry.json` |
| Capabilities | 111 | `capabilities.registry.json` |
| Projections | 15 | Runtime boot log |
| Sagas | 16 | Runtime boot log |

---

## Rollback Procedure

See: `docs/operations/RUNBOOK.md` — Section: Rollback Procedure.

Summary:
1. Stop current runtime: `kill <pid>`
2. Checkout previous release tag: `git checkout v0.8.0`
3. Rebuild: `npm run build --workspace=packages/runtime`
4. Restore database from last verified backup
5. Verify build hash chain matches
6. Start runtime and confirm health gate

**Ground truth:** `docs/operations/RUNBOOK.md` — Rollback Procedure section exists.

---

## SLA Targets

| Metric | Target | Measurement |
|---|---|---|
| Availability | 99.9% uptime | Health endpoint polling |
| Latency | p99 < 500ms | Fastify response time logging |
| RTO | 4 hours | Database restore + runtime restart |
| RPO | 1 hour | PostgreSQL WAL + base backup |
| Audit log | Tamper-evident, permanent | PostgreSQL immutable triggers |

**Ground truth:** PostgreSQL immutable triggers enforce no UPDATE/DELETE on `sovr_events` and `sovr_aggregate_states` (`postgres-event-store.ts` lines 206-233).
**Ground truth:** Fastify response time logging in production mode (`src/server/index.ts` pino logger).

---

## References

| Document | Location |
|---|---|
| Operations Runbook | `docs/operations/RUNBOOK.md` |
| Threat Model | `docs/security/threat-model.md` |
| SOC2 Control Mapping | `docs/compliance/SOC2-CONTROL-MAPPING.md` |
| GDPR Evidence | `docs/compliance/evidence/GDPR/` |
| Pentest Surface Map | `docs/security/PENTEST-SURFACE-MAP.md` |
| Hardening Checklist | `docs/security/hardening-checklist.md` |
| Production Compose | `deployment/docker-compose.production.yml` |
| Deployment Topologies | `docs/deployment/topologies.md` |
| Architecture README | `docs/architecture/README.md` |
| Audit Reports | `docs/reports/` |
