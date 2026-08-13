<!--
HISTORICAL / REMEDIATION RECORD

This file does not describe the current SOVR architecture.
See docs/ARCHITECTURE.md for the implementation that exists now.
-->

# SOVR Protocol — Security Requirements
**Version:** v1.0.0-rc
**Date:** 2026-07-25
**Classification:** External / Institution Restricted

---

## Key Management

### RS256 JWT Keys

| Property | Requirement |
|---|---|
| Algorithm | RS256 (asymmetric — private signs, public verifies) |
| Key Size | 4096-bit minimum |
| Rotation | Every 90 days (scheduled) or immediate (incident) |
| Storage | HashiCorp Vault or AWS Secrets Manager |
| Format | PEM (PKCS#8 private, SPKI public) |
| Prohibited | Never commit to source control |
| Prohibited | Never log in plaintext |
| Prohibited | Never transmit over unencrypted channel |

**Production fails-closed:** `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` environment variables are required at startup when `NODE_ENV=production`. Missing keys cause a FATAL error and process exit.

**Development mode:** Ephemeral RS256 keys are auto-generated on boot when keys are not provided. Tokens are invalid after restart. This prevents token reuse across sessions in non-production environments.

**Ground truth:** `packages/runtime/src/security/jwt.ts` — `JWTService.initialize()` enforces key presence in production.
**Ground truth:** `docs/compliance/evidence/SOC2/CC6.2-authentication.md` — production fails-closed behavior documented.

### Key Rotation Procedure

See: `docs/operations/RUNBOOK.md` — Section: Key Rotation Procedure.

Summary:
1. Generate new RS256 keypair (4096-bit)
2. Store new keys in secrets manager
3. Update environment variables to new keys
4. Restart runtime (graceful reload preferred)
5. Invalidate all existing JWTs by changing `jti` namespace or waiting for expiry
6. Old keys may be kept in verification-only mode for grace period (not implemented in v0.6.0)
7. Remove old keys from secrets manager after grace period

**Current gap:** Grace-period dual-key verification is not implemented in v0.6.0. Key rotation requires immediate cutover.

---

## Database Security

| Control | Requirement |
|---|---|
| Connection | SSL required (`sslmode=require` minimum, `verify-full` preferred) |
| User | Dedicated `sovr_user` — INSERT, SELECT only |
| Superuser | Disabled for application user |
| Encryption | At-rest encryption at storage layer (PostgreSQL pgcrypto or storage-level) |
| Backups | Encrypted, stored separately from primary |
| Network | PostgreSQL not exposed to public internet |

**Ground truth:** `deployment/docker-compose.production.yml` — PostgreSQL service uses private `sovr-network`.
**Ground truth:** `packages/runtime/src/adapters/postgres-event-store.ts` — `MIGRATION_SQL` creates `sovr_events` and `sovr_aggregate_states` with PostgreSQL triggers that raise exceptions on UPDATE/DELETE.
**Ground truth:** `docs/operations/RUNBOOK.md` — Firewall rules: 5432 restricted.

### Immutable Event Store

The PostgreSQL event store enforces immutability at the database level:

```sql
CREATE TRIGGER sovr_events_prevent_update_delete
  BEFORE UPDATE OR DELETE ON sovr_events
  FOR EACH ROW EXECUTE FUNCTION prevent_sovr_events_modification();
-- Raises: "sovr_events is immutable: UPDATE/DELETE not allowed"
```

**Ground truth:** `packages/runtime/src/adapters/postgres-event-store.ts` lines 206-213.

---

## Authentication Model

Every API request requires:

1. **Valid RS256 JWT** in `Authorization: Bearer {token}` header
2. **JWT issued by SOVR runtime only** — verified against `JWT_PUBLIC_KEY`
3. **JWT contains:** `sub` (actor_id), `iat`, `exp`, `actor_type`, `session_id`
4. **Capability checked** against registry before command execution

**Actor types:**
- `human` — individual users
- `ai_agent` — automated agents (excluded from governance commands per INV-004)
- `governance` — administrative functions
- `service_account` — system-to-system
- `external_system` — third-party integrations

**Ground truth:** `packages/runtime/src/server/index.ts` — `authFromBearer()` helper, lines 353-358.
**Ground truth:** `packages/runtime/src/security/jwt.ts` — `JWTService.verify()` enforces issuer (`sovr-protocol`), audience (`sovr-clients`), algorithm (`RS256`), expiration.

---

## Authorization Model

### Capability Registry

111 capability definitions with scope patterns.

Scope pattern language: `{resource}:{id}:{field}` with wildcard `*`.

Example grants:
- `vault.asset:*` — full access to vault asset commands
- `ledger.journal_entry:*` — full access to ledger journal commands
- `escrow.account:*` — full access to escrow account commands

**Ground truth:** `generated/registries/capabilities.registry.json` — 111 definitions.
**Ground truth:** `packages/runtime/src/server/capabilityEngine.ts` — capability registry and scope evaluation.

### Identity Enforcement

Actor type restrictions enforced at runtime:
- `ai_agent` actors are rejected from governance commands (INV-004)
- `human` actors required for identity session creation
- Capability grants require `governance` or `service_account` actor type

**Ground truth:** `test/integration.test.ts` — "REJECTS ai_agent actor type on governance grant (INV-004)" test, lines 197-215.

---

## Rate Limiting

Two rate-limiting layers active in production:

### Layer 1: @fastify/rate-limit (global)

| Parameter | Value |
|---|---|
| Scope | Global (all routes) |
| Max requests | 200 per minute |
| Key generator | `identityContext.actor_id` or `request.ip` |
| Error response | `RATE_LIMITED` with retry_after_ms |

**Ground truth:** `packages/runtime/src/server/index.ts` lines 291-304.
**Ground truth:** `packages/runtime/package.json` — `@fastify/rate-limit@^11.1.0`.

### Layer 2: FinancialRateLimiter (preHandler hook)

| Parameter | Value |
|---|---|
| Scope | POST /api/v1/* (excluding /identity/session) |
| Max requests | 20 per minute |
| Key | `x-actor-id` header or `request.ip` |
| Error response | 429 with `FINANCIAL_RATE_LIMIT_EXCEEDED` |

**Ground truth:** `packages/runtime/src/server/index.ts` lines 379-414.

---

## Threat Surface

From `docs/security/threat-model.md` v0.6.0:

| Category | Threats | Controls |
|---|---|---|
| Protocol Manipulation | 3 | Constitution lock hash, SHA-256 build hash, compiler certification |
| Runtime Attacks | 3 | RS256 JWT, capability registry, rate limiting |
| Data Attacks | 3 | Immutable PostgreSQL triggers, JSONB audit trail, TLS |
| Constitutional Attacks | 3 | Content-addressed registries, byte-identical reproducibility, build attestation |
| Infrastructure Attacks | 4 | npm audit, Docker isolation, network segmentation, secrets manager |

Total: **5 categories, 16 threats documented, 15 controls active.**

**Ground truth:** `docs/security/threat-model.md` — 5 threat categories, 16 threats.
**Ground truth:** `npm audit --omit=dev --audit-level=high` — 0 HIGH/CRITICAL.

---

## Supply Chain Security

| Control | Status |
|---|---|
| npm audit (production) | 0 HIGH, 0 CRITICAL |
| npm audit (all) | 10 findings, all in dev dependencies |
| Lockfile | package-lock.json committed |
| Dependency review | Required before merge |

**Ground truth:** Verified 2026-07-25 — `npm audit --omit=dev --audit-level=high` returns `found 0 vulnerabilities`.
**Ground truth:** Remaining 10 findings are in dev dependencies only: `@vitest/coverage-v8` → `brace-expansion` (HIGH), `vitest/vite` → `esbuild` (moderate). Not in production bundle.

---

## Secrets Management

| Secret | Purpose | Storage |
|---|---|---|
| `JWT_PRIVATE_KEY` | RS256 signing | HashiCorp Vault / AWS Secrets Manager |
| `JWT_PUBLIC_KEY` | RS256 verification | HashiCorp Vault / AWS Secrets Manager |
| `DATABASE_URL` | PostgreSQL connection | Environment variable (not in config files) |
| `SOVR_KAFKA_ENABLED` | Kafka toggle | Environment variable |
| `SOVR_REDIS_ENABLED` | Redis toggle | Environment variable |

**Prohibited:**
- Secrets in `.env` files committed to repository
- Secrets in Docker images
- Secrets in logs (structured JSON logging active)
- Secrets in error messages

**Ground truth:** `packages/runtime/src/server/config.ts` — environment variable loading.
**Ground truth:** `docs/operations/RUNBOOK.md` — Secret provisioning procedure.

---

## Compliance References

| Standard | Coverage | Document |
|---|---|---|
| SOC2 | 6 controls mapped | `docs/compliance/SOC2-CONTROL-MAPPING.md` |
| GDPR | Pseudonymization, retention, right to erasure | `docs/compliance/evidence/GDPR/` |
| Audit | Tamper-evident PostgreSQL event store | `packages/runtime/src/adapters/postgres-event-store.ts` |
| Pentest | Surface map documented | `docs/security/PENTEST-SURFACE-MAP.md` |

**Ground truth:** `docs/compliance/SOC2-CONTROL-MAPPING.md` — CC6.1, CC6.2, CC6.3, CC7.1, CC8.1, CC9.2.
**Ground truth:** `docs/compliance/evidence/GDPR/` — retention-policy.md, right-to-erasure.md, data-classification.md.
