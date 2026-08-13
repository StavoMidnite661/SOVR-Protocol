<!--
HISTORICAL / REMEDIATION RECORD

This file does not describe the current SOVR architecture.
See docs/ARCHITECTURE.md for the implementation that exists now.
-->

# CONTRACT SEMANTICS INVESTIGATION — SOVR-Protocol

- **Date:** 2026-08-11 (UTC)
- **Mode:** strictly READ-ONLY. No file in this repository was modified, regenerated, or deleted during this investigation. Verified: `git status --porcelain` shows no changes beyond the previously accepted `DETERMINISM_FORENSIC_AUDIT.md`.
- **Predecessor evidence:** `DETERMINISM_FORENSIC_AUDIT.md` (accepted as evidence-only finding). This report investigates semantic contracts only; it selects no remediation option and invents no values.
- **Convention:** every claim carries a citation. Where repository evidence cannot resolve a question, the question is marked **UNRESOLVED**.

---

## A. FIELD SEMANTICS

### A.1 `SimulationScenarioCompiled.compiled_at`

**The only one of the three fields with an explicit semantic description in governance.**

- Authoritative definition: `governance/simulation/SIMULATION_REGISTRY_ABI_v1.yaml:127-130`
  ```yaml
  compiled_at:
    type: string
    required: true
    description: ISO-8601 timestamp of compilation
  ```
- ABI status: `status: FROZEN`, `frozen_at: "2026-08-08T00:35:00-07:00"`, `frozen_by: PHASE10B_PREPARATION_DIRECTIVE` (`SIMULATION_REGISTRY_ABI_v1.yaml:192-195`). Freezing authority: `SOVR-GENESIS-000002-PHASE10B-PREPARATION-DIRECTIVE.md`, TASK 2.
- TS declaration: `packages/compiler/src/generators/simulation.ts:54` (`compiled_at: string`, required).
- Current generator value source: wall-clock — `new Date().toISOString()` (`simulation.ts:120`).
- Semantic content established by evidence: the field denotes **a time of compilation, ISO-8601 formatted**. The description is temporal ("of compilation") but is silent on:
  - whether the value must be the actual wall-clock instant of the compile run,
  - whether a canonical/derived time would satisfy "timestamp of compilation",
  - timezone/resolution requirements beyond ISO-8601.
- Status: **format and temporal referent defined; wall-clock-ness UNRESOLVED.**
- Precedent note: elsewhere in the protocol, a required `timestamp`-typed field is explicitly *not* wall-clock — the event envelope field `timestamp` is defined as "When the event occurred (**domain time, not wall clock**)" (`04_event-catalog.yaml:128-131`). The repository therefore contains at least one governing precedent that required timestamp fields may legitimately carry non-wall-clock time. This is evidence, not a decision.

### A.2 `IntegrityBlock.timestamp` (the 15 authority registries)

- Originating mandate: `SOVR-GENESIS-000002-PHASE10B.1-DIRECTIVE.md`, TASK 2 ("Compiler Artifact Integrity Expansion") prescribes the exact shape every authority artifact must contain:
  ```yaml
  integrity:
    algorithm: SHA256
    hash:
    generated_by:
      compiler_version:
    timestamp:
  ```
  The directive supplies **shape only** — every value slot is empty in the template; no description, no value source, no semantics for `timestamp`.
- TS declarations (all required): compiler `packages/compiler/src/generators/registries.ts:8-13`; runtime `packages/runtime/src/authority/types.ts:7-12`; validator copy `packages/runtime/src/authority/integrity-validator.ts:9-14`.
- Current generator value source: wall-clock (`registries.ts:96`).
- Semantic content established by evidence: **none.** No governance document, ADR, directive, ABI, schema, test, or documentation assigns meaning to this field. The enclosing integrity block's *purpose* is established (tamper detection — directive TASK 2 + `SOVR-GENESIS-000002_PHASE10A.1_INTEGRITY_HASH_CHANGE_MANIFEST.yaml` "fail-closed protection against registry tampering"), but the `timestamp` member plays no role in any validator (§B).
- Status: **semantics UNRESOLVED.**

### A.3 `SimulationRegistry.integrity.timestamp` (and per-scenario `integrity.timestamp`)

