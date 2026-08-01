# Constitutional Drift Report — 2026-08-01

**Classification:** Toolchain defect — **NOT** a constitutional amendment
**Governance action required:** None (informational record)
**Status:** RESOLVED

---

## Summary

On 2026-08-01 an end-to-end audit found the compiler halting `FATAL` at PASS-001 with `CONST-LOCK-002`, reporting that `01_constitution.yaml` did not match the `lock_hash` pinned in `00_protocol-manifest.yaml`.

**The constitution was not modified.** Investigation established that the mismatch was caused entirely by line-ending encoding, not by any change to constitutional content.

---

## Root Cause Correction

| | |
|---|---|
| **Initial assessment** | Constitutional content was modified without governance ratification |
| **Corrected assessment** | Line-ending normalization failure in the compiler's hash path |

### Evidence

The lock was computed on a Windows working tree with CRLF line endings. The audit ran against an LF checkout. Converting the current file to CRLF reproduces the locked hash **exactly**:

```
lock_hash (stored, CRLF basis) : f5d01000a162cd92d85bd7161d5b332056659a67248de111b3de41abc2681aab
01_constitution.yaml as LF     : 34dfbdc2de193f54f87bb873039603bb5a5502a8448ef6151133f54c77a54ed3
01_constitution.yaml → CRLF    : f5d01000a162cd92d85bd7161d5b332056659a67248de111b3de41abc2681aab  ← MATCH
```

An independent copy of the constitution retained locally by the maintainer (Windows-origin, CRLF) was compared structurally against the repository copy:

| Fingerprint | Result |
|---|---|
| Top-level keys | identical (10) |
| Invariant IDs | identical (INV-001 … INV-010) |
| Invariant names | identical (10) |
| Enforcement points | identical (10) |
| Violation severities / actions | identical (10 / 10) |
| Conflict-resolution ranks & categories | identical (7 / 7) |
| Runtime pipeline stages | identical (7) |
| Protected articles | identical (92) |
| Whitespace-normalized full-text diff | **zero differences** |

**Conclusion:** the constitution text is byte-identical to the locked version once line endings are normalized.

### Scope across the corpus

The same test was applied to all 39 certified protocol inputs:

| Result | Count |
|---|---|
| Matched certified hash under CRLF normalization | **38 / 39** |
| Genuine content change | 1 (`00_protocol-manifest.yaml`) |

The single genuine change is `00_protocol-manifest.yaml` — expected, since that file *contains* the lock and was the file under active edit.

---

## The Real Defect

`BUILD_MANIFEST` reproducibility rule **R3** requires *"canonical serialization — NFC Unicode, LF line endings."*

The compiler did not enforce R3 on source bytes. `hashFileContent()` in `packages/compiler/src/utils/hash.ts` hashed the raw buffer as read from disk, so the hash varied with whatever line endings the platform and `git core.autocrlf` produced.

Notably, R3 *was* already enforced for two other axes:
- `canonicalJson()` normalized generated JSON output
- `yaml-loader.ts` normalized path separators to POSIX (audit finding F-3)

Line endings were the remaining unnormalized axis. The consequence: **the "platform-independent, byte-identical" reproducibility claim was platform-dependent in practice.** A Windows and a Linux checkout of identical content produced different build hashes.

The fail-closed mechanism behaved **correctly** — it detected a real byte difference and halted. The defect was that the byte difference was a meaningless encoding artifact that R3 should have eliminated before hashing.

---

## Remediation Applied

1. **Compiler hash normalization** — `packages/compiler/src/utils/hash.ts` gained `canonicalizeSourceText()`, applied by `hashFileContent()`. It strips any UTF-8 BOM, converts CRLF and lone CR to LF, and applies Unicode NFC. R3 is now enforced on source bytes.
   *(Verified NFC is a no-op on the current corpus — no file's content is altered by normalization.)*

2. **Lock hash re-pinned to the canonical value** — `00_protocol-manifest.yaml` `lock_hash` updated from `f5d01000a162…` (CRLF basis) to `34dfbdc2de19…` (canonical LF basis), with an inline comment recording why. **The constitution content is unchanged.**

3. **`.gitattributes` added** — enforces `eol=lf` for the YAML corpus and all source/config types, preventing reintroduction of CRLF into the working tree.

4. **Full recompile + re-attestation** — corpus recompiled and the boot sequence re-run so all artifacts derive from the committed sources.

---

## Verification

```
Compile          : SUCCESS — 39 inputs, 592 IR nodes / 459 edges, 147 artifacts, 0 errors
Reproducibility  : ✓ byte-identical — bb8e457696bee43c5a7eaccfb501d18de7c65d66bf7772e732d92c3569e7d4df
Input hash chain : 39 / 39 match
Registry integrity: 11 / 11 match (hash + entry count)
Boot             : HEALTHY at runlevel 7, attestation matches build hash
Certification    : ✅ PRODUCTION CERTIFICATION PASSED — 0 blocking, 1 warning (TLC unavailable)
```

### Platform-independence proof

The entire 39-file corpus was converted to CRLF (simulating a Windows checkout) in an isolated copy and recompiled:

```
LF   corpus → build hash bb8e457696bee43c5a7eaccfb501d18de7c65d66bf7772e732d92c3569e7d4df
CRLF corpus → build hash bb8e457696bee43c5a7eaccfb501d18de7c65d66bf7772e732d92c3569e7d4df
```

**Identical.** The reproducibility claim is now empirically true rather than merely asserted.

---

## Canonical Build Identity

| Field | Value |
|---|---|
| Build hash | `bb8e457696bee43c5a7eaccfb501d18de7c65d66bf7772e732d92c3569e7d4df` |
| Constitution hash (canonical, LF) | `34dfbdc2de193f54f87bb873039603bb5a5502a8448ef6151133f54c77a54ed3` |
| Compiler version | 0.6.0 |
| Protocol version | 1.0.0 (FROZEN) |

Superseded identifiers: `2ae816fa…`, `d0cb2251…` (build hashes); `f5d01000…`, `4770a831…` (constitution hashes); `5678ed61…` (build id).

---

## Governance Determination

- No constitutional content was changed.
- No amendment process under `11_governance-amendments.yaml` was triggered or is required.
- No invariant, authority boundary, or protected article was altered.
- The change set is confined to the compiler's hashing implementation, the lock hash basis, and line-ending policy.

**This report exists to record that a constitutional-looking alarm was a toolchain defect, and to prevent a future auditor from re-opening it as a governance incident.**
