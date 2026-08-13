<!--
HISTORICAL / REMEDIATION RECORD

This file does not describe the current SOVR architecture.
See docs/ARCHITECTURE.md for the implementation that exists now.
-->

# SOC2 Evidence — CC8.1 Change Management

**Control ID:** CC8.1  
**Control Name:** Change Management  
**Framework:** SOC2 Trust Service Criteria (2017)  
**SOVR Version:** 0.6.0  
**Evidence Date:** 2026-07-24

---

## Control Statement

The entity authorizes, designs, develops, configures, documents, tests, and approves changes to infrastructure, data, software, and procedures before implementation.

---

## SOVR Implementation

SOVR enforces change management through:

1. **Constitution Lock:** Protocol specification is versioned and frozen. Changes require governance amendment.
2. **Build Hash:** SHA-256 over all inputs + IR + outputs + compiler version. Any change to inputs changes the hash.
3. **Compiler Certification:** Records compiler version, inputs, outputs, verification results.
4. **Boot Attestation:** Boot hash chain proves runtime started from exact compiled output.

---

## Evidence

### Evidence 1: Build Hash Verification

**File:** `packages/compiler/src/pipeline/`  
**Command:** `node packages/compiler/dist/cli.js verify`

**Verification:**
```bash
node packages/compiler/dist/cli.js compile
node packages/compiler/dist/cli.js verify
# Expected: "Reproducible build verified: b7d8221b..."
```

**Output:** `generated/compiler-manifest.yaml` containing:
```yaml
build_hash: b7d8221b0d7359a7733791d00cf32622df7b707ff4171c0c1b541d91d7568492
inputs:
  - 00_protocol-manifest.yaml
  - 01_constitution.yaml
  ...
outputs:
  - generated/sovr-ir.json
  - generated/compiler-manifest.yaml
  ...
compiler_version: 0.8.0
registry_abi_version: v1
```

---

### Evidence 2: Compiler Certification

**File:** `generated/compiler-certification.json`

**Contains:**
- Compiler version
- Input file hashes (SHA-256 per file)
- Output file hashes
- Build hash
- Verification timestamp
- Pass execution results

---

### Evidence 3: Boot Attestation Chain

**File:** `generated/boot-attestation.json`  
**Verified at:** Runtime startup

**Chain:**
```
build_hash (from compiler manifest)
    ↓
boot_log_hash (SHA-256 of boot sequence log)
    ↓
boot_timings_hash (SHA-256 of stage timings)
    ↓
boot_hash = SHA256(build_hash + boot_log_hash + boot_timings_hash + final_health)
```

**Verification:**
```bash
# Runtime verifies at boot:
# - build_hash in manifest === build_hash in attestation
# - boot_hash chain is continuous
# Output: "boot_hash ... chain: build_hash -> boot_hash = unfakeable"
```

---

### Evidence 4: PASS Registry

**File:** `compiler/PASS_REGISTRY.yaml`  
**Implementation:** `packages/compiler/src/pipeline/`

**20 Compilation Passes:**
- DISCOVERY → PARSE → VALIDATE → RESOLVE → TRANSFORM → GENERATE → CERTIFY → REPORT
- Each pass has `depends_on`, `certification_level`, `on_error` action
- DAG-enforced ordering
- Fail-closed: ERROR/FATAL halt compilation

---

## Test Results

| Test | Expected | Actual | Status |
|---|---|---|---|
| Compile produces consistent build hash | Same hash | Same hash | ✅ PASS |
| Modify YAML → different build hash | Different | Different | ✅ PASS |
| Boot attestation matches manifest | Match | Match | ✅ PASS |
| PASS-001 rejects invalid YAML | Compile fails | Fails | ✅ PASS |
| PASS-002 rejects broken references | Compile fails | Fails | ✅ PASS |

---

## Current Gaps

1. **CI Integration:** Build hash verification not automated in CI (verify-spec.mjs exists but not in CI pipeline).
2. **Signed Artifacts:** Compiler output not cryptographically signed.
3. **Reproducibility in CI:** No CI job verifies byte-identical reproducibility on every commit.

---

## Auditor Verification Steps

1. Run: `node packages/compiler/dist/cli.js compile`
2. Run: `node packages/compiler/dist/cli.js verify`
3. Inspect: `generated/compiler-manifest.yaml` — verify build_hash present
4. Inspect: `generated/boot-attestation.json` — verify boot_hash chain
5. Start runtime: `PORT=3001 node dist/server/index.js`
6. `curl http://localhost:3001/api/v1/boot-attestation` — verify hash matches manifest
