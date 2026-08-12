/**
 * The Canonical Compilation Timestamp (CCT).
 *
 * Single authoritative deterministic value used for every compiler-emitted
 * timestamp metadata field: `compiled_at`, scenario `integrity.timestamp`,
 * simulation registry `integrity.timestamp`, and all registry
 * `integrity.timestamp` blocks.
 */
export declare const CANONICAL_COMPILATION_TIMESTAMP = "2026-08-07T00:00:00.000Z";
/**
 * Returns the Canonical Compilation Timestamp.
 *
 * The function form exists so call sites read as explicit provenance
 * decisions ("canonicalCompilationTimestamp()") rather than unexplained
 * literals, and so the mechanism has a single choke point that audits
 * and determinism gates can inspect.
 */
export declare function canonicalCompilationTimestamp(): string;
