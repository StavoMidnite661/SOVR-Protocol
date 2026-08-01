# SOVR Protocol — Executive Summary

**Protocol Version:** v1.0.0 (FROZEN)  
**Compiler / Runtime Version:** v0.6.0  
**Generated:** 2026-07-25T03:11:13-07:00  
**Build Hash:** `bb8e457696bee43c5a7eaccfb501d18de7c65d66bf7772e732d92c3569e7d4df`  

---

## Overview

SOVR is a **spec-first, compiled financial protocol** with a reference compiler and runtime. It is the **specification and execution kernel** for programmable finance — the layer from which compliant financial systems are deterministically built, audited, and reproduced.

**Analogy:** SOVR is to finance what the Linux kernel is to operating systems.

---

## Key Metrics

> **All figures below are measured from the repository at the stated build
> hash.** Earlier revisions of this document reported unverified counts; those
> were corrected following the independent audit of 2026-07-27
> (`DUE_DILIGENCE/INDEPENDENT_AUDIT_2026-07-27.md`).

| Metric | Value | How measured |
|---|---|---|
| Protocol Version | v1.0.0 (FROZEN) | `00_protocol-manifest.yaml` |
| Compiler Version | v0.6.0 | `packages/compiler/src/index.ts` |
| Runtime Version | v0.6.0 | compiled manifest |
| Protocol YAML inputs (compiled) | 39 | `compiler-manifest.input_hashes` |
| YAML files in repository | 256 | `find -name '*.yaml' -o -name '*.yml'` |
| TypeScript source files | 161 | excludes `.d.ts`, `dist/`, `node_modules/` |
| Total repository files | 642 | excludes `.git/`, `node_modules/`, `dist/` |
| Lines of TypeScript | 25,362 | `cat *.ts \| wc -l` |
| Domains | 10 | `domains/*.yaml` |
| Commands | 105 | `commands.registry.json` |
| Events | 259 | `events.registry.json` |
| State Machines | 43 | `machines.registry.json` |
| Capabilities | 111 | `capabilities.registry.json` |
| Generated artifacts | 147 | compiler output |
| TLA+ models | 43 (generated, **not** model-checked) | `generated/verification/tla` |
| Unit tests | 29/29 PASS | `vitest run` |
| Acceptance suites | 3/3 PASS | `vitest run src/__tests__/acceptance` |
| Integration tests | 51/55 PASS | 4 fail on unimplemented gate config (TD-002) |
| Open findings | **26** | `certification/TECHNICAL_DEBT.md` |
| Build Hash | `bb8e457696bee43c5a7eaccfb501d18de7c65d66bf7772e732d92c3569e7d4df` |

---

## Technology

- **Compiler:** Deterministic, content-addressed build system (TypeScript)
- **Runtime:** Fastify v5 HTTP server with constitutional enforcement
- **Event Store:** PostgreSQL (production), JSON (CI/dev)
- **Authentication:** RS256 asymmetric JWT (jose v6.2)
- **Authorization:** Capability-based access control
- **Formal Verification:** 43 TLA+ models generated with TLC configs. Models
  are syntactically valid and carry falsifiable invariants, but **TLC has not
  been run in CI** — treat as "specified", not "verified".
- **Boot Sequence:** 8-runlevel attestation chain (SHA-256)

---

## Market Position

**Target Market:**
- Financial institutions (banks, custodians, exchanges)
- Payment processors
- Treasury management systems
- Regulatory technology (RegTech)
- Central Bank Digital Currency (CBDC) infrastructure

**Competitive Advantage:**
1. **Spec-first architecture** — Single YAML source of truth
2. **Deterministic compilation** — Byte-identical, platform-independent builds
3. **Constitutional enforcement** — 10 immutable invariants
4. **Formal specification** — TLA+ models generated from the same corpus
5. **Audit-ready** — Complete evidence package
6. **Language-neutral** — Protocol defined in YAML, runtime in any language

---

## Intellectual Property

| Asset | Type | Status |
|---|---|---|
| Constitutional YAML specification | Trade secret | Protected |
| Compiler implementation | Copyright | Protected |
| Runtime implementation | Copyright | Protected |
| Generated artifacts | Derivative works | Protected |
| TLA+ models | Copyright | Protected |
| Documentation | Copyright | Protected |
| Brand "SOVR" | Trademark | Registered |
| Domain sovr.finance | Asset | Owned |

---

## Financial Model

### Revenue Streams

| Stream | Model | Target ARR |
|---|---|---|
| Enterprise licenses | Per-deployment annual | $500K–$2M |
| Support contracts | Gold/Platinum tiers | $100K–$500K |
| Implementation services | Time and materials | $200K–$1M |
| Training | Per-seat | $50K–$200K |
| OEM licensing | Per-unit or revenue share | $300K–$1M |

### Cost Structure

| Category | Annual Estimate |
|---|---|
| Engineering | $1.5M–$2.5M |
| Infrastructure | $100K–$300K |
| Security audit | $200K–$500K |
| Legal/compliance | $100K–$200K |
| Marketing | $200K–$500K |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Security vulnerability | Medium | High | External audit, bug bounty |
| Competitor emergence | Medium | Medium | First-mover advantage, patents |
| Regulatory change | Low | High | Constitutional amendment process |
| Key person dependency | Medium | High | Documentation, team expansion |
| Open source alternative | Low | Medium | Proprietary advantages, support |

---

## Recommendations

1. **Immediate:** Complete external security audit (Q4 2026)
2. **Short-term:** File provisional patents on novel mechanisms
3. **Medium-term:** Establish enterprise sales pipeline
4. **Long-term:** Consider strategic partnership or acquisition

---

*Executive summary generated for acquisition due diligence. All figures are estimates. Consult qualified financial and legal advisors.*
