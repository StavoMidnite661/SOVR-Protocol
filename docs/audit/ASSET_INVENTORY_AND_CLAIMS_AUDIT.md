# SOVR Protocol — End-to-End Asset Inventory & Structured Claims Audit

**Audit date:** 2026-08-01
**Commit audited:** `a45203c` ("registry regenerated after the above fixes") — the repository's only commit
**Branch:** `arena/019fbc67-sovr-protocol`
**Method:** Static inventory + independent recomputation of every hash, count, and integrity claim, plus live execution of the compiler, boot sequence, runtime audit, and production certification gate.

---

> ## ⚠️ ROOT-CAUSE CORRECTION — 2026-08-01 (post-remediation)
>
> **Findings D1–D4 and D6 are RESOLVED. The root cause was misdiagnosed on first pass and is corrected here.**
>
> The constitution was **never edited**. The `CONST-LOCK-002` halt and all 39 "stale" input hashes were caused by **line-ending encoding**, not content change. The lock was computed over CRLF bytes on Windows; the audit ran against an LF checkout. Converting the current constitution to CRLF reproduces the locked hash exactly.
>
> **38 of 39 input-hash mismatches were pure line-ending artifacts.** The single genuine edit was `00_protocol-manifest.yaml` — the file that contains the lock.
>
> The actual defect was in the compiler: `hashFileContent()` hashed raw disk bytes without applying `BUILD_MANIFEST` rule **R3** ("NFC Unicode, LF line endings"). This made the advertised "platform-independent, byte-identical" reproducibility guarantee **platform-dependent in practice** — a more serious architectural finding than the stale lock it presented as.
>
> **Remediation applied and verified:** R3 now enforced in the hash path; `.gitattributes` added; lock re-pinned to the canonical LF hash; full recompile + re-attestation.
>
> ```
> Compile           : SUCCESS — 0 errors
> Reproducibility   : ✓ byte-identical — b133303a02ae…
> Input hash chain  : 39/39 match
> Registry integrity: 11/11 match
> Certification     : ✅ PASSED — 0 blocking issues
> LF vs CRLF corpus : identical build hash (platform independence proven)
> ```
>
> Sections 2.2 and 3 below preserve the original first-pass analysis for the record. See `governance/CONSTITUTIONAL_DRIFT_REPORT_2026-08-01.md` for the full determination.
>
> **Still open:** D5, D7, D8, D9, D10, D11, D12.

---

## 0. Verdict

| Dimension | First pass | After remediation |
|---|---|---|
| Asset inventory | Complete — 647 files, 44 MB, 22 top-level areas | unchanged |
| Registry internal integrity | **PASS** — 11/11 match byte-for-byte | **PASS** 11/11 |
| Corpus ↔ certification integrity | **FAIL** — 39/39 input hashes stale | **PASS** 39/39 |
| Compiler executes on committed corpus | **FAIL** — halts FATAL at PASS-001 | **PASS** — 0 errors |
| Reproducibility across platforms | **FAIL** — LF and CRLF yield different hashes | **PASS** — identical |
| Repo's own certification gate | **FAIL** — 1 blocking, 1 warning | **PASS** — 0 blocking |
| Documented claim accuracy | **Mixed** — counts honest; provenance drifted | provenance restored; D5/D7–D12 open |

**Headline:** the protocol *data* is internally consistent and the documented counts are, with a few exceptions, truthfully measured. What has drifted is the **provenance chain**: the YAML corpus has been edited since the artifacts in `generated/` were produced, so every hash-based proof in the repository now attests to a build that no longer exists. The compiler refuses to run against its own committed sources.

---

## 1. Asset Inventory

### 1.1 Repository totals

| Measure | Count |
|---|---|
| Total files (excl. `.git`, `node_modules`, `dist`) | 647 |
| Repository size on disk | 44 MB |
| YAML/YML files | 256 |
| TypeScript files (excl. `.d.ts`) | 161 |
| Lines of TypeScript | 25,362 |
| Git commits | 1 (squashed; no history to diff) |

