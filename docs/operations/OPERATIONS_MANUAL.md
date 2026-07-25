# SOVR Protocol — Enterprise Operations Manual

**Version:** v0.9.0-rc  
**Generated:** 2026-07-25T03:11:13-07:00  
**Build Hash:** `d27fdbe60290ba976f684bb7d0096b911195776d975bb1da8bdd6c56d835e512`  

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Deployment Topology](#deployment-topology)
4. [Operational Procedures](#operational-procedures)
5. [Monitoring & Observability](#monitoring--observability)
6. [Backup & Recovery](#backup--recovery)
7. [Incident Response](#incident-response)
8. [Disaster Recovery](#disaster-recovery)
9. [Maintenance Windows](#maintenance-windows)
10. [Escalation Procedures](#escalation-procedures)

---

## Overview

This manual provides operational guidance for deploying and maintaining the SOVR Protocol in enterprise production environments.

**Audience:** Operations engineers, SREs, system administrators  
**Classification:** Internal — Enterprise Operations  
**Version:** v0.9.0-rc (Pre-Audit Release Candidate)

---

## System Architecture

### Components

| Component | Purpose | Port | Protocol |
|---|---|---|---|
| SOVR API | HTTP/WebSocket API | 3001 | HTTP/1.1, WebSocket |
| PostgreSQL | Event store, state | 5432 | TCP |
| Redis | Streams, rate limiting | 6379 | TCP |
| Kafka | Event publication | 9092 | TCP |
| NGINX/HAProxy | Load balancer, TLS termination | 80/443 | HTTPS |

### Network Topology

```text
Internet
    ↓
[Load Balancer / Ingress]
    ↓
[NGINX/HAProxy — TLS termination]
    ↓
[SOVR API Pods — 3 replicas]
    ↓
[PostgreSQL — Primary + Replica]
    ↓
[Redis — Cluster]
    ↓
[Kafka — 3 brokers]
```

---

## Operational Procedures

### 1. Startup Sequence

```bash
# 1. Verify secrets
echo $JWT_PRIVATE_KEY | head -c 32
echo $DATABASE_URL | grep -o 'postgresql://'

# 2. Verify PostgreSQL
pg_isready -h $DATABASE_HOST -p 5432

# 3. Verify Redis
redis-cli -h $REDIS_HOST ping

# 4. Verify Kafka
kafka-broker-api-versions --bootstrap-server $KAFKA_BROKERS

# 5. Start SOVR API
PORT=3001 node dist/server/index.js

# 6. Verify health
curl http://localhost:3001/health
# Expected: {"status":"HEALTHY","runlevels":8,"final_health":"HEALTHY"}

# 7. Verify boot attestation
curl http://localhost:3001/api/v1/boot-attestation | jq .
```

### 2. Rolling Update

```bash
# 1. Scale down gracefully
kubectl scale deployment sovr-api --replicas=2 -n sovr

# 2. Wait for drain
kubectl wait --for=condition=ready pod -l app=sovr-api -n sovr --timeout=60s

# 3. Update image
kubectl set image deployment/sovr-api sovr-api=sovr/protocol:0.9.1 -n sovr

# 4. Rolling update
kubectl rollout status deployment/sovr-api -n sovr --timeout=300s

# 5. Verify health
kubectl exec -it deploy/sovr-api -n sovr -- curl -f http://localhost:3001/health

# 6. Scale up
kubectl scale deployment sovr-api --replicas=3 -n sovr
```

### 3. Rollback

```bash
# 1. Rollback to previous revision
kubectl rollout undo deployment/sovr-api -n sovr

# 2. Verify rollback
kubectl rollout status deployment/sovr-api -n sovr --timeout=300s

# 3. Verify health
kubectl exec -it deploy/sovr-api -n sovr -- curl -f http://localhost:3001/health
```

---

## Monitoring & Observability

### Metrics

| Metric | Source | Alert Threshold |
|---|---|---|
| API request rate | Fastify metrics | > 1000 req/s |
| API latency p99 | Fastify metrics | > 500ms |
| Error rate | Fastify metrics | > 1% |
| PostgreSQL connections | pg_stat_activity | > 80% of pool |
| Redis memory | INFO memory | > 80% of max |
| Kafka consumer lag | kafka-consumer-groups | > 1000 messages |
| Pod restarts | Kubernetes | > 3 in 5 minutes |
| Disk usage | Node exporter | > 85% |

### Health Checks

```bash
# Liveness probe
curl -f http://localhost:3001/health

# Readiness probe
curl -f http://localhost:3001/health/ready

# Boot attestation
curl -f http://localhost:3001/api/v1/boot-attestation | jq '.boot_hash'

# Build hash verification
curl -s http://localhost:3001/api/v1/manifest | jq '.build_hash'
```

### Logging

| Component | Log Format | Retention |
|---|---|---|
| SOVR API | JSON structured | 30 days |
| PostgreSQL | CSV | 90 days |
| Kafka | JSON | 30 days |
| NGINX | Combined | 30 days |

---

## Backup & Recovery

### PostgreSQL Backup

```bash
# Full backup
pg_dump -h $DB_HOST -U sovr -F c -f /backups/sovr-$(date +%Y%m%d).dump sovr

# Verify backup
pg_restore -l /backups/sovr-20260725.dump | head

# Restore
pg_restore -h $DB_HOST -U sovr -d sovr /backups/sovr-20260725.dump
```

### Backup Schedule

| Backup Type | Frequency | Retention |
|---|---|---|
| Full backup | Daily | 30 days |
| WAL archiving | Continuous | 7 days |
| Snapshot | Weekly | 12 weeks |

---

## Incident Response

### Severity Levels

| Level | Description | Response Time | Escalation |
|---|---|---|---|
| P1 — Critical | System down, data loss | 15 minutes | VP Engineering |
| P2 — High | Degraded performance, partial outage | 1 hour | Engineering Manager |
| P3 — Medium | Minor issue, workaround available | 4 hours | Team Lead |
| P4 — Low | Cosmetic, documentation | 24 hours | Team |

### Incident Response Procedure

1. **Detect:** Monitoring alert or user report
2. **Assess:** Determine severity and impact
3. **Respond:** Follow runbook for severity level
4. **Communicate:** Update status page, notify stakeholders
5. **Resolve:** Apply fix, verify recovery
6. **Post-mortem:** Document root cause, action items

---

## Disaster Recovery

### RPO/RTO Targets

| Metric | Target |
|---|---|
| Recovery Point Objective (RPO) | 15 minutes |
| Recovery Time Objective (RTO) | 1 hour |

### DR Scenarios

| Scenario | Procedure |
|---|---|
| PostgreSQL failure | Promote read replica, update connection string |
| Kafka failure | Restart brokers, verify partition distribution |
| API pod failure | Kubernetes self-healing (restart policy) |
| Load balancer failure | DNS failover to secondary LB |
| Region failure | DNS failover to secondary region |

---

## Maintenance Windows

### Scheduled Maintenance

| Window | Time | Activities |
|---|---|---|
| Daily | 02:00–04:00 UTC | Log rotation, index optimization |
| Weekly | Sunday 02:00–06:00 UTC | PostgreSQL VACUUM, Kafka log cleanup |
| Monthly | First Sunday 02:00–08:00 UTC | Dependency updates, security patches |

### Emergency Maintenance

- No scheduled downtime required for rolling updates
- PostgreSQL maintenance requires replica promotion
- Kafka rolling restart requires partition rebalance

---

## Escalation Procedures

### On-Call Rotation

| Role | Contact | Escalation |
|---|---|---|
| Primary On-Call | PagerDuty | 15 minutes |
| Secondary On-Call | PagerDuty | 30 minutes |
| Engineering Manager | Slack #engineering | 1 hour |
| VP Engineering | Slack #leadership | 2 hours |

### Communication Channels

| Channel | Purpose |
|---|---|
| #sovr-ops | Operational alerts |
| #sovr-incidents | Incident response |
| #sovr-oncall | On-call coordination |
| email: ops@sovr.com | External notifications |

---

*Operations manual generated for enterprise deployment. All procedures verified against reference implementation.*
