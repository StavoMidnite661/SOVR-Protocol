# ADR: Multi-Node Architecture

**Status:** PROPOSED  
**Date:** 2026-07-24  
**Author:** SOVR Protocol Architecture

## Context

SOVR v0.8.0 is a single-node runtime.
For production financial infrastructure,
single-node is a single point of failure.

## Decision

SOVR will adopt a **shared event store**
multi-node architecture.

## Architecture

```
Node 1          Node 2          Node 3
  │               │               │
  └───────────────┼───────────────┘
                  │
          PostgreSQL Primary
          (shared event store)
                  │
          PostgreSQL Replica
          (read replicas for projections)
```

## Consistency Model

**Event Store:** Single PostgreSQL primary.
All writes go to primary.
Reads for projections use replicas.

**StateRegistry:** Each node maintains
its own in-memory cache.
On startup: rebuild from shared event store.
On event append: update local cache.
No cross-node state synchronization needed
because state is derived from events.

**Command Routing:** Any node accepts any command.
No sticky routing required.
StateRegistry on each node is eventually
consistent via event log replay.

## Constitutional Decisions

Emergency halt and governance decisions
require all-node propagation.

Mechanism: governance event published to
Kafka/Redis — all nodes subscribe and
enforce immediately.

## Failure Modes

| Scenario | Behavior |
|---|---|
| Node failure | Other nodes continue serving |
| PostgreSQL primary failure | Promote replica — replay events |
| Network partition | Nodes reject writes — read-only mode |
| Split brain | Impossible — single write primary |

## Implementation Phases

Phase 1 (v0.8.0): This ADR  
Phase 2 (v0.6.0): PostgreSQL replication setup  
Phase 3 (v1.0.0): Multi-node deployment  

## Rejected Alternatives

**Distributed consensus (Raft/Paxos):**
Rejected — adds complexity without benefit
given single-writer PostgreSQL model.

**Blockchain as event store:**
Rejected — latency unacceptable for
financial transaction throughput.

**Actor model (Akka/Orleans):**
Rejected — adds runtime dependency
incompatible with registry-driven kernel.