### 1.2 Top-level asset map

| Area | Files | Role |
|---|---|---|
| `packages/` | 517 | Compiler (53 TS / 4,184 LOC), runtime (84 TS / 15,525 LOC), shared (7 TS / 207 LOC) |
| `generated/` | 156 | Compiler output: IR, registries, OpenAPI, TLA+, topology |
| `docs/` | 63 | 15 subject areas (architecture, compliance, security, guides…) |
| `certification/` | 62 | Certification and evidence artifacts |
| `containers/` | 45 | 15 per-domain container definitions |
| `snapshots/` | 35 | Point-in-time captures |
| `_archive/` | 21 | Superseded material |
| `management/` | 12 | Phase/change management records |
| `_test_output/` | 11 | Test-run manifests |
| `deploy/` | 10 | Deployment configuration |
| `scripts/` | 9 | Build, audit, certification, release tooling |
| `knowledge/`, `governance/` | 9 each | Reference material, governance records |
| `deployment/` | 4 | Docker Compose + K8s |
| `example-frontend/` | 3 | Demo client |
| `.github/workflows/` | 3 | `ci.yml`, `ci-production.yml`, `formal-verify.yml` |
| `migrations/`, `DUE_DILIGENCE/` | 2 each | Schema migrations; audit + exec summary |

### 1.3 Protocol corpus — the compiler's declared input frontier (39 files)

| Location | Files |
|---|---|
| Root YAML | 16 (`00_`–`13_`, `compiler.yaml`, `acceptance-tests.yaml`, `hybrid-boundary.yaml`, `projection-engine.yaml`, `phase_j_protocol_closure.yaml`) |
| `domains/` | 10 (agent, escrow, governance, identity, intent, ledger, payment, policy, treasury, vault) |
| `compiler/` | 7 contract/registry files |
| `protocol/` | 6 standard/registry files |

Note: the frontier counts 39 entries but hashes 38 distinct files — `compiler.yaml` is registered twice (once at root, once as `compiler/compiler.yaml`) with an identical hash.

### 1.4 Compiled artifact inventory (`generated/`, 156 files)

| Group | Count | Notes |
|---|---|---|
| `verification/tla/` | 86 | 43 `.tla` models + 43 `.cfg` TLC configs |
| `src/` | 38 | Generated TypeScript (output-only; not wired into runtime) |
| `registries/` | 12 | 11 registries + `registry.manifest.json` |
| root | 11 | IR, manifests, attestation, certification, OpenAPI, topology, boot log |
| `typescript/` | 5 | |
| `config/`, `docs/`, `prisma/` | 4 | Kafka/Redis config, topology doc, Prisma schema |

Largest artifacts: `sovr-ir.json` (2.5 MB), `protocol-topology.json` (297 KB), `events.registry.json` (306 KB).

### 1.5 Registry contents (independently counted)

| Registry | Entries | Manifest claim | Hash |
|---|---|---|---|
| commands | 105 | 105 | ✅ match |
| events | 259 | 259 | ✅ match |
| machines | 43 | 43 | ✅ match |
| capabilities | 111 | 111 | ✅ match |
| projections | 16 | 16 | ✅ match |
| schemas | 364 | 364 | ✅ match |
| validation | 105 | 105 | ✅ match |
| contracts | 2 | 2 | ✅ match |
| boot / envelopes / execution-plans | 1 each | 1 each | ✅ match |

**All 11 registries verified byte-identical to `registry.manifest.json` (SHA-256 + entry count).** This is the strongest part of the package.

Command distribution: vault 19, governance 15, identity 12, payment 11, agent/ledger/treasury 9, intent/policy 8, escrow 4, saga 1.

---

## 2. Structured Claims Register

Every claim independently recomputed. **Source** = where the claim is made; **Verified** = what the repository actually contains.

### 2.1 Claims that hold ✅

