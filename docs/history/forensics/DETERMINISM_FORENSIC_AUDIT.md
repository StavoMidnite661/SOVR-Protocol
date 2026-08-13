<!--
HISTORICAL / REMEDIATION RECORD

This file does not describe the current SOVR architecture.
See docs/ARCHITECTURE.md for the implementation that exists now.
-->

# DETERMINISM FORENSIC AUDIT — SOVR-Protocol

- **Date:** 2026-08-11 (UTC)
- **Repo state audited:** branch `arena/019ff32c-sovr-protocol`, single commit `cf179a32601d345e4bbab49a29b7f3333c32eeec`, working tree clean before and after this audit (verified with `git status --porcelain` → 0 changes).
- **Mode:** READ-ONLY against the repository. No tracked file was modified, regenerated, or deleted. The two-compile reproduction was executed exclusively in temporary copies under `/tmp/sovr-audit/{A,B}`.
- **Scope note:** All line numbers cited below refer to files at the commit above.

---

## 1. Executive Finding

**The current compiler source is NON_DETERMINISTIC, and the workspace is internally misaligned on three independent axes:**

1. **Wall-clock in build identity.** `packages/compiler/src/generators/registries.ts:96` and `packages/compiler/src/generators/simulation.ts:120,131,144` embed `new Date().toISOString()` values into generated artifact *content*. Those artifacts' SHA256s feed `outputHashes` (`packages/compiler/src/index.ts:232-234`), which feed `buildParts`, which feed `buildHash` (`index.ts:248-262`). Therefore wall-clock metadata **is part of build identity**. Two compiles of the identical tree produced different build hashes (§8).

2. **Self-certification contradicts reality.** The compiler manifest hard-codes `R5_no_wall_clock: true` and `R9_byte_identical: true` (`index.ts:293-303`) and `compiler-certification.json` emits a fabricated `deterministic_proof` with `identical: true` computed from a *single* hash duplicated into `run_1_hash`/`run_2_hash` (`index.ts:435-437`). Both frozen governance specs explicitly prohibit this behavior (§7).

3. **Tracked artifacts were not produced by the tracked source.** The committed `generated/` artifacts contain **no** `timestamp`/`compiled_at` fields, while the committed source emits them; the committed `dist/` is stale (its `registries.js` `withIntegrity` omits the timestamp, and `dist/generators/simulation.js` is missing entirely even though `dist/index.js:28` imports it — the shipped CLI cannot run at all). The tracked manifest (`build_hash 4d2ff268…`) matches neither the historical compile logs (`631f3d9c…`, `68281135…`) nor any fresh compile. Four distinct build hashes exist in this workspace's evidence trail.

No deterministic timestamp mechanism exists anywhere in the repository: `DETERMINISTIC_TIMESTAMP_MECHANISM_NOT_FOUND`.

**Final classification: `NON_DETERMINISTIC`** (§14 detail; no remediation performed).

---

## 2. Compiler Pipeline Trace

Actual execution path, traced from source (not comments):

