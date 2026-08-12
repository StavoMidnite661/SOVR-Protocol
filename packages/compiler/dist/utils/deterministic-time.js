// ============================================================
// SOVR Compiler — Canonical Compilation Timestamp
// File: packages/compiler/src/utils/deterministic-time.ts
// Version: 0.6.0
// ============================================================
//
// CANONICAL COMPILATION TIME (CCT)
// --------------------------------
// The SOVR deterministic build contract (compiler/BUILD_MANIFEST.yaml,
// reproducibility rules R4/R5/R9 and timestamp_policy) prohibits
// wall-clock leakage into compiler outputs while the authority ABI
// contracts require timestamp metadata fields:
//
//   - IntegrityBlock.timestamp           (REQUIRED, Phase 10B.1 directive
//                                         TASK 2 shape mandate; TS types in
//                                         packages/compiler/src/generators/registries.ts
//                                         and packages/runtime/src/authority/types.ts)
//   - SimulationScenarioCompiled.compiled_at
//                                        (REQUIRED, FROZEN
//                                         governance/simulation/SIMULATION_REGISTRY_ABI_v1.yaml:
//                                         "ISO-8601 timestamp of compilation")
//   - SimulationRegistry.integrity.timestamp
//                                        (REQUIRED, same shape mandate)
//
// These two obligations are reconciled with ONE authoritative mechanism:
//
//   All compiler-generated timestamp metadata carries the Canonical
//   Compilation Timestamp — a fixed, explicitly documented ISO-8601
//   instant that is a pure function of the compiler identity (nothing
//   else). It denotes "the compilation" as a canonical provenance point
//   rather than the physical wall-clock moment of a particular run.
//
// Canonical source of the value
// -----------------------------
// The instant below is the repository's pre-existing canonical
// deterministic time origin, already established in-repo by
// packages/runtime/src/simulation/deterministic.ts (baseTime), where it
// serves as the fixed simulation clock epoch. Reusing the repository's
// established deterministic epoch — instead of inventing a new arbitrary
// constant or deriving a pseudo-date from hash bytes — makes the value
// traceable to an explicitly documented canonical repository source.
//
// Guarantees (verified by the two-compile certification gate):
//   1. Valid ISO-8601 UTC string (ABI-compatible string metadata).
//   2. Identical for identical compiler inputs.
//   3. Independent of host clock        (no Date / Date.now usage).
//   4. Independent of timezone          (fixed 'Z' UTC designator).
//   5. Independent of environment       (no process.env access).
//   6. Independent of filesystem order  (constant).
//   7. Independent of execution time    (constant).
//   8. Independent of randomness        (constant).
//   9. Documented here and in compiler/BUILD_MANIFEST.yaml
//      (timestamp_policy.canonical_generated_at).
//
// This value MUST NOT be replaced by new Date(), Date.now(),
// performance.now(), hash-derived pseudo-dates, or host-dependent data
// without a governance amendment to the deterministic build contract.
// ============================================================
/**
 * The Canonical Compilation Timestamp (CCT).
 *
 * Single authoritative deterministic value used for every compiler-emitted
 * timestamp metadata field: `compiled_at`, scenario `integrity.timestamp`,
 * simulation registry `integrity.timestamp`, and all registry
 * `integrity.timestamp` blocks.
 */
export const CANONICAL_COMPILATION_TIMESTAMP = '2026-08-07T00:00:00.000Z';
/**
 * Returns the Canonical Compilation Timestamp.
 *
 * The function form exists so call sites read as explicit provenance
 * decisions ("canonicalCompilationTimestamp()") rather than unexplained
 * literals, and so the mechanism has a single choke point that audits
 * and determinism gates can inspect.
 */
export function canonicalCompilationTimestamp() {
    return CANONICAL_COMPILATION_TIMESTAMP;
}
//# sourceMappingURL=deterministic-time.js.map