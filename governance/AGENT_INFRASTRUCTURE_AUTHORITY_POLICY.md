# SOVR Agent Infrastructure Authority Policy

**Document ID:** SOVR-GOV-INFRA-001
**Version:** 1.0
**Date:** 2026-08-06
**Authority:** SOVR Protocol Engineering Governance
**Classification:** RESTRICTED — Agent Operations

---

## 1. Purpose

This policy defines the authority boundaries for SOVR engineering agents when interacting with financial infrastructure components. The TigerBeetle ledger is classified as the **Accounting Truth Layer** and requires the highest level of protection.

---

## 2. Classification

### 2.1 Accounting Truth Layer

Components classified as Accounting Truth Layer require absolute preservation:

- TigerBeetle ledger data files (`*.tigerbeetle`, `*.tigerbeetle.bak`)
- Cluster identity (cluster_id)
- Account schema definitions
- Transfer history
- Genesis state

### 2.2 Narrative Mirror

Components classified as Narrative Mirror may be rebuilt from source:

- PostgreSQL narrative mirror
- Observed event logs
- Attestation records

---

## 3. Allowed Operations

Agents are permitted to perform the following on Accounting Truth Layer components:

| Operation | Description | Authorization |
|-----------|-------------|---------------|
| **READ** | Inspect files, configs, and state | Implicit |
| **INSPECT** | Query runtime status, ports, processes | Implicit |
| **TEST** | Run verification scripts in read-only mode | Implicit |
| **COMPILE** | Build adapters, drivers, and tooling | Implicit |
| **DOCUMENT** | Generate reports, certificates, and runbooks | Implicit |
| **VERIFY** | Compare ledger state against protocol specifications | Implicit |
| **HASH** | Generate cryptographic hashes for evidence | Implicit |

---

## 4. Restricted Operations

The following operations require **explicit human authorization**:

| Operation | Description | Authorization |
|-----------|-------------|---------------|
| **MIGRATE** | Database schema changes | Explicit human |
| **MODIFY** | Ledger state modifications | Explicit human |
| **REPLACE** | Runtime replacement | Explicit human |
| **DEPLOY** | Infrastructure changes | Explicit human |
| **RECREATE** | Cluster or instance recreation | Explicit human |

---

## 5. Forbidden Operations

The following operations are **absolutely forbidden** under all circumstances:

| Operation | Description | Consequence |
|-----------|-------------|-------------|
| **DELETE** | Delete ledger data files | Incident escalation |
| **FORMAT** | Format or wipe TigerBeetle | Incident escalation |
| **RESET** | Reset cluster identity | Incident escalation |
| **OVERWRITE** | Overwrite evidence files | Incident escalation |
| **INIT** | Blind initialization/recreation | Incident escalation |
| **DESTROY** | Destructive Docker cleanup | Incident escalation |

---

## 6. Recovery Protocol

When an Accounting Truth Layer incident occurs:

### 6.1 Immediate Actions

1. **STOP** — Halt all agent actions on infrastructure
2. **PRESERVE** — Copy all data files to forensic evidence directory
3. **HASH** — Generate SHA-256 hashes of all artifacts
4. **DOCUMENT** — Create incident record before any other action

### 6.2 Assessment Phase

1. Determine scenario: A (process deleted), B (data deleted), C (cluster mismatch)
2. Verify data integrity against hashes
3. Verify cluster ID matches configuration
4. Do NOT modify any state during assessment

### 6.3 Recovery Phase

1. Attempt runtime restoration using existing data
2. Verify account schema against protocol specifications
3. If schema mismatch: STOP and report
4. If schema match: proceed to continuity certification

### 6.4 Certification Phase

1. Generate Ledger Continuity Certificate
2. Document verification results
3. Sign certificate with governance authority

---

## 7. Enforcement

### 7.1 Agent Constraints

All SOVR agents MUST:

- Check this policy before executing any infrastructure command
- Refuse forbidden operations and report the request
- Preserve evidence before any assessment or recovery action
- Document all actions in the incident record

### 7.2 Human Authorization

Human authorization MUST include:

- Incident ID
- Specific operation requested
- Expected impact
- Risk assessment
- Rollback plan

### 7.3 Incident Escalation

Any forbidden operation attempt MUST trigger:

1. Immediate halt of all agent actions
2. Preservation of current state
3. Incident report creation
4. Notification to SOVR Protocol Engineering Governance

---

## 8. Related Documents

- `docs/incidents/SOVR-DR-000001.md` — Incident record
- `packages/certification/ledger-continuity/` — Continuity certification framework
- `SOVR-DR-000001-RECOVERY` — Recovery directive template

---

## 9. Revision History

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-08-06 | SOVR Engineering | Initial policy created from incident SOVR-DR-000001 |