| # | Stage | Location | Determinism-relevant fact |
|---|-------|----------|---------------------------|
| 1 | CLI entry | `packages/compiler/src/cli.ts:13-14,22-26` | `compile` → `compile(rootDir, outDir)`; outDir = `<root>/generated` |
| 2 | Discovery | `packages/compiler/src/utils/yaml-loader.ts:37-87` | `readdirSync` over root, `domains/`, `compiler/`, `protocol/`, `governance/simulation/scenarios/`; **sorted lexicographically at line 86** (R2 mitigates FS ordering) |
| 3 | Input hashing | `yaml-loader.ts:15-34` + `packages/compiler/src/utils/hash.ts:44-52` | `hashFileContent` strips BOM, normalizes CRLF→LF and NFC before SHA256 (mitigates platform/git-autocrlf variance); `relativePath` normalized to POSIX separators (`yaml-loader.ts:29`) |
| 4 | Parse | `PASS-002`, `index.ts:142-147` | `parseProtocol(loaded)` |
| 5 | Semantic passes | `PASS-006/008`, `index.ts:159-181` | Reference + semantic diagnostics |
| 6 | IR build | `PASS-013`, `index.ts:183-188` → `packages/compiler/src/ir/builder.ts:211-233` | Nodes sorted by id (`builder.ts:212`), edges sorted (`builder.ts:213-217`), `irHash = sha256(canonicalJson(...))` (`builder.ts:229-232`). **Proven deterministic**: `sovr-ir.json` byte-identical across reproduction runs A/B (§8) |
| 7 | Generation | `PASS-015`, `index.ts:190-220` | 15 generator groups; each `GeneratedFile` carries `sha256(content)` computed at generation time |
| 8 | **Timestamp injection** | `registries.ts:52,96`; `simulation.ts:120,131,144` | Wall-clock values written into artifact content **before** file hashing — inside PASS-015, i.e. **before** buildHash computation (§3) |
| 9 | `inputHashes` | `PASS-018`, `index.ts:227-230` | Sorted by `relativePath` |
| 10 | `outputHashes` | `PASS-018`, `index.ts:232-234` | `outputHashes[g.path] = g.sha256` for every generated file, sorted by path — **includes the timestamp-bearing files** |
| 11 | `sortedOutputHashValues` | `index.ts:237` | `path:sha256` strings, key-sorted |
| 12 | `buildParts` | `index.ts:248-255` | `[...sortedInputHashValues, irHash, ...sortedOutputHashValues, compilerVersion, JSON.stringify(registryVersions), generationOrder.join(',')]` |
| 13 | `buildHash` | `index.ts:262` → `hash.ts:54-58` | `buildHashFromParts` = `sha256(parts.join(''))` |
| 14 | Manifest | `PASS-019`, `index.ts:265-320` | Manifest itself carries **no** wall-clock field; but hard-codes `reproducibility.R1…R10: true` (`index.ts:293-303`) and `timestamp_policy` string (`index.ts:305`) without any runtime check |
| 15 | Write-out | `index.ts:325-344` | `compiler-manifest.yaml`, 168 artifacts, `sovr-ir.json` |
| 16 | `registry.manifest.json` | `writeRegistryManifest`, `index.ts:355-374` | Embeds per-registry `sha256` + `build_hash` → cascades non-determinism |
| 17 | `compiler-certification.json` | `writeCompilerCertification`, `index.ts:376-405,435-437` | `deterministic_proof.run_1_hash = run_2_hash = sha256(one payload)`, `identical: true` — **a single run duplicated, not a two-run proof** |
| 18 | Boot (separate command) | `cli.ts:16-20` → `packages/compiler/src/boot/index.ts` | POST (`post.ts`), bootloader re-verifies input hashes vs `generated/compiler-manifest.yaml` (`bootloader.ts:23-50+`), then runlevels 2–7 (`kernel-init.ts`) |
| 19 | Boot attestation | `kernel-init.ts:62,150-155,187-207`; `boot/index.ts:79-99` | Boot events stamped `new Date().toISOString()` (`kernel-init.ts:62`); `bootHash = sha256(buildHash|bootLogHash|bootTimingsHash|HEALTHY)` where timings are `performance.now()` durations — **boot attestation is non-reproducible by construction**, though it consumes `buildHash` rather than feeding it |

Investigated and cleared: `Math.random` / `randomUUID` / env-var usage in compiler source — **none found** (`grep` over `packages/compiler/src` returned only literal code-template strings, §3). Filesystem ordering — neutralized by `candidates.sort()` (`yaml-loader.ts:86`) and PASS-018 sorting. Object key ordering — neutralized by `canonicalJson` key-sorting (`hash.ts:7-25`).

---

## 3. Timestamp Sources

### 3.1 Wall-clock values that feed buildHash (root cause)

| Source | Line | Value | Introduced relative to buildHash |
|--------|------|-------|----------------------------------|
| `registries.ts` `withIntegrity()` | **96** | `integrity.timestamp = new Date().toISOString()` in all 15 `*.registry.json` files | PASS-015, **before** buildHash (PASS-018). Serialized into file content (`registries.ts:53`), hashed at `registries.ts:55`, enters `outputHashes` → `buildHash` |
| `simulation.ts` scenario field | **120** | `compiled_at: new Date().toISOString()` per scenario | PASS-015, before buildHash. Serialized into `scenarios.registry.json`, hashed at `simulation.ts:158` |
| `simulation.ts` scenario integrity | **131** | per-scenario `integrity.timestamp` | Same file, same hash |
| `simulation.ts` registry integrity | **144** | registry-level `integrity.timestamp` | Same file, same hash |