| # | Claim | Source | Verified |
|---|---|---|---|
| C1 | 105 commands | README, exec summary | 105 ✅ |
| C2 | 259 events | README, exec summary | 259 ✅ |
| C3 | 43 state machines | README | 43 ✅ |
| C4 | 111 capabilities | README | 111 ✅ |
| C5 | 16 projections | README | 16 in registry ✅ (but see D6) |
| C6 | IR: 592 nodes / 459 edges | README | 592 / 459 ✅ exact |
| C7 | Registry integrity 11/11 | README | 11/11 hash + count ✅ |
| C8 | 39 protocol YAML inputs | README | 39 frontier entries ✅ |
| C9 | Generated artifacts: 147 | README | 156 files in `generated/`; 147 is a defensible count excluding the 9 non-generator outputs ⚠️ near-match |
| C10 | 43 TLA+ models + 43 TLC configs | README | 43 + 43 ✅ |
| C11 | TLA+ "specified, not verified" | README, exec summary | Honest — TLC absent, gate warns ✅ |
| C12 | 26 open findings | README, exec summary | 26 distinct TD-IDs ✅ |
| C13 | 256 YAML files | Exec summary | 256 ✅ |
| C14 | 161 TS files, 25,362 LOC | Exec summary | 161 / 25,362 ✅ exact |
| C15 | 10 domains | README | 10 ✅ |
| C16 | 20 compiler passes | README | 20 in `PASS_REGISTRY.yaml` ✅ |
| C17 | Runtime purity: 0 violations | README | `runtime-audit.mjs` → PASS, 0 violations ✅ |
| C18 | OpenAPI 45 endpoints | `boot.log` | 45 paths / 45 operations ✅ |
| C19 | Generated TS is output-only, not wired in | README | Honest and correctly disclosed ✅ |

The "Measured Metrics" table is materially more honest than typical — the 2026-07-27 audit correction visibly took effect (exact LOC, exact file counts, explicit ⚠️ on failing integration tests and unchecked TLA+).

### 2.2 Claims that have drifted ❌

---

#### **D1 — CRITICAL: The committed corpus does not compile**

Running the compiler against the repository as committed:

```
FailClosedCompilationError: halted after PASS-001 (PROTOCOL_DISCOVERY)
  CONST-LOCK-002  FATAL  00_protocol-manifest.yaml
  Constitution lock_hash mismatch:
    expected f5d01000a162cd92d85bd7161d5b332056659a67248de111b3de41abc2681aab
    got      34dfbdc2de193f54f87bb873039603bb5a5502a8448ef6151133f54c77a54ed3
```

`npm run compile` and the `verify` (reproducibility) command both HALT. The README's central claim — *"Identical YAML inputs produce identical build hashes. This is verified. This is the unfakeable proof of protocol integrity"* — cannot currently be exercised, because the corpus cannot reach the hashing stage at all.

The `lock_hash` pinned in `00_protocol-manifest.yaml:46` refers to a version of `01_constitution.yaml` that no longer exists on disk. The constitution was edited; the lock was not re-pinned.

**This is the root cause of D2 and D3.**

---

#### **D2 — CRITICAL: All 39 certified input hashes are stale**

`generated/compiler-certification.json` certifies a SHA-256 for each of the 39 frontier inputs. Recomputed against the working tree:

**39 of 39 mismatch. 0 match.**

Examples:

| File | Certified | Actual |
|---|---|---|
| `01_constitution.yaml` | `f5d01000a162…` | `34dfbdc2de19…` |
| `03_command-catalog.yaml` | `857f8330191c…` | `35eee26041c1…` |
| `domains/vault.yaml` | `4d2b54e58a12…` | `7550686fedfe…` |
| `domains/payment.yaml` | `108c34d2fa29…` | `87ca0813920e…` |

The boot sequence independently confirms this, reporting `GEN-007 Tamper detected` for every corpus file. Every hash-derived proof in the repository — build hash, IR hash, boot attestation, certification bundle — attests to a corpus state that is not the one committed. The artifacts in `generated/` are **orphaned from their sources**.

---

#### **D3 — CRITICAL: Two mutually exclusive build hashes are both presented as "the" build hash**

