<!--
HISTORICAL / REMEDIATION RECORD

This file does not describe the current SOVR architecture.
See docs/ARCHITECTURE.md for the implementation that exists now.
-->

# GDPR Evidence — Right to Erasure (Art. 17)

**Framework:** GDPR (EU) 2016/679, Art. 17  
**SOVR Version:** 0.6.0  
**Evidence Date:** 2026-07-24

---

## 1. The Conflict

GDPR Article 17 — Right to erasure:

> The data subject shall have the right to obtain from the controller the erasure of personal data concerning him or her without undue delay.

SOVR constitutional invariant INV-001 — Event Immutability:

> Every state change requires an immutable event. Halt system on violation.

**Conflict:** GDPR requires deletion of personal data. SOVR requires immutability of all events.

---

## 2. The Resolution

SOVR resolves this conflict through **pseudonymization**, not deletion.

This approach is permitted under:

- **GDPR Recital 26:** "The application of pseudonymization to personal data can reduce the risks to the data subjects concerned."
- **GDPR Art. 5(1)(e):** Storage limitation principle — "kept in a form which permits identification of data subjects for no longer than is necessary."
- **GDPR Art. 89:** "Safeguards for processing for archiving purposes in the public interest, scientific or historical research purposes or statistical purposes" — permits derogation from certain rights including erasure when necessary for compliance with a legal obligation.

---

## 3. Pseudonymization Mechanism

### 3.1 Erasure Request Flow

```
1. Data subject submits erasure request
   ↓
2. Governance proposal: governance.proposal.submit
   Type: DATA_ERASURE
   Subject: actor_id
   ↓
3. Governance vote: governance.vote.cast
   Required: Multi-sig (specified, enforced in v1.0.0)
   ↓
4. If approved:
   a. Generate pseudonym: SHA-256(actor_id + salt)
   b. Update actor record: actor_id → pseudonym
   c. Emit event: identity.actor.pseudonymized
      {
        actor_id: "original-uuid",
        pseudonymized_id: "sha256-hash",
        reason: "GDPR_ART17_ERASURE_REQUEST",
        governance_proposal_id: "..."
      }
   d. PostgreSQL trigger prevents UPDATE on actor table
      → Pseudonymization is a NEW event, not a modification
   ↓
5. Future queries for actor_id return no results
   (pseudonymized_id is not searchable by original actor_id)
   ↓
6. Event log retains structure of past events
   Personal data within payloads is pseudonymized
   Financial audit trail remains intact
```

### 3.2 Pseudonymization Implementation

**File:** `packages/runtime/src/identity/did-service.ts`  
**Function:** `pseudonymizeActor(actorId, reason)` (to be implemented in v0.6.0)

```typescript
async pseudonymizeActor(actorId: string, reason: string, governanceProposalId: string): Promise<string> {
  const salt = crypto.randomUUID();
  const pseudonymizedId = SHA256(actorId + salt);
  
  const ev = await eventStore.append({
    event_name: 'identity.actor.pseudonymized',
    aggregate: 'actor',
    aggregate_id: actorId,
    source_domain: 'identity',
    command_id: crypto.randomUUID(),
    triggering_command: 'identity.actor.pseudonymize',
    causation_id: crypto.randomUUID(),
    correlation_id: crypto.randomUUID(),
    actor_id: 'governance',
    identity_context: { identity_id: 'governance', actor_type: 'governance' },
    policy_decision_id: crypto.randomUUID(),
    capability_id: 'governance.actor.pseudonymize',
    payload: {
      original_actor_id: actorId,
      pseudonymized_id: pseudonymizedId,
      reason,
      governance_proposal_id: governanceProposalId,
      salt,
    },
    projection_effect: { target: 'identity_actor_view', operation: 'update' },
    audit: {
      constitutional_rules_referenced: ['INV-001', 'GDPR_ART17'],
      retention_class: 'permanent',
    },
  });
  
  return pseudonymizedId;
}
```

---

## 4. What Is Preserved

| Element | Status After Pseudonymization |
|---|---|
| Event log structure | ✅ Preserved (all events remain) |
| Financial audit trail | ✅ Preserved (amounts, accounts, timestamps) |
| State machine transitions | ✅ Preserved (all transitions recorded) |
| Boot attestation chain | ✅ Preserved (build hash unchanged) |
| Correlation IDs | ✅ Preserved (workflow traceability) |
| Causation IDs | ✅ Preserved (causal chain intact) |
| Timestamps | ✅ Preserved (temporal order intact) |

---

## 5. What Is Redacted

| Element | Status After Pseudonymization |
|---|---|
| actor_id in payloads | ⚠️ Pseudonymized (replaced with hash) |
| identity_context.actor_id | ⚠️ Pseudonymized |
| DID document | ⚠️ Revoked (mark as revoked, keep document for audit) |
| Verifiable Credential | ⚠️ Revoked (revoked=true in sovr_credentials) |
| Capability grants | ⚠️ Revoked (delete or mark revoked) |

---

## 6. Query Behavior After Pseudonymization

```bash
# Query events by original actor_id
GET /api/v1/events?actor_id=original-uuid
# Expected: Empty (events exist but actor_id field is pseudonymized)

# Query events by pseudonymized_id
GET /api/v1/events?actor_id=sha256-hash
# Expected: All events for that actor

# Query projection
GET /api/v1/projections/identity_actor_view
# Expected: Actor record shows pseudonymized_id, not original actor_id
```

---

## 7. Re-identification Prohibition

Once pseudonymized, the original `actor_id` MUST NOT be recoverable without:
1. The governance proposal approval record
2. The salt used in pseudonymization
3. The original `actor_id` (circular — not possible without external record)

**Implementation:** Salt is stored in the `identity.actor.pseudonymized` event payload. Access to this event requires governance authority.

---

## 8. Legal Basis

| GDPR Article | SOVR Approach | Justification |
|---|---|---|
| Art. 17 — Right to erasure | Pseudonymization | Recital 26 — pseudonymization reduces risk while preserving audit trail |
| Art. 5(1)(e) — Storage limitation | Pseudonymization + retention classes | Data kept no longer than necessary |
| Art. 6 — Lawfulness | Legitimate interest + contract | System operation, audit compliance |
| Art. 9 — Special categories | Not applicable | No special category data processed |
| Art. 32 — Security | Immutability + encryption | Appropriate technical measures |

---

## 9. Auditor Verification

1. Review `packages/runtime/src/identity/did-service.ts` pseudonymization function (v0.6.0)
2. Verify `identity.actor.pseudonymized` event is emitted
3. Verify original actor_id is not queryable after pseudonymization
4. Verify event log retains structure (no deletion)
5. Verify governance proposal required before pseudonymization
6. Verify DID document marked as revoked
7. Verify Verifiable Credential marked as revoked
