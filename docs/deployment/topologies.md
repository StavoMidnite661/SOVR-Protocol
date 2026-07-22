# SOVR Deployment Topologies

## 1. Single Node (Development / Small Production)

```
[ SOVR API + Event Store (file) ]
         |
    [ Postgres (optional) ]
```

**Pros**: Simple  
**Cons**: No HA, file-based event store is single point of failure

## 2. Clustered (Recommended Starting Point)

```
          Load Balancer / API Gateway
                    |
    [SOVR Node 1] [SOVR Node 2] [SOVR Node 3]
           |            |            |
    Shared Event Store (Postgres + Kafka)
```

- Multiple API servers
- Event Store in Postgres (or Kafka as primary log)
- Projections can be sharded

## 3. Air-Gapped / High Security

- No outbound internet except for approved adapters
- All external communication goes through hardened boundary services
- Merkle-rooted event store exported periodically for offline audit

## 4. Multi-Region / Global

- Primary region owns the event store (strong consistency)
- Secondary regions run read-only projection replicas
- Cross-region replication of events via Kafka

## Data Durability Recommendations

- Regular snapshots of event store
- WAL / append-only log shipped to object storage
- Periodic full Merkle tree verification

## Configuration Flags for Production

```env
SOVR_KAFKA_ENABLED=true
SOVR_REDIS_ENABLED=true
SOVR_DEV_AUTO_GRANT=false
STRICT_CAUSATION=true
```

See `deployment/docker-compose.production.yml` as a starting template.