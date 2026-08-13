<!--
HISTORICAL / REMEDIATION RECORD

This file does not describe the current SOVR architecture.
See docs/ARCHITECTURE.md for the implementation that exists now.
-->

# SOVR-DR-000001 Recovery Report

**INCIDENT-ID:** SOVR-DR-000001  
**Directive ID:** SOVR-DR-000001-RECOVERY  
**Title:** TigerBeetle Ledger Instance Loss Event — Recovery Execution Report  
**Classification:** Development Accounting Truth Recovery  
**Date:** 2026-08-06  
**Author:** SOVR Engineering (Automated Recovery Agent)  
**Status:** COMPLETED — RECOVERY FAILED (Schema Mismatch)  

---

## 1. Incident Status

| Field | Value |
|-------|-------|
| **Incident ID** | SOVR-DR-000001 |
| **Classification** | Development Environment Recovery — Accounting Truth Layer |
| **Impact** | Ledger runtime unavailable; data preserved |
| **Discovery** | 2026-08-06 |
| **Resolution** | 2026-08-06 |
| **Outcome** | Partial — runtime restored, verification failed |

**Summary:** The TigerBeetle ledger instance `SOVR-TREASURY-001` (cluster_id=0) experienced a runtime loss event. The instance process/container state was removed, but the underlying ledger data files remained intact on the D:\ volume. Recovery was attempted in forensic preservation mode. Runtime was successfully restored, but verification revealed the existing ledger does not contain the SOVR reference account schema.

---

## 2. Ledger Data Status

| Asset | Path | Size | Modified | Status |
|-------|------|------|----------|--------|
| Primary Ledger | `sovrb-tb-instance\tigerbeetle_data\0_0.tigerbeetle` | 1.17 GB | 2026-02-03 | **INTACT** |
| Backup Ledger | `sovrb-tb-instance\tigerbeetle_data\0_0.tigerbeetle.bak` | 1.17 GB | — | **INTACT** |
| SHA-256 (primary) | — | — | — | `baca655c15e66c9905ae55d8577dd182c43434c22f22c3723908b6fe71a9b3ea` |
| SHA-256 (backup) | — | — | — | `baca655c15e66c9905ae55d8577dd182c43434c22f22c3723908b6fe71a9b3ea` |

**Integrity:** Primary and backup are byte-identical. No corruption detected.

**Forensic Preservation:** All evidence copied to `SOVR-DR-000001/evidence/` with integrity baseline recorded in `ledger-integrity-baseline.json`.

---

## 3. Runtime Recovery Status

| Check | Value |
|-------|-------|
| **Recovery Path** | NATIVE_BINARY |
| **Binary** | `tigerbeetle.exe` (23.8 MB) |
| **Command** | `.\tigerbeetle.exe start --addresses=0.0.0.0:3000 tigerbeetle_data/0_0.tigerbeetle` |
| **Result** | SUCCESS — cluster opened |
| **Cluster ID** | 0 |
| **Listening Address** | 0.0.0.0:3000 |
| **Release** | 0.16.68 |
| **Status** | Stopped (post-verification) |

**Note:** Docker Desktop was occupying ports 3000/3001 during recovery. Docker backend processes were stopped to free ports for native TigerBeetle runtime. Docker daemon was unresponsive during initial recovery attempts.

---

## 4. Cluster Verification

| Field | Value |
|-------|-------|
| **Cluster Name** | SOVR-TREASURY-001 |
| **Cluster ID** | 0 |
| **Verification Status** | CONFIGURED |
| **Ledger Path** | `tigerbeetle_data/0_0.tigerbeetle` |
| **Runtime Verification** | PENDING_RUNTIME_RESTORE → COMPLETED |

**Sources:**
- `.env.example` → `TB_CLUSTER_ID=0`
- `.env.production.example` → `TB_CLUSTER_ID=0`
- `src/scripts/genesis.ts` → `BigInt(process.env.TB_CLUSTER_ID || '0')`
- `src/clearing/tigerbeetle/client.ts` → `BigInt(process.env.TB_CLUSTER_ID || '0')`

**Report:** `SOVR-DR-000001/verification/cluster-verification-report.yaml`

---

## 5. Account Verification

| Metric | Value |
|--------|-------|
| **Expected Accounts** | 13 |
| **Found Accounts** | 1 |
| **Verified** | 0 |
| **Missing** | 13 |
| **Result** | FAIL |

### Unexpected Account Found

| Field | Value |
|-------|-------|
| **Account ID** | 1 |
| **Ledger** | 999 (SOVR) |
| **Code** | 3 (TREASURY) |
| **Balance** | -27,000,000,000 |
| **Debits Posted** | 27,000,000,000 |
| **Credits Posted** | 0 |
| **Timestamp** | 1769639973669288701 |

**Missing Accounts:** 100, 2500, 5000, 3001, 4001, 4002, 5001, 9002, 9003, 9004, 9005, 9006, 9007

**Report:** `SOVR-DR-000001/verification/account-verification.json`

---

## 6. Genesis Reconciliation