Additionally, `simulation.ts:139-142` computes the registry-level `integrity.hash` over `regHashPayload = { abi_version, scenarios, entry_count }` where `scenarios` **still contains** every scenario's `compiled_at` and `integrity.timestamp`. So this integrity hash is *also* run-dependent (proven: A=`665b0c04…` vs B=`95f70f03…` in `scenarios.registry.json`). Contrast: `registries.ts:87-89` deletes the `integrity` block before hashing, so per-registry `integrity.hash` values are deterministic even though the files are not.

### 3.2 Wall-clock values that do NOT feed buildHash

| Source | Line | Note |
|--------|------|------|
| `boot/kernel-init.ts` | **62** | Boot event `timestamp: new Date().toISOString()` — lands in `boot-attestation.json`/`boot-manifest.json` only |
| `boot/bootloader.ts`, `boot/post.ts`, `boot/kernel-init.ts` | 23/50/108, 16/67, 51-150 | `performance.now()` durations in boot logs/timings → `bootHash` (`kernel-init.ts:152-155`), never `buildHash` |
| `generators/typescript.ts` | **155** | `new Date().toISOString()` emitted as **literal source text** inside generated runtime code — deterministic as bytes; a runtime concern, not a compile concern |

### 3.3 Randomness / environment

- `Math.random`, `crypto.randomUUID`, `process.env` in hash-relevant paths of `packages/compiler/src`: **none** (verified by grep; only matches are the literal template string at `typescript.ts:155` and a Prisma schema literal `@default(uuid())` at `prisma.ts:34`).
- `post.ts:32-40` explicitly checks env isolation (R10) — no env value is incorporated into hashes.

---

## 4. Generated Artifact Evidence

### A. Current source generator behavior (what `src/` emits today)

- All 15 `registries/*.registry.json`: `integrity.timestamp` = wall-clock ISO-8601 (`registries.ts:96`).
- `simulation/scenarios.registry.json`: per-scenario `compiled_at` + `integrity.timestamp`, registry-level `integrity.timestamp` and non-deterministic registry-level `integrity.hash` (`simulation.ts:120,131,139-144`).
- Proven live in reproduction §8: 17 primary artifacts differ run-to-run solely due to these fields.

### B. Current tracked artifact behavior (what is committed under `generated/`)

- **Zero wall-clock timestamps.** `grep -rE '"(timestamp|compiled_at)":\s*"2[0-9]{3}-' generated/` → **no matches**. All `"timestamp"` hits are schema-type descriptors (`"timestamp": "ISO-8601"`, `"type": "timestamp"`) from the event envelope/contract schemas — not timestamp values.
- Integrity blocks exist in all 15 registries and the simulation registry (`generated_by.compiler_version: "0.6.0"` + `hash`) but **omit the `timestamp` key entirely** (e.g. `generated/registries/boot.registry.json` tail).
- Simulation scenarios **omit `compiled_at`** entirely (`generated/simulation/scenarios.registry.json`).
- The tracked `generated/compiler-manifest.yaml` (`build_hash: 4d2ff268…`) is **self-consistent with the tracked files**: all 168 `output_hashes` match the canonicalized SHA256 of the files on disk (168/168 match, verified programmatically). So the tracked artifacts are a coherent snapshot of *some* compile — just not one the current source can produce.

### C. Historical behavior (repository evidence)

