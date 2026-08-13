<!--
HISTORICAL / REMEDIATION RECORD

This file does not describe the current SOVR architecture.
See docs/ARCHITECTURE.md for the implementation that exists now.
-->

# SOVR Protocol — Compliance Checklist
**Version:** v1.0.0-rc
**Date:** 2026-07-25
**Classification:** External / Institution Restricted

---

## Pre-Deployment Checklist

### Security

- [ ] RS256 keypair generated (4096-bit minimum)
- [ ] Keys stored in secrets manager (HashiCorp Vault or AWS Secrets Manager), not in repository
- [ ] `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` environment variables set
- [ ] `DATABASE_URL` uses SSL (`sslmode=require` minimum, `verify-full` preferred)
- [ ] Database user has INSERT/SELECT only (no DDL, no superuser)
- [ ] PostgreSQL not exposed to public internet (private network only)
- [ ] TLS 1.2+ configured at reverse proxy (TLS 1.3 preferred)
- [ ] HSTS enforced at reverse proxy
- [ ] Rate limiting verified active (`@fastify/rate-limit` v11 + `FinancialRateLimiter`)
- [ ] `npm audit --omit=dev --audit-level=high` shows 0 HIGH/0 CRITICAL
- [ ] `SOVR_DEV_AUTO_GRANT=false` in production environment
- [ ] `NODE_ENV=production` set

**Ground truth:** `packages/runtime/src/security/jwt.ts` — production fails-closed without keys.
**Ground truth:** `npm audit --omit=dev --audit-level=high` — 0 HIGH/0 CRITICAL (verified 2026-07-25).
**Ground truth:** `packages/runtime/src/adapters/postgres-event-store.ts` — immutable triggers on `sovr_events` and `sovr_aggregate_states`.

### Operational

- [ ] `docs/operations/RUNBOOK.md` reviewed by operations team
- [ ] Key rotation procedure tested (see RUNBOOK Section: Key Rotation)
- [ ] Incident response runbook distributed (P1-P4 classifications)
- [ ] PostgreSQL backup verified and tested (RTO 4h target)
- [ ] Health endpoint monitored (`/health` polling or synthetic check)
- [ ] Log aggregation configured (structured JSON via pino)
- [ ] Build hash verified: `node packages/compiler/dist/cli.js verify` outputs matching hash
- [ ] Boot attestation chain verified: `/api/v1/manifest` and `/api/v1/boot-attestation` hashes match
- [ ] Demo smoke test passes: `bash scripts/demo.sh` → 13/13
- [ ] Integration tests pass: `npm run test:integration` → 16/16

**Ground truth:** `docs/operations/RUNBOOK.md` — all sections exist (deployment, health, key rotation, incident response, DR, backup, rollback).
**Ground truth:** `test/integration.test.ts` — 16/16 integration tests pass.
**Ground truth:** `scripts/demo.sh` — 13 checks defined.

### Compliance

- [ ] SOC2 control mapping reviewed (`docs/compliance/SOC2-CONTROL-MAPPING.md`)
- [ ] CC6.1 — Logical Access Controls: capability registry active
- [ ] CC6.2 — Authentication: RS256 JWT production fails-closed verified
- [ ] CC6.3 — Authorization: actor type restrictions tested
- [ ] CC7.1 — Monitoring: Fastify pino logging configured
- [ ] CC8.1 — Change Management: build hash + compiler certification verified
- [ ] CC9.2 — Risk Mitigation: rate limiting + circuit breakers active
- [ ] GDPR pseudonymization approach reviewed (`docs/compliance/evidence/GDPR/data-classification.md`)
- [ ] GDPR retention policy confirmed (`docs/compliance/evidence/GDPR/retention-policy.md`)
- [ ] Right to erasure approach documented (`docs/compliance/evidence/GDPR/right-to-erasure.md`)
- [ ] Data residency requirements confirmed with institution
- [ ] Audit log retention policy set (minimum 7 years for financial records per `regulatory_7y` class)
- [ ] Penetration test scheduled (required before v1.0.0 external audit)
- [ ] Pentest surface map reviewed (`docs/security/PENTEST-SURFACE-MAP.md`)
- [ ] Threat model reviewed (`docs/security/threat-model.md` — 5 categories, 16 threats)

