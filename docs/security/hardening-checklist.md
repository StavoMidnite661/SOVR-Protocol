# SOVR Production Security Hardening Checklist

**Status:** 2026-07-22

## Must-Do Before Production

### 1. Secrets & Identity
- [ ] Set strong `SOVR_JWT_SECRET` (≥32 random bytes)
- [ ] `SOVR_DEV_AUTO_GRANT=false` (enforced in config)
- [ ] Rotate JWT secret on every deployment
- [ ] Use short-lived JWTs (≤1h) + refresh tokens

### 2. Event Store
- [ ] Enable `strictCausation: true`
- [ ] Expose Merkle root / event store hash in `/health`
- [ ] Regular backups of `generated/data/sovr-events.json`
- [ ] Consider append-only filesystem or WORM storage

### 3. Network & Access
- [ ] mTLS between services (or strong network policies)
- [ ] API only reachable from trusted networks / via API Gateway
- [ ] Rate limiting per actor + global limits
- [ ] Disable unnecessary endpoints in production build

### 4. Adapters & External
- [ ] Only register approved rail adapters
- [ ] All adapters must emit events only
- [ ] Timeout + compensation policies per rail

### 5. Observability & Auditing
- [ ] Enable Kafka/Redis in production
- [ ] Ship all events to long-term audit store
- [ ] Monitor for:
  - INV-00x violations
  - Causation breaks
  - Unusual capability grants
  - Adapter failures

### 6. Build & Deployment
- [ ] Always verify build_hash chain on startup
- [ ] Reproducible builds enforced in CI
- [ ] Sign container images
- [ ] No `SOVR_DEV_*` flags in prod images

## Nice-to-Have

- Web Application Firewall in front of API
- Anomaly detection on event patterns
- Automated capability review reports
- Periodic full event store Merkle verification

**Current Gaps (2026-07-22):**
- No Merkle root yet
- Causation is still fail-open by default
- Limited rail adapters implemented

Update this checklist as features are added.