| Evidence | Build hash | Notes |
|----------|-----------|-------|
| `compile1.log` (UTF-16, Windows `D:\sovr-financial-os-protocol-v1.0.0`) | `631f3d9c811a99a069c018faeabe538493a6551cc9d15a6f75e36bf13b5ea642` | 168 artifacts, 85 warnings |
| `compile2.log` (same machine/path) | `68281135f723793e37816c0940c95356635f3f42cf7408c5b9303d9d04af58c2` | Same stats, **different hash** → historical run-to-run non-determinism |
| `audit/remediation-baseline/REMEDIATION_BASELINE_MANIFEST.json` | pins `68281135…` (= compile2.log) at `git_commit: 1132fc67…` | That commit **does not exist** in this repo's history (only `cf179a3`). Baseline also references `boot-manifest.json`/`boot-attestation.json` hashes (`6d08848f…`/`1838a1b6…`) **for files not present anywhere in the tracked tree** |
| Tracked `generated/compiler-manifest.yaml` | `4d2ff2682d57821d8597dc587a66a1c0e9e083a1a66003ec2c5726d1f0f6f466` | A **fourth** distinct hash; consistent with tracked files (§4B) |
| `CHANGELOG.md:41-45` | claims "Build hash: content-addressed, byte-identical (R1-R10 verified)", "Determinism: verified" | Unsubstantiated by any mechanism in-repo; contradicted by §8 |
| `dist/` vs `src/` | — | `dist/generators/registries.js:62-72` `withIntegrity` emits **no timestamp** (matches tracked artifacts); `dist/generators/simulation.js` **missing** while `dist/index.js:28` imports it → committed CLI entry is broken (`ERR_MODULE_NOT_FOUND`). Tracked artifacts are byte-equal to fresh current-source output **minus** the timestamp fields (§9), i.e. they match the stale dist's behavior, not `src/` |

Conclusion for C: the repository has at some point compiled with a timestamp-free generator (the one compiled into `dist/`), then `src/` gained wall-clock timestamps without regenerating/reconciling artifacts. Git history is squashed to one commit, so the exact transition cannot be dated from this repo.

---

## 5. Build Hash Construction

From `index.ts:248-262` and `hash.ts:54-58`:

```
buildParts = [
  ...sortedInputHashValues,     // "path:sha256(canonicalized source bytes)", key-sorted
  ir.meta.irHash,               // sha256(canonicalJson(sorted nodes/edges))
  ...sortedOutputHashValues,    // "path:sha256(generated file bytes)" ← wall-clock inside
  compilerVersion,              // "0.6.0"
  JSON.stringify(registryVersions),
  generationOrder.join(','),    // sorted generated paths
]
buildHash = sha256(buildParts.join(''))
```

This matches the formula in `compiler/BUILD_MANIFEST.yaml` (`build_hash` field). **Q11/Q12 answered: yes — generated-file SHA256 values feed `buildHash`, and since 17 generated files contain wall-clock strings, wall-clock metadata is part of build identity.** The manifest's `timestamp_policy` string ("build_hash uses content hashes only", `index.ts:305`) is literally true and materially misleading: the *content* being hashed includes wall-clock values.

---

## 6. Type Contract Evidence

| Contract | Location | Declaration | Required/Optional |
|----------|----------|-------------|-------------------|
| `IntegrityBlock.timestamp` (compiler-side) | `packages/compiler/src/generators/registries.ts:8-13` | `timestamp: string` | **REQUIRED** |
| `SimulationScenarioCompiled.compiled_at` | `packages/compiler/src/generators/simulation.ts:54` | `compiled_at: string` | **REQUIRED** |
| Scenario `integrity.timestamp` | `simulation.ts:55-60` | `timestamp: string` | **REQUIRED** |
| `SimulationRegistry.integrity.timestamp` | `simulation.ts:66-72` | `timestamp: string` | **REQUIRED** |
| `IntegrityBlock.timestamp` (runtime consumer) | `packages/runtime/src/authority/types.ts:7-12` | `timestamp: string` | **REQUIRED** |
| Runtime registry shapes | `authority/types.ts:48,74,92,100` | `integrity: IntegrityBlock` | **REQUIRED** |
| `IntegrityBlock` (validator copy) | `packages/runtime/src/authority/integrity-validator.ts:9-14` | `timestamp: string` | **REQUIRED** |

**Does the generator satisfy these contracts?** The **current source** does (it emits every required field). The **tracked artifacts do not** — they lack `timestamp`/`compiled_at` entirely, so they violate the declared interfaces as data. Runtime enforcement is weak: `IntegrityValidator.verify` (`integrity-validator.ts:51-93`) only requires `integrity.hash` and never inspects `timestamp`, so the violation passes silently at runtime; it would fail any strictly-typed consumption of the artifacts.

Nothing was changed. Contracts reported as-found.

---

## 7. ABI/Governance Evidence

