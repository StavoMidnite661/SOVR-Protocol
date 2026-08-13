<!--
HISTORICAL / REMEDIATION RECORD

This file does not describe the current SOVR architecture.
See docs/ARCHITECTURE.md for the implementation that exists now.
-->

# DETERMINISM REMEDIATION CHECKPOINT — VERIFICATION AUDIT

- **Date:** 2026-08-12 (UTC)
- **Checkpoint:** commit `fcdb73c9d7b2eb7c0fc85eae18182059d7baadb3` on `arena/019ff32c-sovr-protocol` (PR #18)
- **Build identity under verification:** `18c55c3231a606657491a39f62ffc94d8a9589f3766af66901edb863fe46ff80`
- **Mandate:** independent-style verification of the final tree — *"Does the final repository truly contain exactly what the remediation report claims it contains, with no hidden/stale/untracked contradiction?"* Read-only against the final tree; all reproduction runs executed in `/tmp/sovr-check/`.

---

## 1. VERIFICATION RESULT: PASS (with one hygiene finding, corrected in the checkpoint-hygiene commit)

Every claim in `DETERMINISM_REMEDIATION_REPORT.md` was re-derived mechanically from the final tree. No hidden, stale, or contradictory state was found. The single finding (a non-compiler byproduct inside `generated/`) is documented in §4 and corrected in the accompanying hygiene commit; it does not affect build identity.

## 2. CHECK-BY-CHECK EVIDENCE

| # | Check | Method | Result |
|---|-------|--------|--------|
| V1 | Branch/tree state | `git log`, `git status --porcelain`, ls-remote comparison | ✅ HEAD = `fcdb73c` = origin tip; working tree 0 deviations |
| V2 | No wall-clock/randomness in compiler src | grep over generators/ir/pipeline/index/determinism/utils | ✅ Only hit: `typescript.ts:155` — a literal string emitted into *runtime* event-builder code (deterministic as text; runtime semantics, out of scope) |
| V3 | Canonical constant everywhere; no other ISO metadata | full value scan of all generated artifacts | ✅ 30 compiler-emitted timestamp fields = `2026-08-07T00:00:00.000Z`; the only other ISO values (`expiration`, `settled_at`) traced to frozen scenario YAML **payload data** (SIM-004:59,74; SIM-007:153) — deterministic input content, not compiler metadata |
| V4 | Required ABI fields present | parsed all artifacts | ✅ 15/15 registries carry `integrity.timestamp`+`hash`+`generated_by`; 7/7 scenarios carry `compiled_at` + scenario `integrity.timestamp`; registry-level `integrity.timestamp` present — all REQUIRED types intact |
| V5 | Manifest ↔ disk ↔ certification chain | recomputed SHA256 over canonicalized bytes | ✅ 168/168 `output_hashes` match disk; 15/15 registry.manifest hashes match; certification `build_hash`/`ir_hash`/`registry_hashes` consistent; proof `identical: true` with 0 differences over 172 compared artifacts; R-flags all true with VERIFIED evidence |
| V6 | `dist` ↔ `src` correspondence | clean `tsc` rebuild of current src in `/tmp`, diff vs committed dist | ✅ **90/90 files byte-identical, zero differences** — committed dist is exactly what current source produces |
| V7 | Final tree reproduction | two isolated compilations (A/B) + full verified compile vs committed `generated/` | ✅ A=B byte-identical (0 diffs); A build hash = `18c55c32…`; verified-compile output byte-equal to committed tree except the §4 byproduct |
| V8 | Hidden/stale/untracked contradictions | tracked-but-missing scan, cache/log/orphan scan, untracked inventory | ✅ 0 tracked-but-missing; no `.sovr-cache`, no stray logs (compile1/2.log are intentionally tracked historical evidence), 0 untracked non-ignored files |
| V9 | Negative determinism | one-line mutation of `projection-engine.yaml` in isolated copy | ✅ build hash changes (`18c55c32…` → different); compiler identifies exactly `projection-engine.yaml` and the single affected output `registries/projections.registry.json` |
| V10 | Certification honesty at source level | grep for hardcoded proof patterns | ✅ `identical: true` appears only inside the `if (proof.identical)` evidence path (`cli.ts`) and doc comments; the old single-hash duplication pattern (`runHash` → run_1/run_2) is gone (0 occurrences); unverified runs emit `NOT_PERFORMED / identical: false` |

## 3. INCIDENT NOTE (transparency)

During this verification turn the local checkout was found reset to the pre-remediation commit (`cf179a3`) with the remediation present only as working-tree modifications — an environment snapshot artifact, not a repository contradiction. The pushed checkpoint was intact on origin (`git ls-remote` showed `fcdb73c` at the branch tip); the local pointer was restored via `git fetch` + `git reset FETCH_HEAD`, after which the tree verified clean (0 deviations from the checkpoint). All checks above ran against the restored, verified state.

## 4. HYGIENE FINDING (corrected)

`generated/audit/economic-lineage-report.json` — output of `scripts/generate-economic-lineage-report.mjs`, executed during remediation validation — was inadvertently included in the checkpoint commit. It is **not** a compiler artifact (not among the 168 primary, not among the 4 evidence artifacts). V7 shows the compiler's certified output set is otherwise byte-exact. The hygiene commit removes it from tracking (regenerable by the script at any time) and codifies the artifact taxonomy so such byproducts are classified explicitly (§5).

## 5. ARTIFACT TAXONOMY (now codified in `compiler/BUILD_MANIFEST.yaml → artifact_taxonomy`)

```
PRIMARY GENERATED ARTIFACTS  = 168   (PASS-015 outputs; the output_hashes map; feed build_hash)
BUILD/COMPILER EVIDENCE      =   4   (compiler-manifest.yaml, sovr-ir.json,
                                      registries/registry.manifest.json,
                                      compiler-certification.json)
TOTAL CERTIFIED OUTPUT SET   = 172   (the two-compile comparison set)
```

"168" and "172" in different documents are therefore **not drift** — they name different sets, now defined in one authoritative place. Script byproducts (e.g. `generated/audit/*`, `generated/simulation/reports/*`) are AUDIT/SIMULATION-RUN EVIDENCE, never part of either count.

## 6. SEMANTIC CLASSIFICATION OF THE CANONICAL TIMESTAMP

Per the reviewer's required distinction, recorded in `BUILD_MANIFEST.yaml → timestamp_policy.canonical_generated_at.semantics_provenance`:

> **Technically resolved; governance semantics ESTABLISHED BY THE 2026-08-11 REMEDIATION.**
> The repository previously defined no value semantics for `compiled_at` /
> `IntegrityBlock.timestamp` (CONTRACT_SEMANTICS_INVESTIGATION.md §A, §H1/H2:
> UNRESOLVED). The canonical reading is the operative contract from the
> remediation forward; it is *not* a claim of historical intent. Supersession
> requires a governance amendment that preserves R5/R9.

## 7. THE 85 WARNINGS — CLASSIFICATION INVENTORY

Extracted from the tracked manifest diagnostics and re-analyzed against the YAML corpus (exact + normalized name search). **None are compiler defects; none are false positives; none are absorbed by the determinism remediation.**

| Class | Count | Content | Disposition |
|---|---|---|---|
| PROTOCOL_REFERENCE_DEFECT — command absent from catalog | 13 | PascalCase AMD-0005 commercial commands (`ValidateObligation`, `AuthorizeSettlement`, `ExecuteSettlement`, `CancelObligation`, `DisputeSettlement`, `CancelSettlement`, `GenerateEvidencePackage`, `SignAttestation`, `PublishPackage`, `ArchivePackage`) referenced by state machines `CommercialObligation`, `SettlementRecord`, `EvidencePackage`; no exact or normalized match in `03_command-catalog.yaml` | Amendment ratified (CHANGELOG: AMD-0005 "8 new commands") but catalog entries absent — protocol content must be reconciled by governance |
| PROTOCOL_REFERENCE_DEFECT — event absent from catalog | 1 | `escrow.account.cancel` → `escrow.account.cancellation_failed` missing from `04_event-catalog.yaml` | Same disposition |
| SEMANTIC_MODEL_GAP — natural-language guards | 71 | Guard conditions written as prose ("3600s elapsed without authorization", "all authorization gates passed", …) with no structured field reference resolvable by PASS-008 | Semantic-model gap; possibly intentional prose in some cases — governance must decide structured-guard policy |
| COMPILER_DEFECT | 0 | — | — |
| FALSE_POSITIVE | 0 | every reported reference was verified genuinely absent (exact + case/delimiter-normalized search) | — |

These remain visible in the manifest diagnostics of every compilation and are untouched by this remediation (§15 scope boundary). They require their own governance directive for triage.

## 8. CHECKPOINT FREEZE

The remediation result is frozen as checkpoint `sovr/determinism-remediation-checkpoint` (annotated tag) at the hygiene commit on `arena/019ff32c-sovr-protocol`. Any future compiler work must branch from this checkpoint and must not regress: the two-process determinism gate (exit non-zero on failure), the canonical timestamp mechanism, the unified integrity-hash boundary, or the evidence-based certification.

**Verification verdict: the final repository contains exactly what the remediation report claims — no hidden, stale, or untracked contradiction remains.**
