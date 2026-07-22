# Performance & Scalability Model (Initial)

## Current Characteristics (2026-07-22)

- Single-threaded Fastify baseline
- Event append is the main bottleneck
- Projections are in-memory by default

## Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Commands/sec | 1,000+ | With Postgres-backed store |
| Event append latency | < 10ms p99 | Local disk |
| Projection rebuild | < 30s for 1M events | On boot |
| Concurrent actors | 10,000+ | With proper rate limiting |

## Scaling Strategies

1. **Vertical**: More CPU + fast NVMe for event store
2. **Horizontal**: Multiple API nodes + shared durable log (Kafka/Postgres)
3. **Read scaling**: Dedicated projection replicas
4. **Sharding**: By actor or by domain (future)

## Bottleneck Analysis

- Current: In-memory EventStore + file I/O
- Next: Switch primary store to Postgres + logical replication

**Recommendation**: Run load tests against the real server before committing to scale targets.