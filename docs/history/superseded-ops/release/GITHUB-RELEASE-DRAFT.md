<!--
HISTORICAL / REMEDIATION RECORD

This file does not describe the current SOVR architecture.
See docs/ARCHITECTURE.md for the implementation that exists now.
-->

# SOVR Protocol v1.0.0 — The Linux of Finance

## What This Is

SOVR Protocol is a spec-first, compiled financial protocol.

Every financial behavior in this release was derived exclusively
from the constitutional YAML corpus through deterministic compiler
generation. No handwritten financial logic. No domain knowledge
in the runtime. Constitution compiles. Kernel executes.

This is not a payments processor.
This is not a blockchain.
This is not a smart contract platform.

This is the kernel layer from which compliant financial systems
are deterministically built, audited, and reproduced.

## Constitutional Proof

Add escrow domain to YAML only.
Compiler generates all artifacts.
Runtime executes escrow commands.
Zero runtime TypeScript written.

This proof is reproducible at any time from the corpus.

## What v1.0.0 Delivers

- Constitutional specification: FROZEN (105 commands, 259 events, 43 machines)
- All 10 invariants enforced at runtime with dedicated acceptance suites
- 60 acceptance tests across 14 suites
- Secrets management: Vault + AWS (XXVI)
- Capability persistence: PostgreSQL-backed, restart-durable
- Security: 0 HIGH/CRITICAL findings (npm audit prod)
- Compliance: SOC2, GDPR, threat model, pentest surface
- Enterprise deployment: AWS + Azure + GCP (K8s + Helm + Terraform)
- External audit: [AUDITOR NAME] — clean letter [DATE]

## Verification

Build hash: [HASH FROM COMPILER AT RELEASE]
Compiler version: v1.0.0
Runtime version: v1.0.0
Signed by: [GPG KEY ID]

## Known Scope

External rail connections (ACH, FedNow, Fedwire) are v1.1.0.
TigerBeetle integration is v1.1.0.
The kernel is production-ready. The rails are v1.x.

## Auditor Statement

[INSERT AUDIT FIRM NAME]
[INSERT CLEAN LETTER SUMMARY OR LINK]
[INSERT AUDIT DATE]

## Documentation

- docs/audit/ — Audit package
- docs/deployment/ — Institution deployment package
- docs/operations/RUNBOOK.md — Operational runbook
- docs/security/ — Threat model, pentest surface
- docs/compliance/ — SOC2, GDPR

## Repository

https://github.com/StavoMidnite661/SOVR-Protocol
Tag: v1.0.0
Signed: YES (GPG)