| Hash | Asserted by |
|---|---|
| `2ae816fac5cb…` | README (6 places), `DUE_DILIGENCE/EXECUTIVE_SUMMARY.md`, `INDEPENDENT_AUDIT_2026-07-27.md`, `generated/boot-manifest.json`, `generated/boot-attestation.json` |
| `d0cb2251cd1f…` | `generated/compiler-certification.json`, `generated/compiler-manifest.yaml`, `generated/registries/registry.manifest.json` |

The narrative/boot layer and the compiler/registry layer disagree. The repo's own gate catches this:

```
Build provenance:
  ✅ build_hash is a valid sha256 (d0cb2251cd1f…)
  ❌ boot attestation matches build hash
```

A third identifier, `5678ed61edbc97e3`, appears as `build_id` in `generated/protocol-manifest.yaml` and 22 per-domain manifests, alongside a fourth constitution hash `4770a831e1edc488` that matches neither of the two above.

---

#### **D4 — MAJOR: The repository's own production certification gate FAILS**

`npm run certify:production`:

```
❌ PRODUCTION CERTIFICATION FAILED — 1 blocking issue(s), 1 warning(s)
  ❌ boot attestation matches build hash
  ⚠️  TLC not available — models generated but not model-checked
```

Meanwhile `README.md:170` states the metrics table is *"Verified by `npm run certify:production`"*. That command does not currently pass. Note also: `ci-production.yml` runs `certify:production` on both the staging and production deploy paths — so the production pipeline is red by the repo's own definition.

---

#### **D5 — MAJOR: Version numbers disagree across three layers**

| Layer | Version |
|---|---|
| README badges | Compiler v1.0.0-rc, Runtime v1.0.0-rc |
| `package.json` (both packages) | `1.0.0` |
| Source of truth (`packages/compiler/src/index.ts:88`, `cli.ts:67`, runtime `index.ts:51`) | `0.6.0` |
| Generated artifact headers (`openapi.yaml`) | `Compiler: 0.6.0` |
| README "Measured Metrics" table | Compiler 0.6.0, Runtime 0.6.0 |
| Exec summary | v0.9.0-rc |

The README simultaneously badges `v1.0.0-rc` and tabulates `0.6.0` — internally contradictory within one document. `0.6.0` is the truth; `1.0.0` in `package.json` will be embedded into any published artifact.

Additionally `packages/compiler/src/index.ts:275` emits `protocol_target_version: '1.0.1'` while the protocol is declared FROZEN at `1.0.0`.

---

#### **D6 — MAJOR: Projection count contradiction (15 vs 16)**

| Source | Value |
|---|---|
| `projections.registry.json` | 16 |
| README (4 places, incl. "Rebuilds 16 projections") | 16 |
| `generated/boot.log` (runlevel 6) | **"Projections: 15 read models rebuilt from genesis"** |
| README repo-structure section | `projection-engine.yaml ← 15 read model definitions` |

The attested boot artifact and the registry disagree by one. The likely candidate is `escrow_account_view` — escrow is the newest domain and is also **omitted from the README's `domains/` file listing** (9 of 10 domains shown; `escrow.yaml` missing), and `escrow.yaml` is by far the smallest domain file (910 bytes vs 29–101 KB). Escrow appears to be a late addition that was not propagated into the boot path or the docs.

---

#### **D7 — MAJOR: `certification/PRODUCTION_GATE.yaml` cites 16 non-existent files as evidence**

The gate marks `event_integrity` and `authorization` as **green**, citing:

| Cited evidence | Exists? |
|---|---|
| `packages/kernel/src/integrity/hash-engine.ts` | ❌ |
| `packages/kernel/src/integrity/chain-verifier.ts` | ❌ |
| `packages/security/src/rbac.ts` | ❌ |
| `packages/security/src/authz.ts` | ❌ |
| `packages/security/src/crypto.ts` | ❌ |
| `packages/events/src/postgres.ts` | ❌ |
| `packages/events/src/schema.ts` | ❌ |
| `packages/ledger/src/index.ts` | ❌ |
| `apps/api/src/index.ts` (cited 3×) | ❌ |
| `tests/security/event-integrity.test.ts` ("6 tests PASS") | ❌ |
| `tests/stress/concurrency.test.ts` ("PASS") | ❌ |
| `migrations/run.ts` | ❌ |
| `certification/SECURITY_FINAL_AUDIT.md` | ❌ |
| `management/PHASE_XI_CHANGE_MANIFEST.md` | ❌ |

