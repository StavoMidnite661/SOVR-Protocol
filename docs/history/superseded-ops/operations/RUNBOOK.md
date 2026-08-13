<!--
HISTORICAL / REMEDIATION RECORD

This file does not describe the current SOVR architecture.
See docs/ARCHITECTURE.md for the implementation that exists now.
-->

# SOVR Protocol — Operations Runbook

**Version:** 0.6.0  
**Last Updated:** 2026-07-24  
**Classification:** Internal — Operations

---

## Table of Contents

1. [Deployment Procedure](#deployment-procedure)
2. [Health Check Procedure](#health-check-procedure)
3. [Key Rotation Procedure](#key-rotation-procedure)
4. [Incident Response](#incident-response)
5. [Disaster Recovery](#disaster-recovery)
6. [Database Backup Procedure](#database-backup-procedure)
7. [Rollback Procedure](#rollback-procedure)

---

## Deployment Procedure

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | >= 20.0.0 | LTS recommended |
| PostgreSQL | >= 16 | With pgcrypto extension |
| JWT_PRIVATE_KEY | RS256, 4096-bit | PEM format |
| JWT_PUBLIC_KEY | RS256, 4096-bit | PEM format |
| DATABASE_URL | — | postgres://sovr:...@host:5432/sovr |
| PORT | 3001 | Default |

### Pre-Deployment Checklist

- [ ] Build hash verified: `node packages/compiler/dist/cli.js verify`
- [ ] No HIGH/CRITICAL npm audit findings (or accepted risk documented)
- [ ] JWT keys generated and stored in secrets manager
- [ ] DATABASE_URL configured
- [ ] PostgreSQL accessible from runtime host
- [ ] Firewall rules: 3001 (API), 5432 (PostgreSQL) restricted

### Deploy Steps

```bash
# 1. Pull release
git clone https://github.com/StavoMidnite661/SOVR-Protocol
cd SOVR-Protocol
git checkout v0.6.0

# 2. Verify build hash
node packages/compiler/dist/cli.js verify
# Expected: "Reproducible build verified: b7d8221b..."

# 3. Install dependencies
cd packages/runtime && npm install && cd ../..

# 4. Run database migrations
# (migrations run automatically on boot when DATABASE_URL is set)

# 5. Start runtime
PORT=3001 DATABASE_URL="postgres://..." JWT_PRIVATE_KEY="..." JWT_PUBLIC_KEY="..." node packages/runtime/dist/server/index.js

# 6. Verify health gate
curl http://localhost:3001/health
# Expected: final_health: "HEALTHY"

# 7. Verify build hash chain
curl -s http://localhost:3001/api/v1/manifest | jq -r '.build_hash'
curl -s http://localhost:3001/api/v1/boot-attestation | jq -r '.build_hash'
# Both must match

# 8. Run smoke test
bash scripts/demo.sh
# Expected: 13/13 passed
```

---

## Health Check Procedure

### Normal Health

```json
{
  "status": "HEALTHY",
  "final_health": "HEALTHY",
  "runlevel": 7,
  "build_hash": "b7d8221b...",
  "jwt": {
    "algorithm": "RS256",
    "mode": "production"
  },
  "rails": {
    "ach": {
      "state": "CLOSED",
      "failures": 0
    }
  },
  "subsystems": {
    "event_store": { "ok": true },
    "projections": { "ok": true },
    "capabilities": { "ok": true },
    "state_registry": { "ok": true },
    "build_provenance": { "ok": true }
  }
}
```

### Degraded Health

If `final_health: "DEGRADED"`:

1. Check PostgreSQL connectivity
   ```bash
   curl -s http://localhost:3001/health | jq '.subsystems.event_store'
   ```
   - If `connected: false`: Check DATABASE_URL, PostgreSQL service, network

2. Check circuit breaker state
   ```bash
   curl -s http://localhost:3001/health | jq '.rails'
   ```
   - If any rail `state: "OPEN"`: That rail's provider is down or SOVR is erroring. Wait for auto-recovery (half-open probe) or investigate adapter logs.

3. Check build provenance
   ```bash
   curl -s http://localhost:3001/health | jq '.subsystems.build_provenance'
   ```
   - If `ok: false`: Build hash mismatch. Do not accept financial commands. Investigate tampering or stale deployment.

4. Check runtime logs
   ```bash
   # Look for ERROR level entries
   grep ERROR runtime.log
   ```

### Unhealthy Health

If `final_health: "UNHEALTHY"`:
1. Do not accept financial commands
2. Escalate to on-call engineer immediately
3. Preserve logs and database state
4. Follow disaster recovery procedure

---

## Key Rotation Procedure

### When to Rotate Keys

- Scheduled: Every 90 days
- Emergency: Suspected key compromise
- On-boarding: New institution on-boarding

### Rotation Steps

```bash
# 1. Generate new key pair
openssl genrsa -out private.pem 4096
openssl rsa -in private.pem -pubout -out public.pem

# 2. Store new keys in secrets manager
# (AWS Secrets Manager, HashiCorp Vault, etc.)

# 3. Deploy new runtime instances with new keys
JWT_PRIVATE_KEY="$(cat private.pem)" \
JWT_PUBLIC_KEY="$(cat public.pem)" \
node packages/runtime/dist/server/index.js

# 4. Verify new instances are healthy
curl http://localhost:3001/health | jq '.jwt.mode'
# Expected: "production"

# 5. Drain old instances
# (Stop accepting new connections, wait for existing sessions to expire)
# Default JWT TTL: 1 hour
# Max wait: 1 hour

# 6. Remove old keys from secrets manager
# (Only after all old instances are drained)

# 7. Verify no old tokens are accepted
# (Try using old JWT — should be rejected)
```

### Zero-Downtime Rotation

1. Run two runtime instances side-by-side (old keys + new keys)
2. Both accept traffic during rotation
3. Old tokens (signed with old keys) are still valid until expiration
4. New tokens are signed with new keys
5. After TTL period, decommission old instance

---

## Incident Response

### Severity Levels

| Level | Description | Response Time | Examples |
|---|---|---|---|
| P1 | Financial impact or data breach | 15 minutes | Event log tampered, unauthorized transfers |
| P2 | Service degradation | 1 hour | Circuit breaker OPEN, PostgreSQL down |
| P3 | Security finding | 24 hours | Vulnerability reported, config issue |
| P4 | Enhancement | Next sprint | Feature request, optimization |

### P1 — Event Log Tampered

**Symptoms:**
- `UPDATE` or `DELETE` on `sovr_events` succeeds (trigger bypass)
- Build hash mismatch on boot
- Unexplained financial state changes

**Response:**
1. Halt system immediately (`kill -SIGTERM <pid>` or Docker stop)
2. Preserve database state — do NOT run migrations or modifications
3. Snapshot PostgreSQL: `pg_dump -Fc sovr > /backups/incident-$(date +%Y%m%d).dump`
4. Engage security team
5. Audit who had database access (PostgreSQL logs, SSH logs)
6. Restore from last known good backup
7. Document timeline and findings
8. Resume only after security team sign-off

### P2 — Rail Circuit Breaker OPEN

**Symptoms:**
- Any `rails.{railId}.state = "OPEN"` in health response
- Payment commands failing with 503

**Response:**
1. Check affected rail provider status page
2. If provider down: Document outage start time. Wait for auto-recovery (half-open probe).
3. If SOVR error: Check rail driver logs for stack traces
4. If SOVR bug: Rollback to last known good deployment
5. Notify stakeholders of payment delay

### P3 — Constitution Hash Mismatch

**Symptoms:**
- `CONST-LOCK-002` error on compilation
- `build_hash` in manifest != `build_hash` in attestation
- Boot fails with hash mismatch

**Response:**
1. Do NOT deploy
2. Identify which YAML file changed: `git diff HEAD~1 -- 01_constitution.yaml`
3. Determine if authorized:
   - Check governance proposal: `governance.proposal.submitted`
   - If authorized: Update release documentation with new hash
   - If NOT authorized: Roll back repository to last known good commit
4. Restore constitution from last known good snapshot

### P4 — JWT Key Compromise

**Symptoms:**
- Keys exposed in logs, CI/CD, or version control
- Unauthorized tokens detected
- Security researcher reports key exposure

**Response:**
1. Invalidate old keys immediately
2. Generate new key pair
3. Deploy new runtime with new keys (see Key Rotation Procedure)
4. Audit all tokens issued with old keys
5. If financial impact: trigger P1 response

---

## Disaster Recovery

### Recovery Time Objectives (RTO)

| Scenario | RTO | RPO |
|---|---|---|
| Single node failure | 5 minutes | 0 (events on shared PostgreSQL) |
| PostgreSQL primary failure | 10 minutes | < 1 minute (replica lag) |
| Full region failure | 1 hour | < 5 minutes (cross-region replica) |

### Database Recovery

```bash
# 1. Promote PostgreSQL replica
# (On replica host)
pg_ctl promote -D /var/lib/postgresql/data

# 2. Update DATABASE_URL
export DATABASE_URL="postgres://sovr:...@replica-host:5432/sovr"

# 3. Restart runtime
PORT=3001 node packages/runtime/dist/server/index.js

# 4. Verify StateRegistry rebuilds automatically
curl http://localhost:3001/health | jq '.subsystems.state_registry'
# Expected: ok: true, detail: "state registry rebuilt from event log"

# 5. Verify event count matches backup
curl http://localhost:3001/api/v1/events | jq '.total'
# Compare with last known good backup count
```

### Full System Recovery

```bash
# 1. Provision new infrastructure
# (Node.js 20+, PostgreSQL 16, network configuration)

# 2. Deploy from last verified release
git clone https://github.com/StavoMidnite661/SOVR-Protocol
cd SOVR-Protocol
git checkout v0.6.0

# 3. Verify build hash matches release tag
node packages/compiler/dist/cli.js verify
# Must match: b7d8221b0d7359a7733791d00cf32622df7b707ff4171c0c1b541d91d7568492

# 4. Restore PostgreSQL from backup
pg_restore -d sovr /backups/sovr-latest.dump

# 5. Verify event log integrity
# Count events in restored database vs backup
psql -d sovr -c "SELECT COUNT(*) FROM sovr_events;"

# 6. Start runtime
PORT=3001 DATABASE_URL="postgres://..." node packages/runtime/dist/server/index.js

# 7. Run smoke test
bash scripts/demo.sh
# Expected: 13/13 passed

# 8. Verify health
curl http://localhost:3001/health
# Expected: final_health: "HEALTHY"
```

---

## Database Backup Procedure

### Automated Backups

```bash
# Daily full backup (cron)
0 2 * * * pg_dump -Fc -U sovr -d sovr > /backups/sovr-$(date +\%Y\%m\%d).dump

# Weekly compressed backup
0 3 * * 0 gzip -9 /backups/sovr-$(date +\%Y\%m\%d -d "last week").dump

# Retention: 30 days
find /backups/ -name "sovr-*.dump" -mtime +30 -delete
```

### Manual Backup

```bash
# Full backup
pg_dump -Fc -U sovr -d sovr > /backups/sovr-manual-$(date +%Y%m%d).dump

# Verify backup
pg_restore -l /backups/sovr-manual-$(date +%Y%m%d).dump > /dev/null && echo "Backup valid"
```

### Backup Verification

```bash
# Monthly restore test
createdb sovr_test_restore
pg_restore -d sovr_test_restore /backups/sovr-latest.dump
psql -d sovr_test_restore -c "SELECT COUNT(*) FROM sovr_events;"
dropdb sovr_test_restore
```

---

## Rollback Procedure

### When to Rollback

- Health check returns DEGRADED or UNHEALTHY after deployment
- Demo script fails after deployment
- Error rate exceeds baseline
- Security finding introduced

### Rollback Steps

```bash
# 1. Identify last known good version
git tag --list | grep "v0.9" | sort -V | tail -5

# 2. Stop current runtime
kill -SIGTERM $(cat runtime.pid)

# 3. Checkout last known good
git checkout v0.6.0

# 4. Rebuild
cd packages/runtime && npm run build && cd ../..

# 5. Restart
PORT=3001 node packages/runtime/dist/server/index.js

# 6. Verify
curl http://localhost:3001/health
bash scripts/demo.sh
```

### Database Rollback

```bash
# If migration was applied and needs to be reversed
# (Only if migration is non-destructive — SOVR migrations are IF NOT EXISTS)
psql -U sovr -d sovr -c "DROP TABLE IF EXISTS sovr_did_documents, sovr_credentials CASCADE;"
```

---

## Appendix A: Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | 3001 | API server port |
| `HOST` | No | 0.0.0.0 | Bind host |
| `NODE_ENV` | No | development | Environment |
| `DATABASE_URL` | No | — | PostgreSQL connection string |
| `JWT_PRIVATE_KEY` | Production | — | RS256 private key (PEM) |
| `JWT_PUBLIC_KEY` | Production | — | RS256 public key (PEM) |
| `SOVR_JWT_ISSUER` | No | sovr-protocol | JWT issuer |
| `SOVR_JWT_AUDIENCE` | No | sovr-clients | JWT audience |
| `SOVR_JWT_TTL_SECONDS` | No | 3600 | JWT expiration |
| `SOVR_KAFKA_ENABLED` | No | false | Enable Kafka publisher |
| `SOVR_KAFKA_BROKERS` | No | — | Kafka broker list |
| `SOVR_REDIS_ENABLED` | No | false | Enable Redis publisher |
| `SOVR_REDIS_URL` | No | redis://localhost:6379 | Redis URL |
| `SOVR_LOG_LEVEL` | No | debug (dev), info (prod) | Log level |
| `SOVR_DEV_AUTO_GRANT` | No | false | Auto-grant capabilities (dev only) |

---

## Appendix B: Useful Commands

```bash
# Compile protocol
node packages/compiler/dist/cli.js compile

# Verify build hash
node packages/compiler/dist/cli.js verify

# Run demo
bash scripts/demo.sh

# Run tests
cd packages/runtime && npm run test:integration

# TypeScript check
cd packages/runtime && npx tsc --noEmit

# PostgreSQL connect
psql -U sovr -d sovr

# Check event count
psql -U sovr -d sovr -c "SELECT COUNT(*) FROM sovr_events;"

# Check circuit breaker state across all rails
curl -s http://localhost:3001/health | jq '.rails'

# Kill runtime (graceful)
kill -SIGTERM $(cat runtime.pid)

# Tail runtime logs
tail -f runtime.log | grep --color=always 'ERROR\|WARN\|HEALTHY'
```

---

## Appendix C: Escalation Paths

| Issue | Escalation | Contact |
|---|---|---|
| P1 — Data breach | Security team + Legal | security@sovr.protocol |
| P2 — Service down | On-call engineer | oncall@sovr.protocol |
| P3 — Vulnerability | Security team | security@sovr.protocol |
| P4 — Enhancement | Engineering lead | engineering@sovr.protocol |