**Authoritative determinism contract** — `compiler/BUILD_MANIFEST.yaml`:
- `timestamp_policy.wall_clock_in_manifest: PROHIBITED`, `generated_at_field: omitted_or_canonical_only` (lines 84-90): "Any wall-clock value would break byte-identical reproducibility. Provenance is captured by content hashes, not time."
- `reproducibility_rules` (lines 95-105): **R4** no randomness; **R5** "no wall-clock or environment-variable leakage into **outputs**"; **R9** "identical inputs + identical compiler version => byte-identical manifest".
- `verification` (lines 110-113): "build twice from the same commit; diff manifests; expected: zero differences; on_difference: FAIL_BUILD with CERT diagnostic".

**`compiler/SEMANTIC_COMPILER_CONTRACT.yaml:162-172`** (authority: `compiler.yaml` FROZEN + `13_compiler-adr.yaml` FROZEN): `determinism.guarantees: [same_input_same_output, order_independent_parsing, no_wall_clock_or_random_in_generation]`; `repeatability.reproducible_build: true`.

**`compiler/PASS_REGISTRY.yaml:289`**: PASS-019 MANIFEST_GENERATION declared `deterministic: true`.

**`13_compiler-adr.yaml`** (ADR-COMP-002): CANONICAL_PIR must be byte-identical across runs/machines; "optimization passes cannot break determinism guarantees" — governs the IR layer (which is in fact deterministic, §8).

**Semantics of `compiled_at` / `timestamp`:** No governance document defines the semantic meaning of `IntegrityBlock.timestamp` or `compiled_at` (wall-clock generation time vs. canonical value). The only timestamp semantics defined anywhere are for the **runtime event envelope** — `04_event-catalog.yaml:128-131`: `timestamp: type timestamp, required: true, "When the event occurred (domain time, not wall clock)"` — a different concept (runtime domain time) that does not govern compiler artifacts. The ABI shapes (§6) require the fields but nowhere specify their value source.

**Deterministic timestamp mechanism:** searched for `SOURCE_DATE_EPOCH`, fixed-epoch constants, input-derived timestamp derivation, or any canonical-time policy implementation: none exists.

`DETERMINISTIC_TIMESTAMP_MECHANISM_NOT_FOUND`

**Unresolved governance conflict (reported, not resolved):** the ABI contracts *require* `timestamp`/`compiled_at` fields; the frozen determinism rules *prohibit* wall-clock leakage into outputs. The repository contains no rule stating which prevails for integrity blocks, nor any sanctioned canonical value. Per this audit's constraints, no design conclusion is drawn from that gap.

---

## 8. Two-Compile Reproduction

Method (read-only w.r.t. the repository): workspace copied twice to `/tmp/sovr-audit/A` and `/tmp/sovr-audit/B` (excluding `.git`); in each copy the compiler was **rebuilt from the current `src/`** (`tsc 5.6.3`, fresh `dist/`, because the committed `dist/` is broken — §4C), deps `js-yaml@4.1.0`; then `node dist/cli.js compile` run in A, 3 s later in B. Node v22.22.3, UTC, same host.

| | COMPILE A | COMPILE B |
|---|-----------|-----------|
| **build hash** | `c90c80c66eb215263458e36910a2851acc32200ef7c0dc499db7473148a65b20` | `75e9082f20dce9852b4f1a1d85091a1e6b5c73e84cbd5f4cef70d7fb1c488511` |
| Artifacts generated | 168 | 168 |
| **identical** | **NO** | |
| Differing files | **19** (list below) | |
| Byte-identical files | the other 149, **including `sovr-ir.json`** | |

Both runs' `compiler-certification.json` nevertheless claim `deterministic_proof.identical: true` (A: `run_1_hash=run_2_hash=ab0a01df…`; B: `30122507…`).

Additional stability findings:
- All 7 per-scenario `integrity.hash` values in `scenarios.registry.json` are **identical** A↔B (their hash payload excludes `compiled_at`/`integrity`, `simulation.ts:124-128`), and equal the hashes in the tracked artifact.
- All 15 per-registry `integrity.hash` values are deterministic (payload excludes `integrity`, `registries.ts:87-89`).
- The registry-level `integrity.hash` of `scenarios.registry.json` is **not** deterministic (payload includes wall-clock fields, `simulation.ts:139-142`).
- `inputHashes` and `irHash` are identical A↔B (input normalization and IR canonicalization work).

