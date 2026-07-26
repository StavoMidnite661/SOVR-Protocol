# SOVR Protocol v1.0.0 Release Notes

**The Linux of Finance**

**Date:** 2026-07-26 (pending audit clearance)  
**Version:** v1.0.0  
**Status:** Pre-release (held for external audit + patent filing)

---

## Executive Summary

SOVR Protocol v1.0.0 is the first production-grade release of a **spec-first, compiled financial kernel**.

Every financial behavior is derived exclusively from a frozen constitutional YAML corpus through deterministic compiler generation.

- **No handwritten financial logic**
- **No domain knowledge in the runtime**
- **Constitution compiles. Kernel executes.**
- **Everything is auditable. Everything is provable.**

This is the kernel layer from which compliant financial systems are built.

---

## What Was Proven

| Area                        | Status                  | Evidence |
|-----------------------------|-------------------------|----------|
| Constitutional specification | FROZEN v1.0.0          | 244/244 YAML valid, 10 invariants |
| Compiler determinism        | Verified               | Byte-identical builds, content-addressed hash |
| All 10 invariants enforced  | Complete               | Dedicated enforcers + 60 acceptance tests |
| Secrets management          | Full (XXVI)            | Vault + AWS, TTL cache, audit events |
| Capability persistence      | Durable                | Rebuild at boot + PostgreSQL-backed store |
| Security                    | Hardened               | 0 HIGH/CRITICAL (npm audit prod) |
| Acceptance tests            | 60/60                  | 14 suites covering all critical paths |
| Enterprise readiness        | B+ (75.25/100)         | K8s + Helm + Terraform + docs |

---

## Key Milestones Delivered

- **Directive XXVI** — Secrets Manager Integration (Vault + AWS)
- **Directive XXVII-A** — All 10 invariants enforced at runtime
- **Directive XXV** — 60 acceptance tests (restart-resilient)
- **Directive XIX** — Security hardening + audit package
- **Directive XX** — Certification package (17 artifacts)

---

## What v1.0.0 Is NOT

- Not a payments processor
- Not a blockchain
- Not a smart contract platform
- External rails (ACH, FedNow, Fedwire) → v1.1.0
- TigerBeetle integration → v1.1.0

The kernel is complete. The rails come next.

---

## How to Deploy

See:
- `docs/deployment/` — Institution package
- `docs/operations/RUNBOOK.md` — Operations
- `docker-compose.dev.yml` + `scripts/vault-seed-dev.sh`

Minimal production path:
1. Run Vault or use AWS Secrets Manager
2. Seed secrets via `scripts/vault-seed-dev.sh` (dev) or equivalent
3. `SOVR_SECRETS_PROVIDER=vault|aws`
4. Boot with PostgreSQL event store
5. Capability grants persist across restarts

---

## Audit Status

**External audit:** In progress / pending clean letter

**Pre-audit self-test:** 14/14 PASS

**npm audit (prod):** 0 HIGH / 0 CRITICAL

---

## Contact & Next Steps

- Send `docs/audit/AUDIT-BRIEF.md` to auditor (today)
- File provisional patent (four innovations)
- Hold signed tag until audit letter received

---

**The Linux of Finance ships when the constitution is proven by an independent third party.**

v1.0.0-rc is the reference implementation.  
v1.0.0 is the release.