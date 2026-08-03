# SOVR Financial OS Protocol — Comprehensive End-to-End Asset Assessment

**Repository:** `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol`
**Assessment Date:** 2026-08-01
**Protocol Version:** v1.0.0 (FROZEN)
**Compiler Version:** 0.6.0
**Runtime Version:** 0.6.0
**Build Hash:** `2ae816fac5cbe62c6270546bdaa669b079faef6166b4ecd05ce7db37163ed2cd`

---

## Executive Summary

**SOVR Financial OS is NOT a blockchain or smart contract platform.** It is a spec-first, compiled financial protocol kernel — the "Linux of Finance." There are **zero Solidity files**, **zero Foundry/Hardhat configurations**, and **zero deployed on-chain smart contracts** in this repository. The project does not deploy or interact with Ethereum, L2s, or any EVM chain via smart contracts. Instead, it defines a YAML-based constitutional specification that is deterministically compiled into a TypeScript runtime, which enforces financial operations through event sourcing, double-entry accounting, and a 7-stage command pipeline.

The repository contains:
- **15 YAML protocol specification files** (the "constitution")
- **A deterministic compiler** (`@sovr/compiler`) that compiles YAML → IR → TypeScript artifacts
- **A reference runtime** (`@sovr/runtime`) — a Fastify API server that executes compiled protocol definitions
- **External rail adapters** (ACH, FedNow, Wire, RTP, Card, Blockchain, Stablecoin, SWIFT, SEPA, TigerBeetle)
- **Oracle integrations** (Chainlink, Band, Pyth, DIA — scaffold/read-only)
- **PostgreSQL** (event store) + **TigerBeetle** (financial database/balance layer)

---

## 1. Overall Architecture and Directory Structure

### Top-Level Layout

```
D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\
├── 00_protocol-manifest.yaml       # Entry point: layers, domains, build phases
├── 01_constitution.yaml            # Supreme law: 10 invariants, authority model
├── 02_domain-model.yaml            # 48 entities across 10 domains
├── 03_command-catalog.yaml         # 105 commands with validation rules
├── 04_event-catalog.yaml           # 259 events with 21-field envelope
├── 05_state-machines.yaml          # 43 state machines
├── 08_security-capabilities.yaml   # 111 capabilities + scope language
├── 09_saga-orchestration.yaml      # Saga definitions + compensation
├── 11_governance-amendments.yaml   # Amendment process
├── 12_domain-contracts.yaml        # Inter-domain coupling contracts
├── 13_compiler-adr.yaml            # 12 architectural decision records
├── compiler.yaml                   # Compiler specification
├── hybrid-boundary.yaml            # Blockchain + oracle boundaries (abstract)
├── projection-engine.yaml          # 15 read model definitions
├── acceptance-tests.yaml           # 60 acceptance tests
├── domains/                        # Per-domain detailed specs
│   ├── vault.yaml
│   ├── ledger.yaml
│   ├── treasury.yaml
│   ├── identity.yaml
│   ├── policy.yaml
│   ├── intent.yaml
│   ├── agent.yaml
│   ├── governance.yaml
│   ├── payment.yaml
│   └── escrow.yaml
├── packages/
│   ├── compiler/                   # @sovr/compiler — YAML → IR → artifacts
│   ├── runtime/                    # @sovr/runtime — Fastify API server
│   └── shared/                     # @sovr/shared — VEL parser, AST types
├── protocol/                       # Additional protocol specs
├── generated/                      # Compiler output (IR, registries, types)
├── docs/                           # Architecture, audit, deployment, guides
├── deployment/                     # Dockerfile, docker-compose
├── scripts/                        # Setup, demo, certification scripts
├── example-frontend/               # Example TypeScript frontend
├── management/                     # Project status, milestones, dashboards
├── certification/                  # Acceptance evidence, traceability
├── governance/                     # Constitutional amendments
├── knowledge/                      # Ontology, knowledge graph
└── snapshots/                      # Versioned protocol snapshots
```

### Constitutional Layers (L0–L7)

The protocol enforces a strict acyclic dependency graph:

| Layer | Name | Files |
|-------|------|-------|
| L0 | Protocol Governance | `00_protocol-manifest.yaml`, `01_constitution.yaml` |
| L1 | Shared Language | `02_domain-model.yaml`, `03_command-catalog.yaml`, `04_event-catalog.yaml` |
| L2 | Execution Control | `05_state-machines.yaml`, `09_saga-orchestration.yaml` |
| L3 | Authority | `08_security-capabilities.yaml` |
| L4 | Interpretation | `projection-engine.yaml` |
| L5 | Integration | `12_domain-contracts.yaml` |
| L6 | Boundary | `hybrid-boundary.yaml` |
| L7 | Production | `compiler.yaml`, `acceptance-tests.yaml` |