---

## 9. Byte-Level Differences

All 19 differing files, with SHA256 (A | B):

| File | SHA256 A | SHA256 B |
|------|----------|----------|
| `generated/compiler-certification.json` | `949df4356a1ece87…f0f5a517` | `13ac9633e142667a…a78e18c1` |
| `generated/compiler-manifest.yaml` | `ff3aa68ce73bfd4b…c70244b4` | `0ff82b18294475bc…8b469de4` |
| `generated/registries/boot.registry.json` | `2a25d040f37632bb…93a2552a` | `08c7bf5792f77515…2fb9cf66` |
| `generated/registries/capabilities.registry.json` | `9696fa6553e2ea0b…16504225` | `32571e997ea75f78…8d3f1d7d` |
| `generated/registries/commands.registry.json` | `962c49894ccf2c6a…c8514f8a` | `a8c01d840111fad1…b834952e` |
| `generated/registries/constitution.registry.json` | `eefb9219aff2cb7c…bf8fc890` | `e65d048f8bb27d3b…d2209bd2` |
| `generated/registries/contracts.registry.json` | `33c5cb83003ff19a…ac91d08b` | `6b39a6f89935782c…6bacf977` |
| `generated/registries/economic.registry.json` | `6c5fb1f19c9f3ae7…e76ca5f8` | `5276e1c92e533c0b…7a58450f` |
| `generated/registries/envelopes.registry.json` | `7254359893345753…0d9a32fd` | `16ec5fd0b91ac829…c534cc4d` |
| `generated/registries/events.registry.json` | `126858cce110dfcd…f307f54b` | `08c974d9aea38c3f…6b5c0576` |
| `generated/registries/execution-plans.registry.json` | `0756fba855c351aa…da904913` | `1769a7b3ca22b804…99f59bf6` |
| `generated/registries/machines.registry.json` | `af0c26d1c1143b46…2d734ad9` | `94a7dc9814390d3c…cbc28ce3` |
| `generated/registries/projections.registry.json` | `1b4aed23a369e5a4…ecf93864` | `10d251692b30cf3f…89db71d5` |
| `generated/registries/registry.manifest.json` | `6e8d2dee0985c010…8f996219` | `cd958c72a8d60894…dc5bd1ae` |
| `generated/registries/reserve.registry.json` | `c1fd4d380a5e61e8…943f554c` | `10d987f813cd9309…061b842d` |
| `generated/registries/schemas.registry.json` | `9b5c622bf920ba2a…fc58e37d` | `caf76fe552175ba4…1a24afd9` |
| `generated/registries/settlement.registry.json` | `405a432de6ae66a2…0b43f7f3` | `bd87598ecf5f0477…80f01f78` |
| `generated/registries/validation.registry.json` | `85e2ef250580d269…3e234410` | `8dff61d3e071ac9d…da04665e` |
| `generated/simulation/scenarios.registry.json` | `b87f71ff1100ecb3…7fe837c2` | `ad19266de4f27822…663d4efc` |

(Full 64-hex values captured in `/tmp/sovr-audit/` during the audit.)

**Exact fields causing differences — verified by `diff`:**

1. **Primary (17 files):**
   - 15× `registries/*.registry.json`: exactly one differing line each — `"timestamp": "2026-08-11T23:37:28.xxx"` (A) vs `"2026-08-11T23:37:32.xxx"` (B) in `integrity` (e.g. `boot.registry.json:28`, `events.registry.json:12493`).
   - `simulation/scenarios.registry.json`: 7× `compiled_at`, 8× `integrity.timestamp` (7 scenario + 1 registry), **plus** the registry-level `integrity.hash` (A `665b0c04…` vs B `95f70f03…`) because its payload includes those wall-clock fields.
2. **Cascading (2 files + 2 hashes):**
   - `registry.manifest.json`: per-registry `sha256` values + `build_hash`.
   - `compiler-manifest.yaml`: `build_hash` + the 17 `output_hashes` entries (38-line diff total — nothing else).
   - `compiler-certification.json`: `registry_hashes`, `build_hash`, `deterministic_proof.run_*_hash`.