- Same provenance as A.2: the Phase 10B.1 TASK 2 shape mandate, applied by the implementation to the simulation registry and each scenario (`simulation.ts:60,72,131,144`).
- Note a scope nuance: TASK 2 lists five named registries ("Required artifacts: commands / events / machines / constitution / capabilities"), yet the implementation attaches integrity blocks to all 15 registries and the simulation registry. Whether the simulation registry was *required* to carry the block or merely does so by extension is not stated. **UNRESOLVED.**
- The FROZEN simulation ABI (`SIMULATION_REGISTRY_ABI_v1.yaml`) defines its own integrity contract — a flat `integrity_hash` per scenario (§A.5) — and is **silent** on the nested `integrity{…,timestamp}` block. Two coexisting integrity schemas govern the same artifact. **UNRESOLVED which is authoritative for the registry-level block.**
- Semantic content established by evidence: **none. UNRESOLVED.**

### A.4 Related field: `integrity_hash` (flat, per-scenario)

Required context because it is entangled with the fields above:

- FROZEN ABI: `SIMULATION_REGISTRY_ABI_v1.yaml:5-10` lists `integrity_hash` among `required_fields`; `:131-133` defines it ("SHA256 hash of canonicalized scenario content (excluding integrity_hash itself)"); validation rule `required_fields_check` (`:157-159`) requires the runtime to verify all required fields are present, reject code `AUTHORITY_REGISTRY_INTEGRITY_FAILURE`.
- Change manifest establishing purpose: `governance/releases/SOVR-GENESIS-000002_PHASE10A.1_INTEGRITY_HASH_CHANGE_MANIFEST.yaml` (2026-08-07): tamper detection for SimulationRunner.
- Current generator **deletes** `integrity_hash` and emits the nested `integrity.hash` instead (`simulation.ts:124-134`); tracked artifacts carry no `integrity_hash`. `compiler-drift.test.ts:17` still reads `scenario.integrity_hash` (gets `undefined`).
- This is a provable divergence between a FROZEN ABI and both generator and artifacts; recorded here because any semantic decision about `compiled_at`/`timestamp` must be made alongside it.

### A.5 Summary table

| Field | Defined in | Required? | Stated semantics | Value semantics resolved? |
|---|---|---|---|---|
| `compiled_at` | FROZEN `SIMULATION_REGISTRY_ABI_v1.yaml:127-130` | yes | "ISO-8601 timestamp of compilation" | format+referent yes; wall-clock-ness **UNRESOLVED** |
| `IntegrityBlock.timestamp` (registries) | PHASE10B.1 directive TASK 2 (shape) + TS types | yes | none anywhere | **UNRESOLVED** |
| `SimulationRegistry.integrity.timestamp` | same shape mandate; ABI silent | yes (types) | none anywhere | **UNRESOLVED** |
| `integrity_hash` (flat) | FROZEN ABI + change manifest | yes (ABI) | sha256 of canonicalized scenario minus itself; tamper detection | defined; **violated in implementation** |

---

## B. CONSUMER DEPENDENCY MAP

Full-repo search (`grep -rn compiled_at / IntegrityBlock / integrity.hash / integrity_hash / generated_by`, all file types, excluding `node_modules`/`.git`):

### B.1 Consumers of `generated/simulation/scenarios.registry.json`

| Consumer | Location | What it reads/checks | `compiled_at` / `timestamp` behavior |
|---|---|---|---|
| SimulationRunner | `packages/runtime/src/simulation/simulation-runner.ts:45-72` | `abi_version` against supported list (:49-52); `integrityValidator.assert` (:55); scenario lookup; command-name existence vs `commands.registry.json` | **never read** |
| IntegrityValidator | `packages/runtime/src/authority/integrity-validator.ts:51-93` | requires `integrity.hash`; recomputes sha256 over content minus `integrity` | **never read**; presence not checked |
| registry-integrity tests | `…/__tests__/registry-integrity.test.ts` | tamper detection via `integrity.hash` | never read |
| schema-validation tests | `…/__tests__/schema-validation.test.ts:18-31` | `abi_version`, `integrity.algorithm`, `integrity.hash`; per-scenario `scenario_id/name/description/actors/commands` | **presence NOT checked** (despite FROZEN ABI `required_fields_check`) |
| registry-version tests | `…/__tests__/registry-version.test.ts` | `abi_version` only | never read |
| compiler-drift tests | `…/__tests__/compiler-drift.test.ts:17` | `scenario.integrity_hash` (flat field) | reads field the generator no longer emits → `undefined` (broken consumer) |