---

## 2. Smart Contracts (Solidity Files)

**Finding: There are NO Solidity smart contracts in this repository.**

- Searched entire repository for `**/*.sol` — **0 files found**
- No `foundry.toml`, `hardhat.config.ts`, `hardhat.config.js`, or `truffle-config.js`
- No `contracts/` directory
- No `scripts/deploy.ts` or `deploy/` containing Solidity deployment scripts

The `hybrid-boundary.yaml` file defines **abstract interfaces** for blockchain interactions (Ethereum, Base, Polygon), but these are specification-level descriptions, not deployed contracts. The runtime contains TypeScript adapter scaffolds (`EvmDriver.ts` referenced in docs but not present in the checked-out runtime — only `StablecoinDriver.ts`, `PriceOracleDriver.ts`, `AchDriver.ts`, `TigerBeetleDriver.ts` exist as concrete implementations).

The repository is a **protocol kernel and compiler**, not a DApp or DeFi protocol with on-chain contracts.

---

## 3. On-Chain Assets

**Finding: No on-chain assets are deployed or managed by this repository.**

The Vault domain YAML (`domains/vault.yaml`) defines an asset registry model with these asset types:

| Asset Type | Description | Custody | Risk | Examples |
|------------|-------------|---------|------|----------|
| `cash` | Fiat currency held in custody | `full_reserve` | minimal | USD, EUR, GBP, JPY |
| `stablecoin` | Tokenized fiat-pegged digital asset | `on_chain_verified` | low | sFIAT_USD, sFIAT_EUR, USDC, USDT |
| `tokenized_asset` | Blockchain-represented ownership | `on_chain_or_vault` | medium | real_estate_token, commodity_token, equity_token |
| `collateral_position` | Asset pledged as security | `locked_holding` | varies | margin_collateral, loan_collateral |
| `liquidity_position` | Claim on pooled liquidity | `pool_membership_verified` | medium-high | amm_pool_position, lending_pool_deposit |
| `external_claim` | Receivable/claim on external system | `attestation_required` | medium-high | bank_receivable, payment_claim |

**Key distinction:** These are **protocol-level asset types** — abstract specifications of value categories. The Vault domain tracks asset *existence*, *ownership*, *custody*, *valuation*, and *reserve state* in its event-sourced aggregates. Actual on-chain token contracts (ERC20, ERC721) are **not part of this repository**. The `sFIAT` token mentioned in `00_protocol-manifest.yaml` is a conceptual on-chain settlement asset, but no ERC20 contract exists here.

---

## 4. Off-Chain Components

### Compiler (`packages/compiler/`)

**File:** `packages/compiler/package.json` — `@sovr/compiler v1.0.0`
**Entry:** `packages/compiler/dist/cli.js`

A deterministic, content-addressed build system:
- **Input:** 15 YAML specification files + `domains/*.yaml`
- **Pipeline:** PARSE → VALIDATE → RESOLVE → TRANSFORM → GENERATE → VERIFY
- **Output:** `generated/sovr-ir.json` (canonical IR), `generated/registries/*.json`, TypeScript types, OpenAPI spec, Prisma schema, Kafka/Redis configs, TLA+ models
- **Build Hash:** SHA-256 over canonical JSON — currently `2ae816fa...`
- **Reproducibility:** Byte-identical across platforms (R1–R10 rules)

### Runtime (`packages/runtime/`)

**File:** `packages/runtime/package.json` — `@sovr/runtime v1.0.0`
**Entry:** `packages/runtime/dist/server/index.ts`

A Fastify-based HTTP API server:

| Component | File | Purpose |
|-----------|------|---------|
| Server | `packages/runtime/src/server/index.ts` | Fastify app on :3001, 8-runlevel boot, WebSocket events |
| Event Store | `packages/runtime/src/server/eventStore.ts` | Append-only event log (JSON file or PostgreSQL) |
| Command Bus | `packages/runtime/src/server/commandBus.ts` | 7-stage pipeline: identity → capability → scope → policy → constitutional → execution → publication |
| Capability Engine | `packages/runtime/src/server/capabilityEngine.ts` | 107 capability definitions, scope pattern matching |
| Projection Engine | `packages/runtime/src/server/projectionEngine.ts` | 15 materialized read models rebuilt from genesis |
| Saga Interpreter | `packages/runtime/src/execution/saga-interpreter.ts` | Compiled-IR saga execution with compensation |
| State Machine Interpreter | `packages/runtime/src/execution/state-machine-interpreter.ts` | 43 state machines from IR |
| JWT Service | `packages/runtime/src/security/jwt.ts` | RS256 asymmetric JWT (production) / HMAC-SHA256 (dev) |
| Config | `packages/runtime/src/server/config.ts` | Loads compiler manifest + boot attestation |

