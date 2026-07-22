# SOVR Threat Model (STRIDE)

**Date:** 2026-07-22  
**Scope:** Protocol API Server + Event Store + Adapters + SDK  
**Version:** 1.0

## Assets

1. Event Store (append-only financial truth)
2. Build / Boot attestation chain
3. Capabilities & Scopes
4. JWT sessions
5. Boundary adapters (external settlement)
6. Projections (read models)

## STRIDE Analysis

| Component | Spoofing | Tampering | Repudiation | Info Disclosure | DoS | Elevation of Privilege |
|-----------|----------|-----------|-------------|-----------------|-----|------------------------|
| **REST API** | JWT forgery | Payload mutation | No signed audit | Full event dump | Rate limit bypass | Capability bypass |
| **Event Store** | - | Direct file edit | Missing causation | Full history leak | Append flood | - |
| **Command Bus** | Fake identity | INV-002 bypass | Silent failure | - | Pipeline stall | INV-004 agent bypass |
| **Kafka/Redis** | - | Topic poisoning | - | Topic sniffing | Consumer lag | - |
| **Adapters** | Fake rail confirm | Settlement forgery | No receipt | - | Adapter hang | Direct state mutation |
| **SDK** | - | Local tampering | - | Build hash leak | - | - |

## Key Mitigations (Implemented or Recommended)

### Implemented (as of 2026-07-22)
- **INV-001**: `Object.freeze` + immutable violation throws
- **INV-002**: Double-entry guard in command bus
- **INV-003 / INV-004**: Capability + actor type checks
- Real HMAC JWT (not base64)
- Health + build_hash provenance gate
- `ADAPTERS_MAY_NOT_MUTATE_CONSTITUTIONAL_STATE`
- Append-only Event Store with atomic writes

### Recommended (High Priority)
1. **Merkle root / Event Store hash** exposed in `/health` and `/api/v1/manifest`
2. Enable `strictCausation: true` in production EventStore
3. Signed JWT with short TTL + refresh in production
4. Rate limiting + per-actor quotas on the API
5. mTLS or strong network policies between services
6. Regular external audit of the 21-field envelope

## Trust Boundaries

- **External → API**: JWT + capability + scope required
- **API → Adapters**: One-way event emission only
- **Event Store**: Append-only from Command Bus only
- **Projections**: Derived, never authoritative

## Attack Scenarios & Defenses

**Scenario**: Malicious external_system tries to bypass double-entry
→ Defense: INV-002 guard + constitutional gate rejects command

**Scenario**: Compromised adapter tries to write directly to ledger
→ Defense: Architectural prohibition + no write paths exposed

**Scenario**: Attacker replays old JWT
→ Defense: Short TTL + server-side session validation (future)

---

**Next Step Recommendation**: Run a formal tabletop with this model + add specific data flow diagrams.