### B.2 Consumers of `generated/registries/*.registry.json`

| Consumer | Location | What it reads/checks | `integrity.timestamp` behavior |
|---|---|---|---|
| JsonRegistryLoader | `packages/runtime/src/authority/authority-loader.ts:32-66` | loads commands/events/envelopes/constitution/capabilities; `validator.assert` on each | **never read** |
| IntegrityValidator | as above | `integrity.hash` only | never read |
| economic-registry tests | `…/__tests__/economic-registry.test.ts:17-20,30-42` | `integrity.algorithm`, `integrity.hash`, `integrity.generated_by.compiler_version` | **presence NOT checked** |
| verify-economic-registries script | `scripts/verify-economic-registries.mjs:20-24` | `integrity.algorithm === 'SHA256'`, `integrity.hash` truthy | never read |
| certify-production script | `scripts/certify-production.mjs:59-88` | registry sha256+entry_count vs `registry.manifest.json`; boot attestation `build_hash` match | indirect only (hashes whole file bytes) |
| Compiler PASS-018 / buildHash | `packages/compiler/src/index.ts:232-262` | whole-file sha256 of every generated artifact → `outputHashes` → `buildParts` → `buildHash` | **indirect byte-level consumer**: timestamp bytes change the hash (proven in forensic audit §8/§9) |
| registry.manifest.json | `index.ts:355-374` | per-file sha256 | indirect, same |

### B.3 Consumers elsewhere

- `example-frontend/`, `sovr-board.html`, `containers/`, `deploy/`, `deployment/`: **no references** to `compiled_at`, registry timestamps, or integrity timestamps (grep: zero hits).
- `docs/`: references to "integrity"/"compiled_at" in audit/compliance docs are descriptive prose; none parse or depend on the fields (checked the 10 doc files matching the terms).
- `packages/compiler/test/compiler-authority.test.ts`: no timestamp/integrity assertions (grep: zero hits).

### B.4 Requirement classification (per investigation question 3)

| Requirement class | Evidence |
|---|---|
| Requires an actual wall-clock timestamp | **No consumer found.** Nothing parses, displays, compares, or validates the value as a moment in time. |
| Requires merely ISO-8601 format | **No consumer found.** No format validation of `timestamp`/`compiled_at` exists anywhere. |
| Requires field presence only | Partial: TS type contracts require presence (compile-time); FROZEN simulation ABI requires presence of `compiled_at` via `required_fields_check` — but **no runtime/test implements that rule**. No presence check exists in code for `IntegrityBlock.timestamp`. |
| Requires chronological ordering | **No consumer found.** No comparison/ordering of these values anywhere. |
| Requires provenance semantics | Only `generated_by.compiler_version` is consumed (`economic-registry.test.ts:20`) — and that subfield is deterministic. The `timestamp` subfield carries no consumed provenance role. |
| No semantic behavior at all | Effectively the current state: the only mechanical effect of these fields is that their bytes alter file hashes → `buildHash` (§B.2), which is a side-effect, not a defined semantic. |

---

## C. GOVERNANCE AUTHORITY CHAIN

Documents governing these fields, ordered by the repository's own stated precedence rules:

1. **`compiler.yaml`** — `meta.status: CONSTITUTIONAL_FREEZE` (`compiler.yaml:17`). Contains no integrity-block or timestamp provisions for generated artifacts (grep: only unrelated Prisma/migration timestamps).
2. **`13_compiler-adr.yaml`** — `meta.status: FROZEN` (`:18`); "Every decision here is binding for Runtime V1. Changes require a governed amendment to this ADR" (`:11-12`). Relevant decisions:
   - **ADR-COMP-005** (caching): explicitly REJECTS "Timestamp-based caching" because "Timestamps are unreliable across systems (git clone, file copy). Content hashing is deterministic." (`:387-390`) — frozen evidence that timestamps are deemed unsuitable for build identity.
   - **ADR-COMP-006** (generated file headers): mandates a header containing `// Generated: {timestamp}` (`:414`) for TypeScript/SQL/OpenAPI/Prisma/config outputs — a frozen mandate for a timestamp *in generated artifact content*, with no statement whether `{timestamp}` must be wall-clock or canonical.
   - **ADR-COMP-007** (versioning): `generated/version-matrix.json` schema includes `compilation_timestamp: string` (`:537`) — another frozen timestamp-bearing artifact field. (No such file exists in `generated/` today.)
   - **ADR-COMP-011** (build integrity): compiler-manifest schema includes `build.timestamp: string` and `duration_ms` (`:882-883`), while the same decision guarantees "recompilation produces byte-identical CANONICAL_PIR and byte-identical generated artifacts" (`:897-900`) — note the guarantee is scoped to PIR+artifacts, not the manifest. The ADR never reconciles `build.timestamp` with byte-identical reproducibility. **Intra-frozen tension, UNRESOLVED.**
3. **`SIMULATION_REGISTRY_ABI_v1.yaml`** — `status: FROZEN` (`:192`), frozen by the Phase 10B preparation directive. Defines `compiled_at` semantics (§A.1) and `integrity_hash` requirement (§A.4). Authority for the simulation artifact domain.
4. **Phase directives** (governance mandates): `SOVR-GENESIS-000002-PHASE10B-PREPARATION-DIRECTIVE.md` (TASK 2 froze the ABI shape), `SOVR-GENESIS-000002-PHASE10B.1-DIRECTIVE.md` (TASK 2 mandated the integrity block incl. `timestamp`; TASK 7 mandated ABI enforcement tests).
5. **`compiler/SEMANTIC_COMPILER_CONTRACT.yaml`** — `status: GOVERNANCE_DRAFT` (`:21`), **not frozen**. Self-declares authority as "compiler.yaml (FROZEN) + 13_compiler-adr.yaml (FROZEN)… on divergence, the frozen specs prevail" (`:13-15`). Contains `determinism.guarantees: no_wall_clock_or_random_in_generation` (`:168`).
6. **`compiler/BUILD_MANIFEST.yaml`** — `Status: ARCHITECTURE_ONLY` (header), authority: "compiler.yaml, SEMANTIC_COMPILER_CONTRACT.yaml … On divergence, frozen specs prevail" (`:12-14`). Contains `timestamp_policy.wall_clock_in_manifest: PROHIBITED`, `generated_at_field: omitted_or_canonical_only` (`:85-86`) and R4/R5/R9 (`:95-105`).
7. **`compiler/PASS_REGISTRY.yaml`** — PASS-019 declared `deterministic: true` (`:289`).
8. **README.md** — documentation only (claims R1–R10, boot attestation semantics); notably its R5 table row reads "No environment leakage — no process.env, no hostname, no username" (`README.md:825`), **omitting the wall-clock half** of BUILD_MANIFEST's R5 — documentation drift, not authority.

**Question 5 answer — does any frozen governance artifact explicitly resolve the conflict (required timestamp fields vs R5/R9/timestamp_policy)?**

**No.** Evidence:
- The frozen layer itself is internally in tension: ADR-COMP-006/007/011 mandate timestamp-bearing fields in headers/artifacts/manifest, while ADR-COMP-005 rejects timestamps for identity and ADR-COMP-011 guarantees byte-identical artifacts. No rule inside the frozen layer reconciles these.
- The documents that prohibit wall-clock (`BUILD_MANIFEST.yaml`, `SEMANTIC_COMPILER_CONTRACT.yaml`) are **not frozen** and both explicitly defer to frozen specs on divergence — yet the frozen specs never exercise that precedence on this question.
- The FROZEN simulation ABI requires `compiled_at` (temporal description) and says nothing about determinism; no amendment, finding, or certificate addresses the interaction (`grep` for the conflict terms across `governance/`, `certification/`, `snapshots/`: no resolving text found).
- `generated_at_field: omitted_or_canonical_only` (`BUILD_MANIFEST.yaml:86`) is the closest textual hook — it contemplates "canonical" values for generated-at fields — but it governs the *manifest*, is ARCHITECTURE_ONLY status, defines no canonical source, and has never been applied to integrity blocks. **UNRESOLVED.**