### Adapters (`packages/runtime/src/adapters/`)

| Adapter | File | Status | Purpose |
|---------|------|--------|---------|
| BaseRailDriver | `base/BaseRailDriver.ts` | ✅ Implemented | Abstract base: circuit breaker, retry, audit, timeout |
| ACH | `ach/AchDriver.ts` | ✅ Implemented | Dwolla, Modern Treasury, Column APIs |
| FedNow | `fednow/FedNowDriver.ts` | Scaffold | ISO 20022 pacs.008/pacs.002 |
| Fedwire | `wire/FedwireDriver.ts` | Scaffold | Operating-hours enforcement |
| RTP | `rtp/RtpDriver.ts` | Scaffold | TCH real-time payments |
| Card | `card/CardNetworkDriver.ts` | Scaffold | Marqeta/Stripe/Lithic |
| EVM/Blockchain | `blockchain/EvmDriver.ts` | Not present in runtime (referenced in docs) | ethers.js/viem hook |
| Stablecoin | `stablecoin/StablecoinDriver.ts` | ✅ Implemented | Circle API (USDC) + ERC-20 fallback |
| SWIFT | `swift/SwiftDriver.ts` | Scaffold | SWIFT gpi |
| SEPA | `sepa/SepaDriver.ts` | Scaffold | IBAN/pain.001 |
| TigerBeetle | `tigerbeetle/TigerBeetleDriver.ts` | ✅ Implemented | Financial database — balance layer |
| TigerBeetle Account Manager | `tigerbeetle/TigerBeetleAccountManager.ts` | ✅ Implemented | Maps SOVR account events → TB accounts |
| Price Oracle | `oracle/PriceOracleDriver.ts` | Scaffold | Chainlink, Band, internal pricing |
| Private Ledger | `private-ledger/SovrLedgerDriver.ts` | Not read | Native kernel execution path |
| Boundary Event Bus | `boundary.ts` | ✅ Implemented | Constitutional bridge: external events → CommandBus |
| Adapter Registry | `RailDriverRegistry.ts` | Not read | Credential-validated boot registration |
| Circuit Breaker | `circuit-breaker.ts` | Not read | Shared circuit breaker logic |
| PostgreSQL Event Store | `postgres-event-store.ts` | ✅ Implemented | Production-durable event persistence |

### Workers/Services

- **No separate worker processes** are defined. All logic runs in the single Fastify server process.
- **Kafka** and **Redis** are used as event publishers (fan-out), not as primary workers.
- **Boot sequence** is an 8-runlevel in-process initialization (`boot/self-test.ts`, `boot/boot-renderer.ts`).

### Scripts

| Script | Path | Purpose |
|--------|------|---------|
| Setup | `scripts/setup.sh` | Builds compiler + runtime, compiles YAML |
| Demo | `scripts/demo.sh` | Runs demonstration flow |
| Formal Verify | `scripts/formal-verify.sh` | Runs TLA+ model checking (not yet in CI) |
| Certify Production | `scripts/certify-production.mjs` | Production certification script |
| Runtime Audit | `scripts/runtime-audit.mjs` | Audits runtime for purity violations |
| TigerBeetle Init | `scripts/tigerbeetle-init.sh` | Initializes TigerBeetle cluster |
| Bump Version | `scripts/bump-version.js` | Version management |

---

## 5. Data Flows: Asset Lifecycle

### Asset Registration (Minting)

```
Frontend/Client
  → POST /api/v1/identity/session (get JWT)
  → POST /api/v1/capabilities/grant (governance grants vault.asset.create)
  → POST /api/v1/vault/asset
      body: { commandName: "vault.asset.register", capability_id: "vault.asset.create", payload: { asset_id, asset_type, issuer_id, ownership_id, custody_location, ... } }
  
  7-Stage Pipeline:
    1. Identity Verification (JWT decode, actor_type check)
    2. Capability Check (vault.asset.create)
    3. Scope Validation (custody_location scope)
    4. Policy Evaluation (vault_registration_policy)
    5. Constitutional Compliance
    6. Execution → eventStore.append({ event_name: "vault.asset.registered", ... })
    7. Event Publication → projections updated, Kafka/Redis/WS fan-out

Events Emitted:
  - vault.asset.registered (success)
  - vault.asset.registration_failed (failure)
```

### Asset Verification

```
POST /api/v1/vault/asset/verify
  → vault.asset.verify command
  → Requires attestation_proof from trusted attester
  → Events: vault.asset.verified, vault.custody.attested
  → Asset state: REGISTERED → VERIFIED
```