**No other differences.** All TypeScript/OpenAPI/Prisma/Kafka/Redis/TLA+/VEL/topology/guardrail/agent artifacts and `sovr-ir.json` are byte-identical.

**Tracked-artifact comparison:** fresh current-source output with the timestamp fields removed is byte-equal (modulo registry-level `integrity.hash`) to the tracked `generated/` files — verified for `boot.registry.json`, `commands.registry.json`, `scenarios.registry.json`. The tracked artifacts therefore correspond to the stale `dist/` generator behavior, not to `src/`.

---

## 10. Root Cause

Primary, proven:

1. **`new Date().toISOString()` is serialized into generated artifact bytes** (`registries.ts:96`; `simulation.ts:120,131,144`), and **those bytes are hashed into build identity** (`index.ts:232-262`). Any two runs separated by ≥1 ms differ. This directly violates frozen rules R4/R5/R9 and `timestamp_policy` (§7), while the manifest self-certifies those rules as satisfied (`index.ts:293-305`) with no enforcement.
2. **Inconsistent integrity-hash payloads:** `registries.ts` excludes `integrity` from its hash payload (deterministic), but `simulation.ts:139-142` hashes the registry level over scenarios *including* wall-clock fields (non-deterministic). Two divergent integrity schemes.

Aggravating (misalignment, proven):

3. **Source/artifact divergence:** tracked `generated/` lacks the fields `src/` emits (§4B, §9); tracked `dist/` is stale and unrunnable (missing `simulation.js`, imported at `dist/index.js:28`); committed `build_hash 4d2ff268…` cannot be reproduced from committed source.
4. **Fabricated proof:** `compiler-certification.json` hard-codes `identical: true` from one duplicated hash (`index.ts:435-437`); `cli.ts:84-94` `verify` runs two executes inside one process and is structurally incapable of detecting this failure mode reliably (only compares in-memory hashes; passes iff both runs land in the same millisecond).
5. **Boot attestation non-reproducibility** (downstream of buildHash): wall-clock events + `performance.now()` timings are hashed into `bootHash` (`kernel-init.ts:62,152-155`), while its verification text claims "same YAML + same compiler + same POST = same boot_hash" (`boot/index.ts:97`).
6. **Stale governance evidence:** baseline manifest pins a build hash to a commit absent from history and hashes of boot artifacts that don't exist in the tree (§4C); `CHANGELOG.md` claims verified determinism; `compiler-drift.test.ts` reads a field (`integrity_hash`, `compiler-drift.test.ts:17`) the current generator deletes (`simulation.ts:134`) and invokes the broken `dist/cli.js`.

---

## 11. What Is Proven

1. Current source → two compiles of identical input → **different build hashes** (`c90c80c6…` vs `75e9082f…`), 19 differing files, all differences traceable to wall-clock fields and their hash cascades (§8, §9).
2. Wall-clock values enter `buildHash` through generated-file SHA256s (§5).
3. IR construction, input hashing (incl. CRLF/BOM/NFC normalization), discovery ordering, key sorting, and 149/168 artifacts are deterministic (§8).
4. Governance (FROZEN-derived specs) explicitly prohibits wall-clock in outputs and requires byte-identical reproducibility (§7).
5. The manifest/certification self-attestations (`R5`, `R9`, `deterministic_proof.identical`) are false for the current source (§4A, §8).
6. Tracked artifacts ≠ current source output; tracked `dist/` cannot execute; four mutually inconsistent build hashes exist in the evidence trail (§4).
7. Runtime `IntegrityValidator` does not check `timestamp`, so the missing-field violation in tracked artifacts is undetected at runtime (§6).
8. `DETERMINISTIC_TIMESTAMP_MECHANISM_NOT_FOUND`.

## 12. What Is Not Proven