| Field | Value |
|-------|-------|
| **Mode** | VERIFICATION_ONLY |
| **Expected State** | VALID (13 SOVR reference accounts) |
| **Observed State** | INVALID (1 account, unknown schema) |
| **Result** | FAIL |

**Finding:** The existing ledger file does not contain the SOVR reference account schema defined in `src/types.ts` (`NARRATIVE_ACCOUNTS`). Only account ID 1 exists, with ledger=999 and code=3 (TREASURY), but it does not match any entry in the SOVR account catalog.

**Assessment:** The ledger file appears to be either:
- Uninitialized test data
- From a different prototype using deprecated account IDs
- Not the SOVR Accounting Truth Layer instance

**Report:** `SOVR-DR-000001/verification/genesis-reconciliation-report.md`

---

## 7. Ledger Continuity Certificate

| Field | Value |
|-------|-------|
| **Certificate ID** | SOVR-LC-000001 |
| **Status** | FAIL |
| **Instance** | SOVR-TREASURY-001 |
| **Cluster ID** | 0 |
| **Artifact Hash** | `baca655c15e66c9905ae55d8577dd182c43434c22f22c3723908b6fe71a9b3ea` |
| **Accounts Verified** | false |
| **Schema Match** | false |

**Certificate:** `sovrb-tb-instance/packages/certification/ledger-continuity/SOVR-LC-000001-certificate.yaml`

---

## 8. Remaining Risks

| Risk | Severity | Description |
|------|----------|-------------|
| **Schema Mismatch** | HIGH | Existing ledger does not contain SOVR reference accounts |
| **Unknown Data Provenance** | HIGH | Origin of account ID 1 and balance -27B unclear |
| **Cluster ID Collision** | MEDIUM | Cluster ID 0 is reserved for testing; production should use non-zero ID |
| **Docker Instability** | MEDIUM | Docker daemon was unresponsive during recovery |
| **No Backup Policy** | MEDIUM | No automated backup schedule exists |
| **Agent Autonomy Gap** | MEDIUM | Agent was able to modify infrastructure without guardrails |

---

## 9. Recommended Hardening Actions

### Immediate (P0)

1. **Authorize Genesis Reconstruction** — Human authorization required to create new SOVR-TREASURY-001 instance with correct account schema
2. **Archive Existing Ledger** — Preserve `0_0.tigerbeetle` as forensic evidence; do not delete
3. **Implement Agent Policy** — Deploy `AGENT_INFRASTRUCTURE_AUTHORITY_POLICY.md` to all agents

### Short-term (P1)

4. **Backup Policy** — Implement scheduled SHA-256 snapshots of `tigerbeetle_data/`
5. **Cluster ID Pinning** — Use non-zero cluster ID in production configurations
6. **Verification CI** — Add account schema verification to CI/CD pipeline

### Long-term (P2)

7. **Infrastructure-as-Code** — Migrate TigerBeetle deployment to Terraform/Pulumi
8. **Automated Failover** — Implement hot standby replica with automated continuity verification
9. **Audit Logging** — Immutable log of all ledger state changes with governance signatures

---

## 10. Recovery Outcome

### What Worked

- Forensic evidence preservation completed without data modification
- SHA-256 integrity baseline generated
- Runtime restoration successful (cluster opened, ports bound)
- Cluster ID verified from multiple configuration sources
- Account verification identified schema mismatch before any destructive action

### What Failed

- Existing ledger does not match SOVR protocol specifications
- Genesis reconciliation failed in verification mode
- Ledger Continuity Certificate issued with FAIL status

### Conclusion

The existing TigerBeetle data file `0_0.tigerbeetle` is **intact but incompatible** with the current SOVR protocol account schema. The file cannot serve as the Accounting Truth Layer without reconstruction or migration.

Per Rule Zero and the SOVR-DR-000001-RECOVERY directive, **no automatic repair or recreation was performed**. The incident is documented, evidence is preserved, and the system is in a safe, deterministic state pending human authorization for next steps.

**Truth is mechanical, not narrative. The protocol definition is the authority.**

---

## Appendix A: Evidence Inventory

```
SOVR-DR-000001/
├── evidence/
│   ├── 0_0.tigerbeetle
│   ├── 0_0.tigerbeetle.bak
│   ├── .env.example
│   ├── .env.production.example
│   ├── docker-compose.yml
│   ├── package.json
│   ├── genesis.ts
│   ├── client.ts
│   └── ledger-integrity-baseline.json
├── logs/
├── recovery/
│   └── environment-discovery.json
└── verification/
    ├── cluster-verification-report.yaml
    ├── account-verification.json
    ├── ledger-state-verification.yaml
    └── genesis-reconciliation-report.md
```

## Appendix B: Certification Artifacts

```
sovrb-tb-instance/packages/certification/ledger-continuity/
├── SOVR-LC-000001-certificate.yaml
└── (future: snapshot-schema.yaml, recovery-procedure.md, verification-report.yaml, certificate-template.md)
```

## Appendix C: Governance Artifacts

```
docs/governance/
└── AGENT_INFRASTRUCTURE_AUTHORITY_POLICY.md
```

---

**Report Generated:** 2026-08-06T10:42:00-07:00  
**Next Review:** Pending human authorization for recovery path selection