**Highest-authority source for field semantics:** for `compiled_at` — the FROZEN `SIMULATION_REGISTRY_ABI_v1.yaml` (only explicit definition). For `IntegrityBlock.timestamp` — no semantic source exists at any authority level; the highest-authority statement touching it is the PHASE10B.1 directive's shape mandate. **UNRESOLVED.**

---

## D. DETERMINISTIC VALUE SOURCES FOUND

Repository-defined deterministic values that exist and are well-defined (existence reported per investigation question 6; **no suitability claim is made** — see §7 constraint and §E):

| # | Value source | Location | Its defined semantics |
|---|---|---|---|
| D1 | Simulation canonical base time `2026-08-07T00:00:00.000Z`; `deterministicTimestamp() = baseTime + offset + counter·1000` | `packages/runtime/src/simulation/deterministic.ts:8,15,37-42` | **Simulation execution clock** — seeded, controllable time for simulated events; wired as `timestampGenerator` in `deterministic-event-store.ts:14`. Runtime concept, scoped to simulation runs. |
| D2 | ABI freeze instant `frozen_at: "2026-08-08T00:35:00-07:00"` | `governance/simulation/SIMULATION_REGISTRY_ABI_v1.yaml:193` | The moment the simulation ABI was frozen. Governance time constant. |
| D3 | Protocol/constitution freeze state: `status: FROZEN` v1.0.0; constitution `lock_hash` (content hash) | `00_protocol-manifest.yaml:15-16,26`; PASS-001 verification `packages/compiler/src/index.ts:120-140` | Protocol identity. `lock_hash` is a content hash, not a time. |
| D4 | Amendment ratification date `AMD-0013 … ratified: 2026-08-05` | `governance/audit/PHASE9A_IMMUTABILITY_CHECK.yaml:21-25` | Governance event date, recorded once, immutable. |
| D5 | Certification `generated_at` constants (e.g. `2026-07-17T23:17:00-07:00`, `2026-07-25T03:11:13-07:00`) | `certification/*.yaml`, `certification/DEPENDENCY_TREE.json:2`, `certification/FILE_HASH_MANIFEST.json:2` | Wall-clock instants captured once into immutable governance artifacts; semantics = "when this certificate was produced". |
| D6 | Deterministic identity derivation `SHA256(canonical name) → id` | `governance/tigerbeetle/DETERMINISTIC_ID_VERIFICATION_REPORT.json:4-8` | Precedent that the repository derives deterministic identity from content hashes — for **IDs**, not times. |
| D7 | Unfilled timestamp placeholders `<ISO8601 timestamp>` in committed certificates | `governance/tigerbeetle/PHASE10E.3_COMPLETION_CERTIFICATE.yaml:6` (and 4 more) | Precedent that governance artifacts tolerate placeholder timestamps rather than invented values. |

## E. DETERMINISTIC VALUE SOURCES NOT FOUND

- **No** `SOURCE_DATE_EPOCH` or build-time injection convention anywhere (grep across repo).
- **No** canonical "protocol time", "genesis time", "release time", or "lock time" defined as a *compilation-time* source. (TigerBeetle genesis artifacts carry wall-clock `generated_at` values — `governance/tigerbeetle/GENESIS_WRITE_MANIFEST.yaml:4` — i.e., genesis is documented with wall-clock instants, not a reusable canonical clock.)
- **No** governance text mapping D1–D7 (or any other constant) to `compiled_at`, `IntegrityBlock.timestamp`, or `SimulationRegistry.integrity.timestamp`.
- **No** amendment (`11_governance-amendments.yaml`, `snapshots/v1.0.1-canonical/governance/amendments/INDEX.yaml`) addressing deterministic compilation timestamps.
- **No** deterministic timestamp mechanism on the compiler side at all (the D1 mechanism is runtime-simulation-scoped).

Conclusion per question 6/7: **no repository value is established by evidence to have the correct semantics for these fields.** Consistent with the forensic audit: `DETERMINISTIC_TIMESTAMP_MECHANISM_NOT_FOUND` (for the compiler). Nothing is proposed here.

---

## F. CERTIFICATION-PROOF ANALYSIS

**Question:** exactly why can the current mechanism self-certify determinism without an independent two-compile comparison?

Findings (all in `packages/compiler/src/`):