1. **Which compiler produced the tracked artifacts** (`4d2ff268…`): git history is a single squashed commit; the timestamp-free artifacts could come from the older generator now compiled into `dist/` *or* from post-hoc stripping + re-hashing. Repository evidence cannot distinguish.
2. The **intended semantics** of `IntegrityBlock.timestamp` / `compiled_at` (wall-clock generation time vs. canonical placeholder): no authoritative definition exists in-repo.
3. Cross-platform reproducibility (Windows vs Linux, locale/TZ): reproduction ran on one host; historical logs show Windows runs produced yet other hashes, but inputs there are unverifiable.
4. Whether the referenced boot artifacts (`6d08848f…`, `1838a1b6…`) ever existed in this workspace.
5. Test-suite status: tests were **not executed** (running them would mutate workspace state via the tamper tests' write-restore cycles and would fail on the broken `dist/` anyway).
6. Whether any consumer outside this repo depends on the literal presence of `timestamp`/`compiled_at` values.

---

## 13. Remediation Options

Listed as decision points only. **This audit recommends none of them as a design choice**; each requires a governance directive because each touches either the frozen determinism contract or the required ABI fields. None are supported or excluded by this report beyond the stated facts.

| # | Option | What it changes | Contract impact (as found) |
|---|--------|-----------------|---------------------------|
| O1 | **Governance-amend a deterministic timestamp** (define a canonical value source for `timestamp`/`compiled_at` — repo currently contains no such mechanism) | Generator value source only | Keeps ABI fields required (§6); satisfies R5/R9 only if the chosen source is input-deterministic; requires an authoritative definition of semantics (§7 gap) |
| O2 | **Exclude wall-clock fields from hash computation** (file hashes / `outputHashes` computed over a canonicalized payload without `timestamp`/`compiled_at`, mirroring how `registries.ts:87-89` already excludes `integrity`) | Hashing boundary only; artifacts keep wall-clock values | Artifacts still leak wall-clock *into outputs* — R5 text ("no wall-clock … leakage into outputs") is not satisfied; `BUILD_MANIFEST.timestamp_policy.generated_at_field: omitted_or_canonical_only` would need explicit interpretation |
| O3 | **Stop emitting the fields and relax the types** (`IntegrityBlock.timestamp` / `compiled_at` optional or removed) | Generators + compiler & runtime type contracts | ABI change; contradicts current required declarations (§6) and the runtime's `IntegrityBlock` shape; matches the tracked artifacts' de-facto state (§4B) |
| O4 | **Accept non-determinism** (keep wall-clock, drop R5/R9 claims) | Manifest claims + governance specs | Directly conflicts with `compiler/BUILD_MANIFEST.yaml`, `SEMANTIC_COMPILER_CONTRACT.yaml`, `PASS_REGISTRY.yaml` as currently written; requires amending the frozen-derived specs |

Independent of the choice, the following defects exist in all branches and will need their own directives: stale/broken `dist/` (§4C); fabricated `deterministic_proof` (`index.ts:435-437`); unsound `cli.ts verify` (`cli.ts:84-94`); `scenarios.registry.json` registry-level hash payload inconsistency (`simulation.ts:139-142`); broken `compiler-drift.test.ts` expectations; baseline manifest referencing a nonexistent commit and missing boot artifacts (§4C); absence of the `BUILD_MANIFEST.verification` two-compile gate in any script.

## 14. Recommended Next Directive

Evidence-first sequencing for the remediation authority (no action taken here):

1. **Adjudicate the contract conflict first** (§7): issue a governance directive fixing the semantics of `IntegrityBlock.timestamp` / `compiled_at` (wall-clock vs. canonical) and selecting exactly one of O1–O4. Every other fix depends on this; none is derivable from repository evidence alone.
2. Until then, treat **all four build hashes as untrusted** and freeze any certification that cites them (baseline manifest, CHANGELOG claims, `compiler-certification.json`).
3. Require the remediation to land with a **mechanical two-compile byte-diff gate** (the check `compiler/BUILD_MANIFEST.yaml:verification` already specifies) run from a clean checkout, and to reconcile `src/` ↔ `dist/` ↔ `generated/` ↔ `registry.manifest.json` ↔ `compiler-manifest.yaml` in a single verifiable step.
4. Re-run the boot attestation only after 1–3, since `bootHash` chains from `buildHash` and embeds its own wall-clock/timing values (`kernel-init.ts:62,152-155`).

---

## Classification

`NON_DETERMINISTIC`

*The current compiler source produces run-dependent build hashes because wall-clock timestamps are serialized into generated artifacts whose SHA256s are constituents of `buildHash`. The committed artifacts, committed `dist/`, committed manifest, and baseline certification are mutually inconsistent with the committed source. No deterministic timestamp mechanism exists in the repository. No remediation was performed during this audit.*
