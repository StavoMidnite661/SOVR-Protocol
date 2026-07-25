# GDPR Evidence — Data Classification

**Framework:** GDPR (EU) 2016/679  
**SOVR Version:** 0.9.0  
**Evidence Date:** 2026-07-24

---

## 1. Data Categories

SOVR processes the following categories of personal data:

| Category | Examples | Legal Basis | Retention |
|---|---|---|---|
| Identity data | actor_id, identity_id, actor_type, trust_level | Legitimate interest (system operation) | Permanent (pseudonymized on request) |
| Session data | session_id, JWT payload, IP address | Legitimate interest (authentication) | Session duration + 90 days |
| Credential data | DID documents, Verifiable Credentials | Legitimate interest (identity verification) | Permanent (pseudonymized on request) |
| Event metadata | correlation_id, causation_id, command_id | Legitimate interest (audit trail) | Permanent |
| Financial data | asset IDs, transfer amounts, account references | Contract performance | Permanent (INV-001 immutability) |
| Capability grants | capability_id, scope_pattern, granted_by | Legitimate interest (authorization) | Until revoked or pseudonymization requested |

---

## 2. Data Classification Matrix

| Data Type | Sensitivity | Classification | Handling Requirements |
|---|---|---|---|
| JWT private key | Critical | Confidential | Environment variable only, never logged, never committed |
| JWT public key | Low | Public | Safe to distribute |
| Actor identity (actor_id) | High | Personal | Pseudonymize on erasure request |
| Event payload (financial) | High | Sensitive | Immutable, encrypted at rest (PostgreSQL) |
| Event envelope (metadata) | Medium | Internal | Immutable, retained permanently |
| Capability scope | Medium | Internal | In-memory or PostgreSQL, access-controlled |
| Boot attestation | Low | Public | Safe to distribute |
| Build hash | Low | Public | Safe to distribute |

---

## 3. Data Storage Locations

| Data | Storage | Encryption at Rest | Access Control |
|---|---|---|---|
| Events | PostgreSQL (`sovr_events`) | TLS in transit, disk-level encryption recommended | `sovr` user (INSERT+SELECT) |
| State registry | PostgreSQL (`sovr_aggregate_states`) | TLS in transit | `sovr` user (INSERT+SELECT) |
| DID documents | PostgreSQL (`sovr_did_documents`) | TLS in transit | `sovr` user (INSERT+SELECT) |
| Credentials | PostgreSQL (`sovr_credentials`) | TLS in transit | `sovr` user (INSERT+SELECT) |
| JWT keys | Environment variables | N/A (in memory) | OS-level process isolation |
| Event log (JSON fallback) | `generated/data/sovr-events.json` | None (development only) | Filesystem permissions |

---

## 4. Data Subject Rights

| Right | SOVR Mechanism | Implementation Status |
|---|---|---|
| Right to access (Art. 15) | Event log query by correlation_id or actor_id | ✅ Implemented |
| Right to rectification (Art. 16) | Governance proposal + amendment process | ⚠️ Specified, not automated |
| Right to erasure (Art. 17) | Pseudonymization (not deletion) | ✅ Implemented (see right-to-erasure.md) |
| Right to restrict processing (Art. 18) | Capability revocation + session invalidation | ⚠️ Partial |
| Right to data portability (Art. 20) | Event export by correlation_id | ⚠️ Partial |
| Right to object (Art. 21) | Governance proposal process | ⚠️ Specified, not automated |

---

## 5. Data Protection Officer

SOVR does not designate a DPO in the reference implementation. In production deployment, the operating institution must designate a DPO per Art. 37.

---

## 6. Records of Processing

| Processing Activity | Purpose | Data Categories | Retention | Legal Basis |
|---|---|---|---|---|
| Event logging | Audit trail, INV-001 | Event metadata, financial data | Permanent | Legitimate interest + regulatory |
| Identity management | Authentication, authorization | Identity data, session data | Pseudonymized on request | Contract performance |
| Capability management | Authorization | Capability grants | Until revoked | Legitimate interest |
| Projection rebuilding | Read models | Financial data | Derived from events | Legitimate interest |
| Boot attestation | Integrity verification | Build metadata | Permanent | Legitimate interest |