**Ground truth:** `docs/compliance/SOC2-CONTROL-MAPPING.md` — 6 controls documented.
**Ground truth:** `docs/compliance/evidence/GDPR/` — 3 documents (retention-policy, right-to-erasure, data-classification).
**Ground truth:** `docs/security/threat-model.md` — 5 threat categories, 16 threats.
**Ground truth:** `docs/security/PENTEST-SURFACE-MAP.md` — exists.

### Verification

- [ ] 16/16 integration tests pass on target environment
- [ ] Demo 13/13 passes on target environment
- [ ] Registry manifest hash matches expected: `b7d8221b0d7359a7...`
- [ ] Purity audit: 0 violations confirmed
- [ ] All 35 REST endpoints responding (24 GET, 11 POST)
- [ ] WebSocket `/api/v1/events/stream` connects and receives events
- [ ] PostgreSQL immutable triggers verified active
- [ ] `npm audit --omit=dev --audit-level=high` = 0 findings

---

## SOC2 Control Verification Commands

```bash
# CC6.1 — Logical Access
curl -X POST http://localhost:3001/api/v1/vault/asset \
  -H "Authorization: Bearer invalid" \
  -d '{"commandName":"vault.asset.register"}'
# Expected: 403 or 401

# CC6.2 — Authentication
NODE_ENV=production node packages/runtime/dist/server/index.js
# (without JWT_PRIVATE_KEY set)
# Expected: FATAL error on startup

# CC6.3 — Authorization
# Create session as ai_agent, attempt governance command
# Expected: 403 UNAUTHORIZED ACTOR TYPE

# CC7.1 — Monitoring
curl http://localhost:3001/health | jq '.subsystems'
# Expected: all subsystems ok: true

# CC8.1 — Change Management
node packages/compiler/dist/cli.js verify
# Expected: "Reproducible build verified: b7d8221b..."

# CC9.2 — Risk Mitigation
# Send 25 rapid POST requests to /api/v1/vault/asset
# Expected: 429 RATE_LIMITED on request 21+
```

---

## GDPR Compliance Points

| Requirement | SOVR Implementation | Document |
|---|---|---|
| Art. 5(1)(e) — Storage limitation | Immutable event store (permanent class) with retention metadata | `docs/compliance/evidence/GDPR/retention-policy.md` |
| Art. 32 — Security of processing | RS256 JWT, TLS, immutable DB triggers, rate limiting | `docs/deployment/SECURITY-REQUIREMENTS.md` |
| Art. 17 — Right to erasure | Pseudonymization via actor_id; permanent class exempt under Art. 17(3)(b) | `docs/compliance/evidence/GDPR/right-to-erasure.md` |
| Art. 25 — Data protection by design | Capability-scoped access, no PII in event payloads by default | `docs/compliance/evidence/GDPR/data-classification.md` |

**Note:** Financial event logs are immutable by constitutional design (INV-001). This is a legal obligation exception under GDPR Art. 5(1)(e) and Art. 17(3)(b) (legal obligation requiring long-term retention).

---

## Audit Evidence Checklist

For external auditor day-one package:

- [ ] `docs/security/threat-model.md` — 5 categories, 16 threats, all with mitigations
- [ ] `docs/compliance/SOC2-CONTROL-MAPPING.md` — 6 controls with test procedures
- [ ] `npm audit --omit=dev --audit-level=high` output — 0 findings
- [ ] `docs/security/PENTEST-SURFACE-MAP.md` — attack surface documented
- [ ] `docs/operations/RUNBOOK.md` — operational procedures
- [ ] `docs/deployment/INSTITUTION-DEPLOYMENT.md` — this package
- [ ] `test/integration.test.ts` — 16/16 passing (CI artifact)
- [ ] `scripts/demo.sh` output — 13/13 passing (CI artifact)
- [ ] `generated/registry.manifest.json` — content-addressed artifact hashes
- [ ] `docs/deployment/ARCHITECTURE-SUMMARY.md` — system architecture
