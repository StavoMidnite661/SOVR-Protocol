import type { DeterminismProof } from './index.js';
export declare const DETERMINISM_METHOD = "two_independent_compilations";
/** Recursively collects a directory tree as relPath -> bytes (POSIX rel paths, sorted). */
export declare function collectDirTree(dir: string): Map<string, Buffer>;
/** Byte-for-byte comparison of two trees; returns every difference. */
export declare function compareTrees(a: Map<string, Buffer>, b: Map<string, Buffer>): string[];
/** Digest over sorted "path:sha256(bytes)" — equal iff the trees are equal. */
export declare function treeDigest(tree: Map<string, Buffer>): string;
/** Reads build_hash from a compiled output directory's compiler-manifest.yaml. */
export declare function readBuildHash(outDir: string): string;
/**
 * Runs one isolated compilation as an INDEPENDENT Node process writing
 * into `outDir`. Fails closed (throws) on any non-zero exit.
 */
export declare function runIsolatedCompile(cliPath: string, outDir: string): void;
/**
 * Verifies the intended output tree of the current run against a fully
 * independent isolated compilation (separate Node process, isolated
 * temporary output directory).
 */
export declare function verifyAgainstTree(cliPath: string, run1Tree: Map<string, Buffer>, run1BuildHash: string): DeterminismProof;
/**
 * Fully independent verification: TWO isolated compilations, each in its
 * own Node process and temporary output directory, compared byte-for-byte.
 * Neither run shares any state with the caller. Used by `sovr verify`.
 */
export declare function verifyTwoIndependentCompiles(cliPath: string): DeterminismProof;
/** Converts an intended-output tree (string contents) to byte buffers for comparison. */
export declare function stringTreeToBuffers(tree: Map<string, string>): Map<string, Buffer>;