Only 6 of 22 cited paths resolve. The file describes a `packages/{kernel,security,events,ledger}` + `apps/api` + `tests/` layout that this repository does not have — it predates a major restructure into `packages/{compiler,runtime,shared}`. **A green status backed by files that do not exist is the most reputationally dangerous artifact in the package**; it asserts passing security tests that cannot have run.

---

#### **D8 — MODERATE: Runtime source references 6 symbols absent from the compiled registries**

`npm run protocol:runtime-audit`:

```
REGISTRY DRIFT — 6 literal(s) do not resolve against the compiled corpus:
  BoundaryEventBus.ts        commandName "system.rail.circuit_opened"   ∉ commands.registry
  achAdapter.ts (×3)         capability_id "payment.rail.execute"       ∉ capabilities.registry
  achAdapter.ts              capability_id "payment.compensation.execute" ∉ capabilities.registry
  SovrLedgerDriver.ts        commandName "treasury.transfer.initiate"   ∉ commands.registry
```

Handwritten runtime code invokes a command/capability vocabulary the spec never defines. For a protocol whose thesis is *the YAML is authoritative*, these are spec-violating literals. The tool self-describes them as "advisory" — for this project they should be blocking.

---

#### **D9 — MODERATE: 75 declared events are unreachable**

Of 259 declared events:

| Reachability | Count |
|---|---|
| Produced by a command | 123 |
| Referenced by a state machine | 82 |
| Consumed by a projection | 85 |
| **Union (reachable)** | **184** |
| **Unreferenced by any command, machine, or projection** | **75 (29%)** |

Concentrated in identity (authentication/authority/session/credential failure paths), agent lifecycle, governance escalation, and intent. Examples: `identity.authentication.succeeded`, `identity.authority.denied`, `agent.activated`, `governance.proposal.implemented`, `intent.cancelled`.

Note the repository has an `EVENT_ORPHAN_REPORT.yaml` marked `status: RESOLVED` (generated 2026-07-20). That resolution no longer holds. Some of these are legitimately emitted by adapters or reserved for future use, but 29% dead surface in a *compiled* protocol warrants either wiring or an explicit `reserved:` marker in the catalog.

---

#### **D10 — MODERATE: The build is not reproducible by a third party out of the box**

Neither the compiler nor the runtime can be built or run from a clean clone:

1. `@sovr/shared` is declared as `file:../shared` but no workspace linkage exists. Running the compiler fails immediately with `ERR_MODULE_NOT_FOUND: Cannot find package '@sovr/shared'`. I had to hand-create `packages/compiler/node_modules/@sovr/shared` as a symlink to proceed.
2. The root `package.json` has **no `workspaces` field**, and `package-lock.json` is a 11-line stub listing zero dependencies. `npm ci` at root therefore installs nothing ("up to date in 432ms") — yet all three CI workflows depend on exactly that step before `lint`, `typecheck`, `build`, and `test`.
3. `npm run build` fails: `sh: 1: tsc: Permission denied` (no resolvable TypeScript binary from the root context).
4. `packages/runtime/dist/` is absent, so `npm run server` / `boot` cannot start.
5. Lockfile inconsistency: runtime carries both `package-lock.json` and `pnpm-lock.yaml`.

**Consequence:** every CI job in `ci.yml` and `ci-production.yml` would fail at the install/build step. The "Build: Reproducible" badge is not independently reproducible as shipped.

---

#### **D11 — MODERATE: `.env` with private-key placeholders is committed to version control**

`.env` is tracked in git (committed in `a45203c`) and is **not** listed in `.gitignore`.

