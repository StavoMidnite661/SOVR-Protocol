# SOVR Protocol — Technical Debt Register

**Generated:** 2026-07-25T03:11:13-07:00  
**Build Hash:** `6e97ae164fa847ca4f54d99250a505752d033e9a73c2650c70a1d11c5f1f1015`  
**Protocol Version:** v1.0.0 (FROZEN)  

---

## Purpose

This document catalogs all known technical debt in the SOVR Protocol reference implementation. Each item is ranked by severity and estimated effort.

**Methodology:**
- Code review
- Certification artifact analysis
- Roadmap review
- Static analysis

---

## Technical Debt Items

### Critical

| ID | Description | Impact | Effort | Risk | Status |
|---|---|---|---|---|---|
| TD-001 | Generated TypeScript artifacts not wired into runtime | High | 3 months | High | 📋 Planned v1.0.0 |
| TD-002 | Full 7-stage command execution pipeline not implemented | High | 2 months | High | 📋 Planned v1.0.0 |
| TD-003 | State machine coverage incomplete (8 commands exempt) | High | 1 month | Medium | 📋 Planned v1.0.0 |
| TD-004 | Pass runner bodies delegate to v0.2 stages | Medium | 2 months | High | 📋 Planned v1.0.0 |

---

### High

| ID | Description | Impact | Effort | Risk | Status |
|---|---|---|---|---|---|
| TD-005 | Capability grants not persistent (in-memory only) | High | 2 weeks | High | 🔧 In Progress |
| TD-006 | Identity not backed by persistent registry | Medium | 1 month | Medium | 📋 Planned v1.0.0 |
| TD-007 | Key management not implemented | High | 1 month | High | 📋 Planned v1.0.0 |
| TD-008 | Audit certification not enforced at runtime | Medium | 2 weeks | Medium | 📋 Planned v1.0.0 |
| TD-009 | Multi-party authorization not implemented | Medium | 1 month | Medium | 📋 Planned v1.0.0 |
| TD-010 | Saga payload mapping incomplete | Medium | 3 weeks | Medium | 📋 Planned v1.0.0 |

---

### Medium

| ID | Description | Impact | Effort | Risk | Status |
|---|---|---|---|---|---|
| TD-011 | Event schema validation not enforced at persistence layer | Medium | 1 week | Low | 📋 Planned |
| TD-012 | Projection caching not implemented | Medium | 1 week | Low | 📋 Planned |
| TD-013 | Rate limiting uses in-memory buckets | Low | 2 weeks | Medium | 📋 Planned v1.0.0 |
| TD-014 | No secrets manager integration | High | 2 weeks | High | 📋 Planned v1.0.0 |
| TD-015 | No TLS enforcement in reference implementation | Medium | 1 week | Medium | 📋 Production requirement |
| TD-016 | Container runs as root | Medium | 1 day | Low | 📋 Production requirement |

---

### Low

| ID | Description | Impact | Effort | Risk | Status |
|---|---|---|---|---|---|
| TD-017 | Duplicate event envelope definitions | Low | 2 days | Low | 📋 Planned |
| TD-018 | Duplicate error class definitions | Low | 2 days | Low | 📋 Planned |
| TD-019 | Unused experimental config files (.babelrc, .jshintrc) | Low | 1 hour | None | 📋 Cleanup |
| TD-020 | _test_output files in version control | Low | 1 hour | None | 📋 Cleanup |
| TD-021 | Generated TypeScript output not in .gitignore | Low | 1 hour | None | 📋 Cleanup |

---

### Future

| ID | Description | Impact | Effort | Risk | Status |
|---|---|---|---|---|---|
| TD-022 | Multi-node distributed execution | High | 6 months | High | 📋 v1.1.0 |
| TD-023 | Rust runtime implementation | High | 12 months | Medium | 📋 Future |
| TD-024 | WASM runtime implementation | Medium | 6 months | Medium | 📋 Future |
| TD-025 | Standards-complete DID/VC identity | Medium | 3 months | Medium | 📋 v1.0.0 |
| TD-026 | Production rail wiring (TLS, mutual auth, secrets manager) for all 12 rails + TigerBeetle | High | 6 months | High | 📋 v1.0.0+ |

---

## Won't Fix

| ID | Description | Reason |
|---|---|---|
| — | JSON event store for production | PostgreSQL is the production standard |

---

## Summary

| Category | Count | Total Effort |
|---|---|---|
| Critical | 4 | 6.5 months |
| High | 6 | 5.5 months |
| Medium | 6 | 2 months |
| Low | 5 | 1 day |
| Future | 4 | 27 months |
| Won't Fix | 1 | — |

**Total Critical + High Effort:** ~12 months  
**Total Medium Effort:** ~2 months  

---

## Recommendations

1. **Immediate (v0.6.0):** Fix TD-015 (TLS), TD-016 (root user), TD-019 (cleanup), TD-020 (cleanup), TD-021 (cleanup)
2. **Short-term (v1.0.0):** Address TD-001 through TD-014
3. **Medium-term (v1.1.0):** Address TD-022 through TD-026
4. **Long-term:** Monitor TD-023, TD-024 for feasibility

---

*Technical debt register generated from code review and certification artifacts. All estimates are approximate. Actual effort may vary.*
