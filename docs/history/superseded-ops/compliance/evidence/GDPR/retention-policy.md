<!--
HISTORICAL / REMEDIATION RECORD

This file does not describe the current SOVR architecture.
See docs/ARCHITECTURE.md for the implementation that exists now.
-->

# GDPR Evidence — Retention Policy

**Framework:** GDPR (EU) 2016/679  
**SOVR Version:** 0.6.0  
**Evidence Date:** 2026-07-24

---

## 1. Retention Principles

SOVR adheres to GDPR storage limitation principle (Art. 5(1)(e)):

> Personal data shall be kept in a form which permits identification of data subjects for no longer than is necessary for the purposes for which the personal data are processed.

**Exception:** SOVR's event log is immutable by design (INV-001). Financial events cannot be deleted. This is a legal obligation exception under Art. 5(1)(e) and Recital 26 (pseudonymization).

---

## 2. Retention Classes

SOVR defines 4 retention classes in the event envelope:

| Class | Duration | Trigger | Mechanism |
|---|---|---|---|
| `permanent` | Indefinite | Constitutional requirement (INV-001) | Immutable event log |
| `regulatory_7y` | 7 years | Financial regulation | PostgreSQL TTL + manual purge |
| `operational_90d` | 90 days | Operational necessity | Event log query filter |
| `session` | Session duration | Authentication session | JWT expiration (1h default) |

---

## 3. Retention by Data Type

| Data | Retention Class | Duration | Mechanism |
|---|---|---|---|
| Financial events (ledger, vault, treasury) | `permanent` | Indefinite | Immutable PostgreSQL triggers |
| Governance events | `permanent` | Indefinite | Immutable PostgreSQL triggers |
| Identity events (actor.registered, actor.verified) | `permanent` | Indefinite | Immutable PostgreSQL triggers |
| Session events | `session` | 1 hour | JWT expiration |
| Payment rail events | `regulatory_7y` | 7 years | Retention class in envelope |
| Audit trails | `permanent` | Indefinite | Immutable PostgreSQL triggers |
| Projections | Derived | Rebuilt from events | Rebuilt on startup |
| Boot attestation | `permanent` | Indefinite | Filesystem |

---

## 4. Retention Enforcement

### PostgreSQL Triggers

**File:** `packages/runtime/src/adapters/postgres-event-store.ts`  
**SQL:** `MIGRATION_SQL`

```sql
CREATE TRIGGER sovr_events_prevent_update_delete BEFORE UPDATE OR DELETE ON sovr_events
  FOR EACH ROW EXECUTE FUNCTION prevent_sovr_events_modification();
```

**Effect:** No UPDATE or DELETE permitted on `sovr_events` table. Events are append-only.

**Exception:** `regulatory_7y` events could be archived (moved to cold storage) after 7 years via governance proposal. Not automated.

---

### JWT Expiration

**File:** `packages/runtime/src/security/jwt.ts`  
**Default TTL:** 1 hour (`setExpirationTime('1h')`)  
**Configurable:** `SOVR_JWT_TTL_SECONDS` env var

**Effect:** Session tokens expire automatically. No manual revocation required.

---

## 5. Data Minimization

SOVR enforces data minimization through:

1. **Mandatory Event Envelope:** Only 21 fields per event. No arbitrary data expansion.
2. **Scope Patterns:** Capability scopes restrict data access to minimum necessary.
3. **Projection Rebuild:** Projections are derived from events, not stored independently. Rebuilt on startup.
4. **No Unnecessary Logging:** Runtime logs do not include JWT payloads, keys, or sensitive payload fields.

---

## 6. Archiving and Deletion

| Scenario | Action | Mechanism |
|---|---|---|
| Actor requests erasure | Pseudonymization (not deletion) | `identity.actor.pseudonymized` event |
| Regulatory archive (7y) | Move to cold storage | Governance proposal + manual export |
| Session expiry | Automatic deletion | JWT expiration (1h) |
| Projection rebuild | Automatic regeneration | `ProjectionEngine.rebuildFromGenesis()` |

---

## 7. Audit Trail Retention

The event log is the source of truth (INV-006). It cannot be modified or deleted. This is a deliberate design choice that conflicts with GDPR Art. 17 (right to erasure).

**Resolution:** See `right-to-erasure.md` for pseudonymization approach.

**Audit Evidence:**
- `packages/runtime/src/adapters/postgres-event-store.ts` — immutability triggers
- `generated/verification/tla/*.tla` — formal verification of state machine transitions
- Boot attestation — proves log integrity