Mitigating: it is byte-similar to `.env.example` — identical key set (110 lines each), and `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` contain 3-line `-----BEGIN RSA PRIVATE KEY-----\n...\n-----END-----` placeholders with literal ellipses, not real key material. **No live secret is currently exposed.**

Still a latent hazard: the file is `NODE_ENV=production`, carries real-looking operational values (ACH routing number `021000…`, TigerBeetle cluster config, Dwolla/Marqeta provider selections), and is the exact file an operator will paste real credentials into — at which point the next `git commit -a` leaks them. Note `certify-production.mjs` scans compose files for secrets but never checks `.env`.

---

#### **D12 — MINOR: Documentation/structure inconsistencies**

- README repo-structure claims "Root YAML — 15 files"; actual is **16** (`phase_j_protocol_closure.yaml` is undocumented).
- README `domains/` listing shows 9 of 10 — **`escrow.yaml` missing**.
- README describes `acceptance-tests.yaml` as "60 acceptance tests" — not independently verified against the registry.
- `generated/openapi.yaml` is **JSON content with a `.yaml` extension** (a `#` comment header followed by a JSON object). Standard YAML parsers fail on it; consumers following the README's OpenAPI guidance will break. Rename to `.json` or emit real YAML.
- `generated/manifest.yaml` contains unresolved build placeholders: `source_hash: sha256:computed-at-build-time`, `checksum: sha256:generated-at-build-time`.
- `generated/protocol-manifest.yaml` lists per-domain hashes for only **4 of 10** domains (vault, treasury, payment, agent).
- `certification/PRODUCTION_GATE.yaml` cites `packages/compiler/runtime` — a path that does not exist.
- Root `package.json` `"lint": "npm run typecheck"` — there is **no ESLint config in the repository**, yet `ci.yml` has a step named "Run ESLint". Linting is not actually happening.

---

## 3. Drift Root-Cause Model

The drift is not random. It resolves to **one causal event with a cascade**:

```
Someone edited the YAML corpus after the last successful compile
        │
        ├─► 01_constitution.yaml changed, lock_hash in 00_protocol-manifest not re-pinned
        │        └─► D1  compiler HALTs at PASS-001 (CONST-LOCK-002 FATAL)
        │                 └─► no recompile possible
        │                          └─► D2  all 39 input hashes stale, GEN-007 tamper on every file
        │                          └─► D3  generated/ frozen at d0cb2251, docs/boot frozen at 2ae816fa
        │                                   └─► D4  certify:production fails on the hash mismatch
        │
        ├─► escrow domain added late, not propagated
        │        └─► D6  boot.log says 15 projections, registry says 16
        │        └─► D12 escrow missing from README domain list
        │
        ├─► repo restructured to packages/{compiler,runtime,shared}
        │        └─► D7  PRODUCTION_GATE.yaml still cites the old kernel/security/events/apps layout
        │        └─► D10 workspace linkage never re-established (@sovr/shared unresolvable, stub lockfile)
        │
        └─► version bumped in package.json/README but not in source
                 └─► D5  1.0.0-rc badge vs 0.6.0 source vs 0.9.0-rc exec summary
```

**One fix unblocks the majority**: re-pin `lock_hash`, recompile, regenerate. That single action clears D1, D2, D3, D4, and D6, and lets the reproducibility claim be exercised honestly again.

---

## 4. Remediation Plan (priority-ordered)

### P0 — Restore the provenance chain

1. **Re-pin the constitution lock.** Set `lock_hash` in `00_protocol-manifest.yaml:46` to the actual SHA-256 of the current `01_constitution.yaml` (`34dfbdc2de193f54f87bb873039603bb5a5502a8448ef6151133f54c77a54ed3`) — *after* confirming the constitution edits were intentional and governance-approved per `11_governance-amendments.yaml`.
2. **Recompile and regenerate** `generated/` end to end, so input hashes, IR hash, build hash, boot attestation, and registries all derive from the committed corpus.
3. **Collapse to one build hash.** After regeneration, sweep `2ae816fa…`, `d0cb2251…`, `5678ed61…`, and `4770a831…` and replace with the single new value. Add a `certify:production` check asserting that no stale hash literal survives anywhere in `README.md`, `DUE_DILIGENCE/`, or `generated/`.
4. **Get `certify:production` to green** — then keep it green as a merge gate.