### Reservation (Locking Value)

```
POST /api/v1/vault/reservation
  → vault.reserve.create command
  → Validates: asset in AVAILABLE, actor has reserve_control, amount ≤ available_balance
  → Events: vault.reserve.created
  → Asset state: AVAILABLE → RESERVED

POST /api/v1/vault/reservation/lock
  → vault.reserve.lock command
  → Events: vault.reserve.locked
  → Asset state: RESERVED → LOCKED
```

### Transfer / Movement (Treasury)

```
POST /api/v1/treasury/transfer
  → treasury.transfer.request
  → treasury.transfer.authorize (identity + capability + policy)
  → treasury.transfer.reserve (system: creates vault reservation)
  → treasury.transfer.execute
      Internal: posts ledger entry
      External: creates settlement_instruction → Payment domain
  → treasury.settlement.confirm
  → Events: treasury.transfer.settled
  → Vault reservation: LOCKED → CONSUMED
```

### Withdrawal / External Settlement

```
Treasury produces settlement_instruction
  → Payment domain: payment.request.create
  → payment.execution.plan (routing engine selects rail)
  → payment.execution.execute (adapter.prepare + adapter.execute)
  → External rail processes (ACH, Wire, etc.)
  → payment.execution.confirm (adapter.confirm)
  → payment.receipt.issue
  → Events: payment.rail.{type}.confirmed, payment.execution.completed
```

### Redemption / Release

```
vault.reserve.release
  → Asset state: RESERVED/LOCKED → AVAILABLE
  → Events: vault.reserve.released

collateral release:
  → vault.collateral.remove
  → Conditions: obligation satisfied, margin ratio above initial
  → Events: vault.collateral.released
```

---

## 6. Asset Types

Defined in `domains/vault.yaml` Section 2 (`asset_registry.asset_types`):

1. **cash** — Fiat currency, full reserve, 100% reserve requirement, precision 2
2. **stablecoin** — Tokenized fiat-pegged asset, oracle validation, 100% reserve, precision 18
3. **tokenized_asset** — Real-world/digital asset tokens, marked-to-market valuation, precision 18
4. **collateral_position** — Pledged security, haircut applied, marked-to-market, precision 4
5. **liquidity_position** — AMM/lending pool claims, pool NAV valuation, precision 18
6. **external_claim** — Receivables/claims on external systems, attestation required, precision 2

**Polymorphic Value Model:** SOVR does not force all value into a single unit. Each asset type has its own native unit. Cross-asset comparisons use the valuation layer. Base accounting unit is `sovr_unit` (18 decimal precision).

---

## 7. Risk Management

### Oracles and Price Feeds

Defined in `hybrid-boundary.yaml` Section 3 (`oracle_boundaries`):

| Provider | Staleness Threshold | Deviation Alert |
|----------|---------------------|-----------------|
| Chainlink | 300s (5 min) | 2.0% |
| Band Protocol | 300s | 2.5% |
| Pyth | 100s | 1.5% |
| DIA | 600s | 3.0% |
| Custom | 60s | 1.0% (requires governance) |

**Constitutional rule:** Oracle prices are advisory. Vault valuations are authoritative. Oracle data never directly mutates financial state.

### Collateral and Liquidation

Defined in `domains/vault.yaml` Section 5 (`collateral_framework`):

| Parameter | Value |
|-----------|-------|
| Minimum quality score | 0.6 |
| Cash haircut | 0% |
| Stablecoin haircut | 2% |
| Tokenized asset haircut | 15% (adjustable 5%–50%) |
| Liquidity position haircut | 10% (adjustable 5%–40%) |
| External claim haircut | 30% |
| Max single asset exposure | 25% |
| Max single type exposure | 60% |
| Max single issuer exposure | 40% |
| Maintenance margin ratio | 80% |
| Initial margin ratio | 100% |
| Margin call resolution | 24 hours before liquidation |

**Liquidation triggers:** `vault.collateral.margin_call` → if unresolved within 24h → `vault.collateral.liquidation_initiated`

### Reserve Management

- Full reserve required for cash and stablecoins (100%)
- Collateral assets: 100% plus haircut
- Liquidity positions: 80% recognized
- Daily attestation required (86400s)
- Reconciliation triggers: scheduled daily, attestation failure, valuation discrepancy > 0.01%

### Pausing Mechanisms