1. **The "proof" is a single hash duplicated, computed by the artifact producer about its own single run.** `writeCompilerCertification` (`index.ts:376-405`) builds one payload — `{build_hash, input_hashes, ir_hash, registry_hashes}` — from the current run, computes `runHash = sha256(payload)` once (`index.ts:398-399`), then emits:
   ```
   deterministic_proof: { run_1_hash: runHash, run_2_hash: runHash, identical: true }
   ```
   (`index.ts:435-437`). `run_1_hash === run_2_hash` is true by construction (reflexivity), and `identical: true` is a hardcoded literal. No second compilation, second process, or second machine is involved. The claim is structurally unfalsifiable — it can never fail regardless of actual determinism. Proven empirically: forensic-audit runs A and B each emitted `identical: true` while their build hashes differed.
2. **The manifest's reproducibility flags are literals, not measurements.** `reproducibility: { R1…R10: true }` is hardcoded (`index.ts:293-303`); no pass inspects generators for wall-clock/randomness before setting them. BUILD_MANIFEST's `verification.on_difference: FAIL_BUILD` (`BUILD_MANIFEST.yaml:110-113`) has no implementation.
3. **`sovr verify` (`cli.ts:84-94`) is not an independent oracle.** It executes `CompilerRuntime.execute()` twice **inside one process** and compares in-memory `buildHash` values. Defects: (a) same process/state for both "runs"; (b) no artifacts written or byte-compared (BUILD_MANIFEST's method is "build twice… diff manifests… zero differences"); (c) wall-clock timestamps have millisecond resolution, so two executes landing in the same millisecond would compare equal even with the wall-clock bug; (d) it does not compare against the on-disk manifest, so it cannot detect source/artifact drift; (e) **no certification path invokes it** — none of `package.json`'s `certify:*` scripts run `verify`.
4. **The specified determinism gate was never built.** Phase 10B preparation TASK 9 mandates `npm run certify:determinism` in the certification pipeline (`SOVR-GENESIS-000002-PHASE10B-PREPARATION-DIRECTIVE.md`, TASK 9). No such script exists in any `package.json` (verified: grep exit 1). The two-compile verification method defined by `BUILD_MANIFEST.yaml:110-113` is implemented by no script and no CI job (`.github/workflows/ci.yml` runs lint/typecheck/`test:genesis`/build/docker only; `ci-production.yml` has no compile-diff step).
5. **Downstream certifiers assume, never re-derive.** `scripts/certify-production.mjs:59-88` checks that registry hashes match the existing manifest and that boot attestation `build_hash` matches the manifest `build_hash` — internal consistency checks of possibly-non-reproducible inputs; `scripts/build-package-integrity.mjs` hashes the packaged bundle once. Neither recompiles. The remediation baseline likewise pinned hashes without a two-compile gate.

**Exact cause:** the certification artifact is produced by the same code path whose determinism it attests, from data of a single execution, with the equality assertion hardcoded; every available verification surface (`verify` command, CI, certify scripts) either does not perform an independent two-compile comparison or does not exist. Self-certification is therefore not a misconfiguration but the mechanism's design.

---

## G. BOOT IDENTITY ANALYSIS

**Question:** are boot-time wall-clock/timing data intended to represent reproducible identity, execution provenance, attestation evidence, or a combination?

1. **Spec intent (PROPOSED, not frozen):** `protocol/BOOT_SEQUENCE.yaml` — `meta.status: PROPOSED` (`:21`), declares `principle: SAME_YAML_SAME_COMPILER_SAME_BOOT_HASH_SAME_EVENT_LOG_CANNOT_BE_FUDGED` and `reproducibility: R1_to_R10_plus_boot_determinism` (`:28-29`). The boot splash encodes the chain claim: "Chain: BUILD_HASH → BOOT_HASH [{integrity_status}]" (`:196`). Framing: **reproducible identity derived from build identity.**
2. **README intent:** `boot_hash = sha256(build_hash + boot_log_hash + boot_timings_hash + final_health)` (`README.md:933-938`); "The boot hash chain proves the kernel booted from the exact frozen YAML specification" (`README.md:949`). Framing: **provenance-of-origin claim resting on reproducibility.**
3. **Implementation reality:** `kernel-init.ts:62` stamps boot events with `new Date().toISOString()`; every stage duration is `performance.now()` (`kernel-init.ts:51-150`); `bootTimingsHash = sha256("level:durationMs…")` and `bootHash = sha256(buildHash|bootLogHash|bootTimingsHash|HEALTHY)` (`kernel-init.ts:152-155`). The timing/event components are execution-time measurements that differ on every run and machine. The attestation nonetheless asserts `verification.method: "same YAML + same compiler + same POST = same boot_attestation"` and `unfakeable: true` (`kernel-init.ts:202-205`).
4. **Determination from evidence:**
   - The *spec and documentation* intend boot_hash as **reproducible identity / provenance of origin** (same inputs ⇒ same boot_hash).
   - The *construction* makes boot_hash a digest of **execution evidence** (per-run timings + wall-clock events) chained to build identity. These two intents are mutually exclusive as implemented: a hash containing run durations cannot be a reproducible identity.
   - Whether timing/wall-clock data is *supposed* to be attestation evidence (i.e., legitimately run-specific) is **UNRESOLVED**: no governance document defines a boot attestation policy permitting or forbidding run-specific data, and the only boot spec is PROPOSED — it never attained the frozen authority needed to settle the question. The remediation baseline's boot hashes (`boot_hash: 4009e256…`, boot artifact hashes) reference boot artifacts absent from the tree, so no historical boot evidence can adjudicate either.
   - Classification for the report: **combination claimed (identity+provenance), reproducible-identity semantics asserted by spec/docs, execution-evidence semantics delivered by implementation; intended mixture UNRESOLVED.**
5. Dependency note: boot_hash chains from `build_hash`; since `build_hash` is itself currently run-dependent (forensic audit), the boot chain inherits that non-determinism even before its own timing/wall-clock inputs are considered.

---

## H. UNRESOLVED CONTRACT QUESTIONS

1. **H1.** Does "ISO-8601 timestamp of compilation" (FROZEN ABI, `compiled_at`) require the actual wall-clock instant, or is any ISO-8601 value that denotes the compilation acceptable? No repository text answers.
2. **H2.** What does `IntegrityBlock.timestamp` mean (generation instant? freeze instant? canonical constant? provenance marker?)? No definition exists at any authority level.
3. **H3.** Which integrity schema governs `scenarios.registry.json` — the FROZEN ABI's flat `integrity_hash` or the directive-mandated nested `integrity{…,timestamp}`? Both currently coexist in types/generators; the ABI is silent on the nested block.
4. **H4.** Does ADR-COMP-006's `// Generated: {timestamp}` header (frozen) require wall-clock, and how does it coexist with ADR-COMP-011's byte-identical-artifacts guarantee? (Headers are not implemented today; the question is latent.)
5. **H5.** Does ADR-COMP-011's `build.timestamp` (frozen manifest schema) prevail over BUILD_MANIFEST's `wall_clock_in_manifest: PROHIBITED` under the stated divergence rule, or is the manifest schema superseded? No document says.
6. **H6.** Is the Phase 10B.1 TASK 2 integrity-block mandate (directive, non-YAML governance) of equal, lower, or higher authority than the FROZEN simulation ABI where they touch the same artifact?
7. **H7.** Is run-specific timing/wall-clock data a legitimate component of boot attestation (attestation evidence), or must boot_hash be reproducible per BOOT_SEQUENCE.yaml's PROPOSED principle?
8. **H8.** Must the runtime implement the FROZEN ABI's `required_fields_check` (rejecting artifacts missing `compiled_at`/`integrity_hash`), given TASK 2's "The runtime must reject registry files that violate this schema"? It currently does not.
9. **H9.** Were the tracked `generated/` artifacts produced by an older generator or manually stripped? (From forensic audit §12; bears on what the de-facto baseline contract is.)
10. **H10.** Does `timestamp_policy.generated_at_field: omitted_or_canonical_only` extend beyond the manifest to integrity blocks, and what would "canonical" mean if so? The policy defines no canonical source.

## I. REMEDIATION DECISIONS THAT REQUIRE GOVERNANCE

Each item below is undecidable from existing repository evidence and must be resolved by a governance directive before implementation work:

1. **I1 — Semantic adjudication of `compiled_at` / `IntegrityBlock.timestamp` / `SimulationRegistry.integrity.timestamp`:** wall-clock-required vs ISO-8601-any vs canonical-value vs field-redefinition. (Answers H1, H2.)
2. **I2 — Conflict resolution between frozen timestamp mandates (ADR-COMP-006/007/011) and non-frozen prohibitions (BUILD_MANIFEST R5/R9/timestamp_policy), including whether `build.timestamp` belongs in the manifest.** (Answers H4, H5.)
3. **I3 — Selection among remediation options O1–O4 from the forensic audit**, since each touches either the frozen ABI or the determinism contract.
4. **I4 — Reconciliation of the two integrity schemas** for the simulation registry (flat `integrity_hash` per FROZEN ABI vs nested `integrity{…,timestamp}` per directive), including which hash the runtime must enforce. (Answers H3, H6.)
5. **I5 — Designation of a canonical value source** if I1 chooses canonical semantics: no such source with correct semantics exists (§E); one must be created and ratified, including its semantic justification. This investigation declines to nominate one.
6. **I6 — Boot attestation policy:** whether timing/wall-clock data may appear in attestation evidence and what "same boot_hash" must mean. (Answers H7.)
7. **I7 — Enforcement obligations:** whether the runtime must implement `required_fields_check` per the FROZEN ABI (which would reject today's tracked artifacts and possibly today's generator output depending on I1/I4). (Answers H8.)

## J. REMEDIATION DECISIONS THAT ARE ALREADY PROVABLE FROM EXISTING CONTRACT

These require no new governance; they are mechanical consequences of contracts already on the record:

1. **J1 — The `deterministic_proof` in `compiler-certification.json` cannot be emitted truthfully by the current mechanism.** §F proves the assertion is self-referential. The only contract-faithful alternatives are to implement the verification defined by `BUILD_MANIFEST.yaml:110-113` (two compiles, byte-diff, FAIL_BUILD on difference) or to stop emitting the claim. Which of those two is chosen is governance (§I3), but the provable fact — that the present artifact contains a fabricated proof — needs no decision.
2. **J2 — The verification method is already specified.** "Build twice from the same commit; diff manifests; expected: zero differences; on_difference: FAIL_BUILD with CERT diagnostic" (`BUILD_MANIFEST.yaml:110-113`). Implementing that gate involves no semantic choice.
3. **J3 — The generator's deletion of `integrity_hash` is a provable divergence from the FROZEN simulation ABI** (`SIMULATION_REGISTRY_ABI_v1.yaml:5-10` requires it; `simulation.ts:134` deletes it; `compiler-drift.test.ts:17` still reads it). Establishing the divergence requires no governance; *resolving* it (restore field vs amend ABI) is governance (I4).
4. **J4 — Tracked artifacts violate the declared type contracts** (`IntegrityBlock.timestamp`, `compiled_at` required; fields absent on disk) while passing runtime validation because no validator checks presence. This is established fact (forensic audit §6); whether to bring artifacts or contracts to the other is governance (I1/I7).
5. **J5 — `generated_by.compiler_version` is the only integrity subfield with a live consumer and it is deterministic** (`economic-registry.test.ts:20`; value `0.6.0` pinned by `VERSION_AUTHORITY.yaml`). Provenance via compiler version already works without wall-clock; no decision needed to preserve it.
6. **J6 — Any future compilation gate must rebuild `dist/` from `src/` before use**, because the committed `dist/` is provably unrunnable (`dist/index.js:28` imports the nonexistent `dist/generators/simulation.js`) and behaviorally divergent from `src/` (forensic audit §4C). This is a precondition for any truthful certification, derivable from evidence alone.
7. **J7 — The scenario-level integrity hash payload rule is already deterministic and consistent with the FROZEN ABI's spirit** (exclude provenance metadata from the hashed payload: `simulation.ts:124-128`, `registries.ts:87-89`; per-scenario hashes proven stable across runs in forensic audit §8). Where a contract requires hashing "content excluding provenance fields", the mechanism exists; only the registry-level simulation payload (`simulation.ts:139-142`) deviates from that pattern — an internal inconsistency, correctable without semantic decisions once I3/I4 are fixed.

---

*This investigation established the semantic contract surface and its gaps. It modified nothing. All questions in §H remain open until governance answers them; §J lists the only conclusions already forced by existing evidence and contract text.*
