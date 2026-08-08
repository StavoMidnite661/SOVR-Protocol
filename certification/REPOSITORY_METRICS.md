# SOVR Protocol — Repository Metrics

**Generated:** 2026-07-25T03:11:13-07:00  
**Build Hash:** `6e97ae164fa847ca4f54d99250a505752d033e9a73c2650c70a1d11c5f1f1015`  
**Protocol Version:** v1.0.0 (FROZEN)  

---

## Code Metrics

| Metric | Value | Source |
|---|---|---|
| Total Repository Files | 6,774 | File system |
| Project Source Files | 306 | Excludes node_modules, dist |
| TypeScript Source Files | 103 | `packages/`, `generated/src/` |
| TypeScript Lines of Code | ~13,733 | Calculated from source |
| YAML Constitutional Files | 136 | Root + `domains/` |
| Markdown Documentation | 368 | `docs/`, `README.md` |
| TLA+ Formal Models | 43 | `generated/verification/tla/` |
| SQL Migrations | 3 | `migrations/`, `packages/runtime/migrations/` |
| Shell Scripts | 7 | `scripts/` |
| PowerShell Scripts | 19 | `scripts/`, root |

---

## Specification Metrics

| Metric | Value | Verified |
|---|---|---|
| Protocol Specification | v1.0.0 FROZEN | ✅ |
| YAML files parsing | 244/244 (100%) | ✅ |
| Protocol YAML inputs | 39 | ✅ |
| Domains | 10 | ✅ |
| Entities | 48 | ✅ |
| Commands | 105 | ✅ |
| Events | 259 | ✅ |
| State Machines | 43 | ✅ |
| Capabilities | 111 | ✅ |
| Projections | 16 | ✅ |

---

## Compiler Metrics

| Metric | Value | Verified |
|---|---|---|
| Compiler Version | v0.6.0 | ✅ |
| Compilation Passes | 20 | ✅ |
| Code Generators | 9 | ✅ |
| IR Nodes | 592 | ✅ |
| IR Edges | 459 | ✅ |
| Generated Artifacts | 104 | ✅ |
| Registry JSON Files | 11 | ✅ |
| TLA+ Models Generated | 43 | ✅ |
| Build Hash | `6e97ae164fa847ca4f54d99250a505752d033e9a73c2650c70a1d11c5f1f1015` | ✅ |
| Byte-identical Reproducibility | Verified | ✅ |

---

## Runtime Metrics

| Metric | Value | Verified |
|---|---|---|
| Runtime Version | v0.6.0 | ✅ |
| OpenAPI Paths | 44 | ✅ |
| Boot Runlevels | 8/8 HEALTHY | ✅ |
| Boot Self-Test | 7/7 PASS | ✅ |
| Integration Tests | 16/16 PASS | ✅ |
| Purity Violations | 0 | ✅ |
| Manual Runtime Bridges | 0 | ✅ |
| Generated Behavior | 100% | ✅ |

---

## Security Metrics

| Metric | Value | Verified |
|---|---|---|
| Pre-Audit Self-Test | 14/14 PASS | ✅ |
| Open Findings | 0 | ✅ |
| SOVR-SEC-001 | REMEDIATED | ✅ |
| JWT Algorithm | RS256 (asymmetric) | ✅ |
| Rate Limiting | Identity-sovereign | ✅ |
| PostgreSQL Immutable Triggers | Active | ✅ |

---

## Certification Metrics

| Metric | Value |
|---|---|
| Certification Artifacts | 45 |
| Audit Documents | 4 (`docs/audit/`) |
| Deployment Documents | 5 (`docs/deployment/`) |
| Compliance Documents | 8 (`docs/compliance/`) |
| Security Documents | 3 (`docs/security/`) |
| Operations Documents | 2 (`docs/operations/`) |
| Architecture Documents | 8 (`docs/architecture/`) |
| Formal Verification | 3 (`docs/formal-verification/`) |
| Reports | 7 (`docs/reports/`) |
| Roadmaps | 2 (`docs/roadmaps/`) |

---

## Dependency Metrics

| Metric | Value |
|---|---|
| Compiler Dependencies | 15 |
| Runtime Dependencies | 12 |
| Runtime Dev Dependencies | 8 |
| Shared Dependencies | 3 |
| Total npm Packages | ~38 |

---

## Test Metrics

| Metric | Value | Verified |
|---|---|---|
| Integration Tests | 16 | ✅ 16/16 PASS |
| Unit Tests | 0 | 📋 Planned |
| Acceptance Tests | 60 declared | 📋 0/60 implemented |
| Demo Script | 13/13 | ✅ PASS |
| TLA+ Models | 43 | ✅ Generated |

---

## Documentation Metrics

| Metric | Value |
|---|---|
| Total Documentation Files | 368 |
| README | 1 |
| Architecture Docs | 8 |
| Compliance Docs | 8 |
| Deployment Docs | 5 |
| Security Docs | 3 |
| Operations Docs | 2 |
| Formal Verification Docs | 3 |
| Reports | 7 |
| Roadmaps | 2 |
| Guide Docs | 5 |
| Observability Docs | 1 |
| Performance Docs | 1 |

---

*All metrics measured from ground truth. No estimates.*