| Mechanism | Location | Trigger |
|-----------|----------|---------|
| Liquidity state transitions | Treasury domain | Available liquidity < 5% total verified → EMERGENCY_LOCK |
| Governance emergency halt | Constitution Section 6 | Active breach, asset integrity compromised, regulatory mandate |
| Adapter circuit breaker | `BaseRailDriver.ts` | 5 consecutive failures → OPEN for 60s–300s |
| Account freeze | Ledger domain | Governance action → ledger.account.freeze |
| Vault asset state | Vault domain | IMPAIRED state restricts operations |

---

## 8. Integrations

### External Payment Rails

12 rails declared in `domains/payment.yaml` and `hybrid-boundary.yaml`:

| Rail | Type | Finality | Supported Assets | Implementation |
|------|------|----------|------------------|----------------|
| ACH | Domestic bank transfer | Deferred | cash | ✅ Dwolla, Modern Treasury, Column |
| FedNow | Instant payment | Immediate | cash | Scaffold (ISO 20022) |
| Fedwire | Domestic wire | Same day | cash | Scaffold |
| RTP | Real-time payment | Immediate | cash | Scaffold (TCH) |
| Card | Card network | Deferred | cash, stablecoin | Scaffold |
| Blockchain | On-chain settlement | Probabilistic | stablecoin, tokenized_asset | Scaffold (EVM) |
| Internal Transfer | SOVR internal | Immediate | cash, stablecoin, tokenized_asset | ✅ Native kernel |
| Stablecoin | Stablecoin network | Probabilistic | stablecoin | ✅ Circle API wired |
| SWIFT | International wire | Deferred | cash | Scaffold |
| SEPA | European payment | Deferred | cash | Scaffold |
| Cash Settlement | Physical cash | Manual | cash | Scaffold |
| Future Adapter | Extensible | Configurable | — | Template |

### Blockchain Boundaries

Defined abstractly in `hybrid-boundary.yaml` Section 2:

| Chain | Chain Type | Finality Model | Confirmation Thresholds |
|-------|-----------|----------------|------------------------|
| Ethereum | EVM | PROBABILISTIC | Safe: 12, Final: 24 |
| Base | EVM_L2 | HYBRID | Safe: 2, Final: 6 |
| Polygon | EVM_L2 | PROBABILISTIC | Safe: 128, Final: 256 |
| Future Chain | EXTENSIBLE | Template | Governance approval required |

**Blockchain operations supported:** TOKEN_TRANSFER, CONTRACT_CALL, ATTESTATION_VERIFY, BRIDGE_LOCK, BRIDGE_RELEASE

**Key rule:** `ADAPTERS_MAY_NOT_MUTATE_CONSTITUTIONAL_STATE` — all blockchain interactions produce events only; state changes enter through `BoundaryEventBus → CommandBus → KernelExecutor`.

### Oracle Integrations

| Oracle Type | Sources | Constitutional Constraint |
|-------------|---------|---------------------------|
| PRICE | Chainlink, Band, Pyth, DIA, Custom | Advisory only — never directly mutates state |
| RESERVE_ATTESTATION | On-chain Merkle proof, Third-party auditor, Governance manual | Evidence, not authority |
| IDENTITY_ATTESTATION | Cross-chain ID, External KYC, Decentralized ID | Supplements, never replaces SOVR Identity |
| SETTLEMENT_ATTESTATION | On-chain tx receipt, Block explorer, Relayer | Confirmed by Payment domain before Treasury state update |

### Financial Database

**TigerBeetle** (`tigerbeetle-node` v0.17.8):
- **Purpose:** Balance layer beneath SOVR — authoritative account balances
- **Architecture:** PostgreSQL = immutable event log (WHAT happened); TigerBeetle = account balances (WHAT state is NOW)
- **Ledger partitions:** VAULT(1), LEDGER(2), TREASURY(3), ESCROW(4), PAYMENT(5), FEES(6), RESERVE(7), SYSTEM(8)
- **Transfer codes:** JOURNAL_ENTRY(1), RESERVE(2), POST_RESERVE(3), VOID_RESERVE(4), FEE(5), INTEREST(6), ADJUSTMENT(7), SETTLEMENT(8), COMPENSATION(9)
- **Double-entry enforcement:** Two independent enforcement points — SOVR CommandBus + GuardrailBus (application layer) AND TigerBeetle (storage layer). If TigerBeetle rejects, the event is NOT written.

### Message Brokers

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Kafka | `kafkajs` v2.2.4 | Event fan-out: topics `sovr.{domain}.{aggregate}.{event_name}` |
| Redis | `ioredis` v5.0.0 | Event streams: `sovr:stream:{domain}:{aggregate}` |
| WebSocket | `@fastify/websocket` | Real-time event stream to frontends |

---

## 9. Configuration and Deployment

### Environment Variables