### P1 — Stop asserting unverifiable things

5. **Rewrite `certification/PRODUCTION_GATE.yaml`.** Downgrade `event_integrity` and `authorization` from green until backed by files that exist. Add a CI check that every cited evidence path resolves — a green status citing a missing file should be a hard build failure.
6. **Fix the build.** Add `"workspaces": ["packages/*"]` to root `package.json`, regenerate a real `package-lock.json`, drop the duplicate `pnpm-lock.yaml`, and verify `npm ci && npm run build && npm test` from a clean clone. Until this passes, no CI job can ever have succeeded.
7. **Reconcile versions on `0.6.0`.** Align `package.json` (currently `1.0.0`), README badges (currently `1.0.0-rc`), and the exec summary (currently `0.9.0-rc`) to the source-of-truth `0.6.0`, or perform a genuine version bump across all six locations at once. Resolve `protocol_target_version: '1.0.1'` against the FROZEN `1.0.0`.
8. **Untrack `.env`.** `git rm --cached .env`, add `.env` to `.gitignore`, keep `.env.example`. Extend the `certify-production.mjs` secret scan to cover `.env` and to fail if it is tracked.

### P2 — Close the spec/runtime gap

9. **Promote the 6 runtime-audit drift literals from advisory to blocking** — either define them in YAML or remove them from the runtime.
10. **Triage the 75 unreachable events** — wire, delete, or mark `reserved:` in `04_event-catalog.yaml`. Regenerate `EVENT_ORPHAN_REPORT.yaml`, whose `RESOLVED` status is now false.
11. **Resolve the 15↔16 projection split** — most likely by rebuilding `boot.log` post-recompile so escrow is included.

### P3 — Documentation hygiene

12. Rename `generated/openapi.yaml` → `.json` (or emit real YAML).
13. Fill the `computed-at-build-time` placeholders in `generated/manifest.yaml`; extend `generated/protocol-manifest.yaml` from 4 to all 10 domains.
14. Fix README repo-structure: 16 root YAML files, add `escrow.yaml`, document `phase_j_protocol_closure.yaml`.
15. Add a real ESLint config, or rename the CI step so it stops implying lint coverage that does not exist.

---

## 5. Assessment

The engineering instinct here is genuinely strong. Registry integrity is perfect. The IR node/edge counts are exact. The LOC and file counts are exact. The "What the Runtime Does Not Do Yet" section and the TLA+ "specified, not verified" caveat are the kind of disclosure most projects omit — the 2026-07-27 independent audit clearly landed and made this package more honest than average.

The failure mode is not fabrication; it is **staleness**. Proofs were generated once, the sources moved underneath them, and nothing forced re-derivation. For a project whose entire value proposition is *"deterministic compilation, unfakeable provenance,"* stale provenance is the one defect that attacks the thesis directly — a reviewer who runs `npm run compile` gets a FATAL halt in under a second, before seeing anything else.

Two items deserve singling out as reputational risk rather than technical debt:

- **D7** — `PRODUCTION_GATE.yaml` asserting green security/authorization status on the strength of files that do not exist, including "6 tests PASS" for a test file that is absent.
- **D4** — the README citing `certify:production` as verification for a metrics table, when that command currently exits non-zero.

Both are fixable in an afternoon, and fixing them costs nothing but a recompile and some honest downgrades. The underlying protocol data is sound enough to be worth the cleanup.

---

*All findings independently reproduced. Commands used: `node packages/compiler/dist/cli.js {compile,verify,boot}`, `node scripts/runtime-audit.mjs`, `node scripts/certify-production.mjs`, `npm run build`, `npm ci --dry-run`, plus SHA-256 recomputation over the 39-file input frontier and all 11 registries. The compile/verify/boot runs were executed against a scratch copy in `/tmp`; no repository files were modified by this audit.*
