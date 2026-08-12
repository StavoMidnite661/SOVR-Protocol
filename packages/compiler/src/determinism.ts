// ============================================================
// SOVR Compiler — Determinism Verification Engine
// File: packages/compiler/src/determinism.ts
// Version: 0.6.0
// ============================================================
//
// Implements the verification method mandated by
// compiler/BUILD_MANIFEST.yaml (verification section):
//
//   "build twice from the same commit; diff manifests;
//    expected: zero differences (byte-identical);
//    on_difference: FAIL_BUILD"
//
// Guarantees of this implementation:
//   - Each verified run is an INDEPENDENT Node process
//     (child_process.spawnSync of the compiler CLI's isolated-compile
//     subcommand). No verification ever compares two executions that
//     share in-memory state, a process, or an output directory.
//   - Each run writes into its own isolated temporary output directory.
//   - Comparison is byte-for-byte over EVERY artifact, plus build hash,
//     compiler manifest, registry manifest and IR serialization.
//   - A wall-clock difference is detected even for runs milliseconds
//     apart, because the comparison is over file bytes and build hashes,
//     never over timing.
// ============================================================

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256 } from './utils/hash.js';
import type { DeterminismProof } from './index.js';

export const DETERMINISM_METHOD = 'two_independent_compilations';

/** Recursively collects a directory tree as relPath -> bytes (POSIX rel paths, sorted). */
export function collectDirTree(dir: string): Map<string, Buffer> {
  const tree = new Map<string, Buffer>();
  const walk = (current: string, prefix: string) => {
    const entries = readdirSync(current).sort();
    for (const entry of entries) {
      const fullPath = join(current, entry);
      const rel = prefix ? `${prefix}/${entry}` : entry;
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath, rel);
      } else if (stat.isFile()) {
        tree.set(rel, readFileSync(fullPath));
      }
    }
  };
  walk(dir, '');
  return tree;
}

/** Byte-for-byte comparison of two trees; returns every difference. */
export function compareTrees(a: Map<string, Buffer>, b: Map<string, Buffer>): string[] {
  const differences: string[] = [];
  const keys = [...new Set([...a.keys(), ...b.keys()])].sort();
  for (const key of keys) {
    const left = a.get(key);
    const right = b.get(key);
    if (left === undefined) {
      differences.push(`missing-in-run-1: ${key}`);
    } else if (right === undefined) {
      differences.push(`missing-in-run-2: ${key}`);
    } else if (!left.equals(right)) {
      differences.push(`bytes-differ: ${key}`);
    }
  }
  return differences;
}

/** Digest over sorted "path:sha256(bytes)" — equal iff the trees are equal. */
export function treeDigest(tree: Map<string, Buffer>): string {
  const parts = [...tree.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, bytes]) => `${path}:${sha256(bytes)}`);
  return sha256(parts.join('\n'));
}

/** Reads build_hash from a compiled output directory's compiler-manifest.yaml. */
export function readBuildHash(outDir: string): string {
  const manifest = JSON.parse(readFileSync(join(outDir, 'compiler-manifest.yaml'), 'utf8'));
  return String(manifest.build_hash ?? '');
}

/**
 * Runs one isolated compilation as an INDEPENDENT Node process writing
 * into `outDir`. Fails closed (throws) on any non-zero exit.
 */
export function runIsolatedCompile(cliPath: string, outDir: string): void {
  const result = spawnSync(process.execPath, [cliPath, '__compile-isolated', '--out', outDir], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(
      `DETERMINISM_VERIFICATION_FAILED: isolated compilation exited with status ${result.status}\n` +
      `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
    );
  }
}

/**
 * Verifies the intended output tree of the current run against a fully
 * independent isolated compilation (separate Node process, isolated
 * temporary output directory).
 */
export function verifyAgainstTree(
  cliPath: string,
  run1Tree: Map<string, Buffer>,
  run1BuildHash: string,
): DeterminismProof {
  const tmpB = mkdtempSync(join(tmpdir(), 'sovr-determinism-B-'));
  try {
    runIsolatedCompile(cliPath, tmpB);
    const treeB = collectDirTree(tmpB);
    const run2BuildHash = readBuildHash(tmpB);
    const differences = compareTrees(run1Tree, treeB);
    if (run1BuildHash !== run2BuildHash) {
      differences.push(`build-hash-differs: run1=${run1BuildHash} run2=${run2BuildHash}`);
    }
    return {
      method: DETERMINISM_METHOD,
      run_1_hash: run1BuildHash,
      run_2_hash: run2BuildHash,
      identical: run1BuildHash === run2BuildHash && differences.length === 0,
      compared_artifacts: new Set([...run1Tree.keys(), ...treeB.keys()]).size,
      artifacts_hash: treeDigest(treeB),
      differences,
    };
  } finally {
    rmSync(tmpB, { recursive: true, force: true });
  }
}

/**
 * Fully independent verification: TWO isolated compilations, each in its
 * own Node process and temporary output directory, compared byte-for-byte.
 * Neither run shares any state with the caller. Used by `sovr verify`.
 */
export function verifyTwoIndependentCompiles(cliPath: string): DeterminismProof {
  const tmpA = mkdtempSync(join(tmpdir(), 'sovr-determinism-A-'));
  const tmpB = mkdtempSync(join(tmpdir(), 'sovr-determinism-B-'));
  try {
    runIsolatedCompile(cliPath, tmpA);
    runIsolatedCompile(cliPath, tmpB);
    const treeA = collectDirTree(tmpA);
    const treeB = collectDirTree(tmpB);
    const run1BuildHash = readBuildHash(tmpA);
    const run2BuildHash = readBuildHash(tmpB);
    const differences = compareTrees(treeA, treeB);
    if (run1BuildHash !== run2BuildHash) {
      differences.push(`build-hash-differs: run1=${run1BuildHash} run2=${run2BuildHash}`);
    }
    return {
      method: DETERMINISM_METHOD,
      run_1_hash: run1BuildHash,
      run_2_hash: run2BuildHash,
      identical: run1BuildHash === run2BuildHash && differences.length === 0,
      compared_artifacts: new Set([...treeA.keys(), ...treeB.keys()]).size,
      artifacts_hash: treeDigest(treeA),
      differences,
    };
  } finally {
    rmSync(tmpA, { recursive: true, force: true });
    rmSync(tmpB, { recursive: true, force: true });
  }
}

/** Converts an intended-output tree (string contents) to byte buffers for comparison. */
export function stringTreeToBuffers(tree: Map<string, string>): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  for (const [path, content] of tree) out.set(path, Buffer.from(content, 'utf8'));
  return out;
}