| Variable | Default | Required in Prod | Purpose |
|----------|---------|------------------|---------|
| `SOVR_JWT_SECRET` | dev fallback | **YES** (≥32 bytes) | JWT signing key |
| `SOVR_JWT_ISSUER` | `sovr-financial-os` | No | JWT issuer |
| `SOVR_JWT_AUDIENCE` | `sovr-clients` | No | JWT audience |
| `SOVR_JWT_TTL_SECONDS` | 3600 | No | Token TTL |
| `SOVR_DEV_AUTO_GRANT` | **false** | must be `false` | Auto-grant capabilities (dev only) |
| `SOVR_KAFKA_ENABLED` | false | Optional | Enable Kafka publisher |
| `SOVR_KAFKA_BROKERS` | `[]` | If Kafka enabled | Broker addresses |
| `SOVR_REDIS_ENABLED` | false | Optional | Enable Redis stream publisher |
| `SOVR_REDIS_URL` | `redis://localhost:6379` | If Redis enabled | Redis URL |
| `SOVR_ACH_ROUTING_NUMBER` | `021000021` | No | ACH routing number |
| `SOVR_ACH_BANK_NAME` | `SOVR Sandbox Bank` | No | ACH bank name |
| `SOVR_ACH_LATENCY_MS` | 50 | No | ACH simulation latency |
| `HOST` | `0.0.0.0` | No | Bind host |
| `PORT` | `3001` | No | Bind port |
| `SOVR_LOG_LEVEL` | `info`/`debug` | No | Log level |
| `DATABASE_URL` | — | Optional | PostgreSQL URL for event store |

### Deployment

**Dockerfile** (`deployment/Dockerfile`):
- Multi-stage build: `deps` → `build` → `runtime`
- Base: `node:20-alpine`
- Exposes port 3001
- Runs as non-root `node` user
- Copies compiled TypeScript + YAML specs + `domains/` + `protocol/`

**docker-compose.yml** (`deployment/docker-compose.yml`):
- Services: `redis:7-alpine`, `bitnami/kafka:3.7`, `sovr-api`
- Health checks for all services
- `sovr-api` depends_on Redis and Kafka with health conditions
- Environment: `NODE_ENV=production`, Kafka + Redis enabled

**Production startup:**
```bash
docker compose -f deployment/docker-compose.yml up --build
```

**Local development:**
```bash
bash scripts/setup.sh
PORT=3001 node packages/runtime/dist/server/index.js
```

### Boot Sequence (8 Runlevels)

| Runlevel | Linux Analogy | SOVR Stage | What It Does |
|----------|---------------|------------|--------------|
| 0 | BIOS POST | FIRMWARE_POST | SHA-256 self-test, Node ≥20 check |
| 1 | GRUB + Secure Boot | BOOTLOADER | Verify compiler-manifest build_hash |
| 2 | Kernel decompress | KERNEL_INIT | Load 10 invariants, envelope, authority model |
| 3 | Mount root fs | CORE_DOMAINS | Vault, Ledger, Treasury — topological order |
| 4 | Load LSM/SELinux | SECURITY_SUBSYSTEM | Identity, Policy, Intent, Agent |
| 5 | Load drivers | EXECUTION_BOUNDARY | Payment rails, Hybrid boundaries, Oracles |
| 6 | Mount /proc | INTERPRETATION | Projection engine — 15 read models rebuilt |
| 7 | systemd → graphical | USERLAND | Runtime SDK, OpenAPI endpoints, HEALTHY |

**Frontend gate:** Must not accept financial commands until Runlevel 7 returns `HEALTHY`.

**Boot Attestation:**
```
boot_hash = sha256(build_hash + boot_log_hash + boot_timings_hash + final_health)
```
Output: `generated/boot.log`, `generated/boot-manifest.json`, `generated/boot-attestation.json`

---

## 10. Documentation Describing Asset Lifecycle

### Key Documentation Files

| Document | Path | Relevance |
|----------|------|-----------|
| Protocol Manifest | `00_protocol-manifest.yaml` | Entry point, layers, domains, build phases |
| Constitution | `01_constitution.yaml` | 10 invariants, financial integrity rules, authority model |
| Vault Domain Spec | `domains/vault.yaml` | Asset types, ownership/custody model, reserve management, collateral framework, state machines |
| Ledger Domain Spec | `domains/ledger.yaml` | Double-entry accounting, journal entry model, event-to-journal mappings |
| Treasury Domain Spec | `domains/treasury.yaml` | Transfer lifecycle, liquidity management, saga definitions |
| Payment Domain Spec | `domains/payment.yaml` | 12 rail adapters, routing engine, settlement coordinator, reconciliation |
| Hybrid Boundary | `hybrid-boundary.yaml` | Blockchain boundaries, oracle boundaries, reorg handling |
| Event Catalog | `04_event-catalog.yaml` | 259 events with 21-field envelope definitions |
| Command Catalog | `03_command-catalog.yaml` | 105 commands with validation rules and constitutional gates |
| State Machines | `05_state-machines.yaml` | 43 state machines for all domain lifecycles |
| Saga Orchestration | `09_saga-orchestration.yaml` | Multi-domain workflow orchestration with compensation |
| Security Capabilities | `08_security-capabilities.yaml` | 111 capabilities with scope pattern language |
| Domain Model | `02_domain-model.yaml` | 48 entities across 10 domains |
| API Service Guide | `docs/guides/PROTOCOL_API_SERVICE_GUIDE.md` | Complete API reference, connection model, verification |
| Architecture Docs | `docs/architecture/README.md` | C4 context, sequence diagrams, connection model |
| Audit Reports | `docs/audit/`, `docs/reports/` | Self-test reports, findings register, full audit |
| Deployment Guide | `docs/deployment/` | Docker, Kubernetes, integration guide, compliance checklist |
| Compliance | `docs/compliance/` | SOC2 control mapping, evidence |

### Asset Lifecycle State Machines

**Asset Lifecycle** (`vault_asset_lifecycle`):
```
REGISTERED → VERIFIED → AVAILABLE → RESERVED → LOCKED → CONSUMED → RELEASED
                                                      ↓
                                            RECONCILIATION_REQUIRED
                                                      ↓
                                                AVAILABLE / LOCKED / VERIFIED
Final states: REJECTED, IMPAIRED
```

**Reservation Lifecycle** (`vault_reservation_lifecycle`):
```
PENDING → ACTIVE → CONSUMED
              ↓         ↓
           EXPIRED   RELEASED
              ↓
           FAILED
Final states: EXPIRED, FAILED
```

**Collateral Lifecycle** (`vault_collateral_lifecycle`):
```
PROPOSED → ACTIVE → MARGIN_CALL → LIQUIDATING → RELEASED / LIQUIDATED
```

**Transfer Lifecycle** (`treasury_transfer_lifecycle`):
```
REQUESTED → AUTHORIZED → RESERVED → EXECUTING → PENDING_SETTLEMENT → SETTLED
                                      ↓
                              UNKNOWN_EXTERNAL_STATE
                                      ↓
                              FAILED / COMPENSATION_REQUIRED
Failure states: REJECTED, EXPIRED, FAILED, COMPENSATION_REQUIRED
```

---

## Key Findings and Observations

### 1. No Smart Contracts
This repository contains **no Solidity code**, **no on-chain deployments**, and **no blockchain interactions via smart contracts**. The `hybrid-boundary.yaml` and `EvmDriver` references define abstract interfaces for potential future blockchain integration, but these are specification-level only.

### 2. Spec-First Architecture
All financial behavior derives from the 15 YAML specification files. The compiler produces deterministic artifacts. The runtime contains zero domain knowledge — it executes against compiled registries. This was proven by the "Constitutional Proof XV3" where the Escrow domain was added via YAML-only changes and executed without runtime source modifications.

### 3. Polymorphic Asset Model
SOVR does not normalize all value to a single currency unit. Each asset type retains its native precision (cash=2, stablecoin=18, collateral=4, etc.). Cross-asset comparisons use the valuation layer. This avoids conversion risk and rounding errors.

### 4. Dual-Layer Double-Entry Enforcement
Financial integrity is enforced at two independent layers:
1. **SOVR CommandBus + GuardrailBus** (application layer) — rejects unbalanced ledger entries before persistence
2. **TigerBeetle** (storage layer) — enforces double-entry at the database level

If TigerBeetle rejects a transfer, the SOVR event is NOT written.

### 5. Event Sourcing as Source of Truth
All financial state derives from an append-only event log. Projections are derived read models that are **never authoritative**. If a projection disagrees with the event log, the event log wins (INV-006). The event log is stored in `generated/data/sovr-events.json` (dev) or PostgreSQL (production).

### 6. Extensive but Partially Implemented
The specification is complete and frozen (v1.0.0), but the runtime is `v1.0.0-rc` (reference implementation):
- ✅ 105 commands specified, many executable via universal route
- ✅ 259 events with 21-field envelope
- ✅ 43 state machines embedded in compiled IR
- ✅ 16 projections rebuilt from genesis
- ✅ 12 rail adapter interfaces (ACH fully wired, others scaffolds)
- ✅ TigerBeetle financial database integration
- ✅ PostgreSQL production event store
- ⚠️ Full YAML-driven routing for all commands not yet complete
- ⚠️ Capability grants in-memory only (not fully persistent)
- ⚠️ TLA+ models generated but not yet model-checked in CI
- ⚠️ 4 integration tests blocked on execution-gate configuration (TD-002)

### 7. Security Model
- **10 immutable invariants** (INV-001 through INV-010) enforced at runtime
- **107 capabilities** with scope pattern language (`{resource}:{id}:{field}` with wildcards)
- **7-stage command pipeline:** Identity → Capability → Scope → Policy → Constitutional → Execution → Publication
- **Agent governance:** AI agents cannot mint assets, grant capabilities, or bypass policy (INV-004, INV-010)
- **Conflict resolution priority:** Invariant Preservation > Asset Security > Regulatory Compliance > Ledger Integrity > Transaction Completion > Operational Efficiency > Agent Autonomy

---

## File Path Reference

### Smart Contracts
- **None found.** Searched `**/*.sol`, `foundry.toml`, `hardhat.config.*` — all returned zero results.

### Core Protocol Specifications
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\00_protocol-manifest.yaml`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\01_constitution.yaml`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\02_domain-model.yaml`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\03_command-catalog.yaml`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\04_event-catalog.yaml`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\05_state-machines.yaml`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\08_security-capabilities.yaml`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\09_saga-orchestration.yaml`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\12_domain-contracts.yaml`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\hybrid-boundary.yaml`

### Domain Specifications
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\domains\vault.yaml`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\domains\ledger.yaml`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\domains\treasury.yaml`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\domains\payment.yaml`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\domains\identity.yaml`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\domains\policy.yaml`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\domains\intent.yaml`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\domains\agent.yaml`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\domains\governance.yaml`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\domains\escrow.yaml`

### Runtime Source
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\packages\runtime\src\server\index.ts`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\packages\runtime\src\server\commandBus.ts`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\packages\runtime\src\server\eventStore.ts`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\packages\runtime\src\server\projectionEngine.ts`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\packages\runtime\src\server\capabilityEngine.ts`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\packages\runtime\src\execution\saga-interpreter.ts`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\packages\runtime\src\execution\state-machine-interpreter.ts`

### Adapters
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\packages\runtime\src\adapters\base\BaseRailDriver.ts`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\packages\runtime\src\adapters\ach\AchDriver.ts`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\packages\runtime\src\adapters\stablecoin\StablecoinDriver.ts`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\packages\runtime\src\adapters\oracle\PriceOracleDriver.ts`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\packages\runtime\src\adapters\tigerbeetle\TigerBeetleDriver.ts`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\packages\runtime\src\adapters\tigerbeetle\TigerBeetleAccountManager.ts`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\packages\runtime\src\adapters\postgres-event-store.ts`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\packages\runtime\src\adapters\boundary.ts`

### Deployment
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\deployment\Dockerfile`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\deployment\docker-compose.yml`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\deployment\docker-compose.dev.yml`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\deployment\docker-compose.production.yml`

### Documentation
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\README.md`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\docs\guides\PROTOCOL_API_SERVICE_GUIDE.md`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\docs\architecture\README.md`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\docs\deployment\INTEGRATION-GUIDE.md`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\docs\compliance\SOC2-CONTROL-MAPPING.md`
- `D:\sovr-financial-os-protocol-v1.0.0\SOVR-Protocol\docs\security\threat-model.md`

---

## Conclusion

**SOVR Financial OS is a spec-first financial protocol kernel, not a blockchain or DeFi protocol with on-chain smart contracts.** The repository's "assets" are protocol-level abstractions defined in YAML (cash, stablecoin, tokenized_asset, collateral_position, liquidity_position, external_claim). The runtime manages these assets through event sourcing, double-entry accounting, and a constitutional enforcement pipeline — all off-chain in a TypeScript/Fastify server backed by PostgreSQL and TigerBeetle.

The project's value proposition is deterministic compilation of a YAML constitution into an executable financial kernel. It defines the *specification* for how assets should be minted, reserved, transferred, and redeemed — but does not itself deploy ERC20s, vault contracts, or lending pools on any blockchain.

**Risk Assessment:**
- **Smart contract risk:** N/A — no smart contracts exist
- **On-chain asset risk:** N/A — no on-chain assets deployed
- **Off-chain runtime risk:** Medium — reference implementation, partial feature coverage, in-memory capability grants
- **Oracle risk:** Low — oracles are advisory only, Vault valuations are authoritative
- **Custody risk:** Medium — external custody providers defined but not production-audited
- **Integration risk:** Medium — most rail adapters are scaffolds, only ACH and Stablecoin (Circle) are fully wired
- **Reproducibility risk:** Low — build hash verified byte-identical

**Assessment completed.**
