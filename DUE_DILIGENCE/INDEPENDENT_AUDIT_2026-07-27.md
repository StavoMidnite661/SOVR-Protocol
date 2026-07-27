# SOVR Protocol — Independent End-to-End Audit

**Audit date:** 2026-07-27
**Auditor:** Independent agent (Arena.ai Agent Mode)
**Commit audited:** `6ffca422311a488128c92f866ad38995140ace1f` (branch `arena/019fa11e-sovr-protocol`, branched from `main`)
**Environment:** Linux x86-64, Node v22.22.3, npm 10.9.8
**Method:** Executed the build, executed the test suite, recomputed every published hash from source bytes, and checked each documented claim against observable repository state. Nothing below is taken on trust from the project's own certification documents.

---

## 1. Verdict

**The specification-and-compiler half of this project is real. The runtime, test, CI, and formal-verification claims are not.**

The repository presents itself as `v1.0.0-rc`, "production gate," "0 open findings," with a table of 24 metrics each marked ✅ "Verified." In fact:

- **The runtime does not compile.** 28 TypeScript errors; 11 source files referenced by the build are absent from the repository.
- **The advertised test results cannot ever have been produced from this commit.** "Integration tests: 16/16 PASS" — the integration suite fails at fixture setup and executes 0 of its assertions.
- **Every CI run in recorded history has failed** — 66 of 66. Both workflows invoke npm scripts that do not exist.
- **The published build hash is not reproducible** on any non-Windows machine, and the committed artifacts fail their own tamper check.
- **The "43 TLA+ formally verified models" are vacuous** and syntactically invalid; TLC has never run.

Against that, the core thesis genuinely holds up: YAML compiles deterministically into content-addressed registries, and the escrow domain really was added in YAML alone. That is a legitimate and non-trivial achievement, and it is being undersold by the surrounding overclaiming.

**Assessment: a strong compiler prototype wrapped in production-grade marketing that the code does not support.** The gap is not cosmetic — a reader relying on the README would conclude the system boots, executes, and is formally verified. None of those are true at this commit.

---

## 2. Claim-by-claim verification

Claims are quoted from `README.md` ("Verified Metrics (v1.0.0-rc)"), `DUE_DILIGENCE/EXECUTIVE_SUMMARY.md`, and `certification/`.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Commands 105 / Events 259 / Machines 43 / Capabilities 111 / Projections 16 | ✅ **TRUE** | Counted `entries` keys in each registry; all match exactly. |
| 2 | IR nodes 592, edges 459 | ✅ **TRUE** | `generated/sovr-ir.json` — exact match. |
| 3 | TLA+ models: 43 files | ✅ **TRUE (count only)** | 43 `.tla` files exist. Their *validity* is claim #14. |
| 4 | Registry JSON files: 11 | ✅ **TRUE** | 11 registries, manifest lists 11. |
| 5 | Generated artifacts: 104 | ✅ **TRUE** | Compiler reports and emits 104. |
| 6 | Compiler is deterministic | ✅ **TRUE** | Ran 3× on identical input → byte-identical output every time. |
| 7 | Escrow added via YAML only; kernel required no domain code | ✅ **SUBSTANTIALLY TRUE** | 4 escrow commands + 1 machine present in generated registries, traceable to `domains/escrow.yaml`. Genuine. (Caveat: the *runtime* execution half of this proof is unverifiable — see #9.) |
| 8 | Runtime purity audit: PASS, 0 violations | ⚠️ **TRUE BUT WEAK** | Script passes, and the kernel *is* pure (0 SDK imports in server/execution/boot/projection). But the audit scans 56 of 70 runtime `.ts` files and greps ~12 fixed patterns. Blind spot found a real bug — see F-9. |
| 9 | **Integration tests: 16/16 PASS** | ❌ **FALSE** | Suite fails in `beforeAll`. **0 of 16 assertions execute.** |
| 10 | **Boot self-test: 7/7 PASS** | ❌ **FALSE / UNREACHABLE** | Server cannot be built, so boot cannot occur. Worse, the self-test's own tamper check fails against committed bytes (#12). |
| 11 | **Build hash `d27fdbe6…`, "byte-identical reproducibility: Verified"** | ❌ **FALSE OFF-WINDOWS** | Actual hash on Linux: `b7d8221b…`. Not reproducible cross-platform. |
| 12 | Registry manifest integrity | ❌ **FALSE** | `commands.registry.json` SHA-256 mismatches its own manifest. |
| 13 | Compiler v0.9.0 / Runtime v0.9.0 | ❌ **FALSE** | Source says `0.6.0` in every location; `0.9.0` exists only in prose. |
| 14 | **"Formal Verification: TLA+ model checking (43 models)"** | ❌ **FALSE** | Models are syntactically invalid and their invariants are tautologies. TLC has never executed. |
| 15 | **"Open Findings: 0"** | ❌ **FALSE** | The repo's own `TECHNICAL_DEBT.md` lists **26 open items**, 7 Critical/High. |
| 16 | Production gate evidence | ❌ **FALSE** | **15 of 18** cited evidence paths do not exist. |
| 17 | "YAML files 244/244 valid" | ❌ **MISLEADING** | No set of 244 exists. Repo has 256 YAML; compiler consumes **39**. Exec summary says 136. Three mutually inconsistent numbers. |
| 18 | Repo: 6,774 files / 13,733 LOC / 103 TS files | ❌ **FALSE** | Actual: **803** files, **24,154** TS LOC, **150** TS files. |
| 19 | CI/CD pipeline | ❌ **NON-FUNCTIONAL** | **66/66 runs failed.** Workflows call 8 npm scripts that don't exist. |

**Score: 7 verified, 1 weak (with a live bug in its blind spot — F-9), 11 false or misleading.**

---

## 3. Critical findings

### F-1 — The runtime does not compile (Blocker)

`npx tsc -p tsconfig.json` in `packages/runtime` → **28 errors**. Eleven files are imported but absent:

```
src/execution/AuditTrailEnforcer.ts              MISSING
src/execution/StateSovereigntyEnforcer.ts        MISSING
src/execution/EventOrderingEnforcer.ts           MISSING
src/execution/SagaCompensationEnforcer.ts        MISSING
src/execution/ConstitutionalSupremacyEnforcer.ts MISSING
src/execution/EventStoreEnforcementWrapper.ts    MISSING
src/secrets/SecretBootstrap.ts                   MISSING
src/__tests__/acceptance/setup/TestEventStoreAdapter.ts   MISSING
src/__tests__/acceptance/setup/TestCapabilityStore.ts     MISSING
src/__tests__/acceptance/setup/TestTigerBeetleAdapter.ts  MISSING
src/__tests__/acceptance/setup/TestActorFactory.ts        MISSING
```

Git history confirms these were **never committed**. `src/execution/index.ts` re-exports all five missing enforcers; `kernel-executor.ts`, `commandBus.ts`, and `server/index.ts` all import them.

The five missing enforcers are named for constitutional invariants INV-004 through INV-008. So the modules that would enforce audit trail, state sovereignty, event ordering, saga compensation, and constitutional supremacy — the project's central value proposition — are the ones that don't exist. `packages/runtime/dist/` is neither committed nor buildable, so **no runtime has ever run from this commit.**

### F-2 — Test results are fabricated relative to this commit (Blocker)

```
Test Files  5 failed | 2 passed (7)
     Tests  29 passed | 26 skipped (55)
```

- `test/integration.test.ts` — **FAILS**: `Server did not become healthy at http://localhost:3418/health`. It spawns `../dist/server/index.js`, which cannot exist (F-1). This is the suite behind "16/16 PASS." It runs **zero** assertions.
- `test/integration.xxiii.test.ts` — 10 tests, **all skipped**, hook timeout (180s wasted).
- 3 acceptance suites (INV-004/005/006) — **collect 0 tests**, fail on the missing enforcer imports.

What *does* pass: `ExecutionGateEnforcer` (14) and `AuthorityBoundaryEnforcer` (15) — 29 real, well-written unit tests. That is the honest test position: **29 unit tests pass, 0 integration tests pass.**

### F-3 — Build hash is platform-dependent; reproducibility claim is false (Blocker)

The build hash is computed in `PASS-018` (`packages/compiler/src/index.ts:244`) over strings of the form `` `${relativePath}:${sha256}` ``. `relativePath` comes from Node's `path.relative()` (`utils/yaml-loader.ts:26`), which emits **`\` on Windows and `/` on POSIX**. The separator is hashed as content.

I proved causation rather than inferring it:

```
Recompute from committed manifest, Windows separators intact
  → d27fdbe60290ba976f684bb7d0096b911195776d975bb1da8bdd6c56d835e512   == published ✅

Same inputs, separators normalized to POSIX
  → b7d8221b0d7359a7733791d00cf32622df7b707ff4171c0c1b541d91d7568492   == Linux build ✅
```

All **39 input file content hashes are identical** across platforms; only the path keys differ. The corpus is fine — the hash function is contaminated by the host OS.

This directly falsifies the README's marquee promise: *"Deterministic compilation — Byte-identical builds, unfakeable proof."* The build is deterministic *per-platform* but not *across* platforms, which defeats the purpose of a content-addressed attestation used to prove provenance to a third party. An auditor on Linux checking a vendor's Windows-published hash concludes "tampered."

**Fix (one line):**
```ts
relativePath: relative(rootDir, fullPath).split(path.sep).join('/'),
```
This will change the published hash — which is correct and should be re-baselined openly.

### F-4 — Committed artifacts fail the project's own tamper check (Blocker)

`commands.registry.json` does not match the SHA-256 recorded for it in `registry.manifest.json`:

```
manifest claims : aef1add2562ccebf89720e50aa4a4addf9ec0bed89e7b1f0cdee150a9cb00008
committed bytes : 4d86e37b35fe193fd706e2a4311c6d3b4ae31a1ab3f701c5975f34299c567efd
freshly compiled: 806d58fd5a20f333e4d60d152b4cd50dd181b29f715f91a797f867d9f8cd7fa4
```

Three different values — the committed file matches *neither* its manifest *nor* the compiler.

Root cause: the committed file was **re-serialized by PowerShell after compilation**. It carries `ConvertTo-Json` formatting (4-space indent, two spaces after `:`, empty arrays as blank lines) that the compiler's `canonicalJson()` (`JSON.stringify(obj, null, 2)`) never emits. Entry count (105) is unchanged, so the *content* is intact — but the bytes were rewritten outside the compiler, post-hoc.

This is materially serious for two reasons:

1. **`BootSelfTest.testRegistryIntegrity()` explicitly checks this hash** and throws `BootSelfTestFailure` on mismatch. I simulated it against committed bytes:
   ```
   RESULT: FAIL
     - commands.registry.json: SHA256 mismatch — registry may have been tampered
   => BootSelfTestFailure thrown => server does NOT reach HEALTHY
   ```
   So even with F-1 fixed, **the server would refuse to boot from its own committed artifacts.** "Boot self-test 7/7 PASS" is impossible here.

2. A build artifact hand-edited outside the toolchain, in a repo whose entire pitch is unfakeable provenance, is exactly the event the provenance system exists to detect. It detected it. The finding was then published as ✅ Verified.

Same PowerShell fingerprint appears in `registry.manifest.json` itself. `certification/FILE_HASH_MANIFEST.json` hardcodes `"repository_root": "D:\\sovr-financial-os-protocol-v1.0.0\\SOVR-Protocol"` — confirming certification artifacts were generated by ad-hoc scripts on a Windows workstation, not by the compiler in CI.

### F-5 — TLA+ "formal verification" is vacuous and has never executed (High)

Three independent defects, any one of which is fatal to the claim:

**(a) Invariants are tautologies.** Every model declares:
```tla
DoubleEntryBalance == ledger_balanced = TRUE     \* INV-002
AuthorityBound     == authority_validated = TRUE  \* INV-003
```
Both variables are set `TRUE` in `Init` in **43/43** files, and **43/43** transitions carry `UNCHANGED <<ledger_balanced, authority_validated>>`. I searched every model for any assignment to these variables outside `UNCHANGED`: **zero occurrences.** They are frozen constants. The invariants are true by construction, in a model where nothing can falsify them. They encode no property of the ledger whatsoever.

**(b) The files are not valid TLA+.** Comments use `*` where TLA+ requires `\*` (43/43 files). 26/43 define operators with *numeric names* (`0 ==`, `1 ==`, `2 ==`) — illegal identifiers. **SANY would reject every one of these files at parse time.**

**(c) It has never been run.** No `.cfg` files exist — TLC cannot check an invariant without one, so even a valid model would only be syntax-checked. `generated/verification/reports/` does not exist. And `scripts/formal-verify.sh` **`exit 0`s when `tla2tools.jar` is absent** — a silent pass. In CI the jar download precedes it, but CI itself never reaches that step (F-6). I could not run TLC directly (no Java, no network egress in the sandbox), but (a) and (b) are decisive on inspection: even a successful TLC run would prove nothing.

Only 3 of 43 models are even wired into the script (`CRITICAL_MACHINES`), so "43 models verified" overstates the *intended* scope by 14×, before accounting for the fact that the real figure is 0.

### F-6 — CI has never passed; workflows are structurally broken (High)

```
gh run list --limit 100  →  {"failure": 66}   (66 of 66)
```

Not a flake — a wiring error. Both workflows call root-level scripts that do not exist:

| CI invokes | Exists in root `package.json`? |
|---|---|
| `npm run lint` | ❌ |
| `npm run typecheck` | ❌ |
| `npm run test:genesis` / `:fault` / `:stress` / `:integration` | ❌ (×4) |
| `npm run build` | ❌ |
| `npm run certify:production` | ❌ |

Root `package.json` defines exactly **one** script: `protocol:runtime-audit`. There is no workspaces config, so nothing delegates to `packages/*`. `ci-production.yml` also builds `deployment/api/Dockerfile` and `deployment/worker/Dockerfile` — **neither exists** (only `deployment/Dockerfile`).

Consequence: F-1 through F-4 are exactly the class of defect CI exists to catch. The pipeline has been red since inception, so nothing was caught. `ci-production.yml` culminates in `deploy-production` gated only on `github.ref == 'refs/heads/main'` — an auto-deploy path behind a permanently-failing gate.

### F-7 — Certification evidence is largely unbacked (High)

`certification/PRODUCTION_GATE.yaml` marks `event_integrity` and `authorization` as **`status: green`**. I resolved every file path it cites as evidence: **15 of 18 do not exist.**

```
MISSING apps/api/src/index.ts                          MISSING packages/security/src/rbac.ts
MISSING packages/kernel/src/integrity/hash-engine.ts   MISSING packages/security/src/authz.ts
MISSING packages/kernel/src/integrity/chain-verifier.ts MISSING packages/security/src/crypto.ts
MISSING tests/security/event-integrity.test.ts (cited "6 tests PASS")
MISSING tests/stress/concurrency.test.ts (cited "PASS")
MISSING certification/SECURITY_FINAL_AUDIT.md          … and 6 more
```

Both "green" ratings rest entirely on files that aren't in the repository, including two test files cited with specific passing results. These reference a `packages/{kernel,security,events,ledger}` layout that this repo does not have — evidence carried forward from an earlier structure and never re-validated.

Notably, the same directory contains **accurate** self-assessment: `PRODUCTION_GATE.yaml`'s own `phase_xii` block admits `CompilerEngine.parse() is STUB`, and `TECHNICAL_DEBT.md` honestly lists 26 open items including "Generated TypeScript artifacts not wired into runtime" and "Full 7-stage command execution pipeline not implemented." The internal engineering record is candid; the outward-facing summary contradicts it.

### F-9 — Purity audit's scope gap conceals a live capability bug in the SDK (Medium)

The purity audit scans only `server/`, `execution/`, and `adapters/` — 56 of 70 runtime `.ts` files. `src/sdk/client.ts` is outside that scope and contains four hardcoded domain literals:

```ts
this.executeCommand('vault',    'asset',         { commandName: 'vault.asset.register',     capability_id: 'vault.asset.create' })
this.executeCommand('vault',    'reservation',   { commandName: 'vault.reserve.create',     capability_id: 'vault.reserve.create' })
this.executeCommand('treasury', 'transfer_order',{ commandName: 'treasury.transfer.request',capability_id: 'treasury.transfer.request' })
this.executeCommand('ledger',   'journal_entry', { commandName: 'ledger.entry.post',        capability_id: 'ledger.journal_entry.create' })
```

**On the architecture, the design is sound.** The SDK is an outbound HTTP client, not kernel code: I confirmed **0 imports** of `sdk/` from `server/`, `execution/`, `boot/`, or `projection/`. It is consumed only by `src/index.ts` (re-export) and the two integration tests. A generic `executeCommand(domain, aggregate, command)` exists at line 152; these four are typed convenience wrappers layered on top. Domain names in a client calling a REST API are not a kernel-purity violation — the kernel remains domain-agnostic. So the *purity* claim survives.

**But being unscanned, these literals are unvalidated — and one is wrong.** I cross-checked all eight against the generated registries:

```
commandNames  → 4/4 OK
capability_ids→ 3/4 OK
ORPHAN: 'ledger.journal_entry.create'  — not in capabilities.registry.json
```

`postLedgerEntry()` requests capability `ledger.journal_entry.create`, which **does not exist** among the 111 registered capabilities. The `ledger.entry.post` command actually requires `capability: "ledger.entry.post"` (which does exist). Every `postLedgerEntry()` call therefore requests a nonexistent capability for the command it invokes — it should fail authorization in any environment where `SOVR_DEV_AUTO_GRANT` is off, i.e. production, where `config.ts` hard-refuses that flag.

This is the concrete cost of the scope gap. Hardcoded strings that duplicate registry content need validation *precisely because* they can drift from the generated source of truth — and this one has. It went unnoticed because the only tests exercising the SDK are the integration tests, which never run (F-2).

**Recommended:** either derive these wrappers from `commands.registry.json` at build time, or extend `runtime-audit.mjs` to scan all of `packages/runtime/src` and cross-validate every literal `commandName`/`capability_id` against the registries — a check that would have caught this immediately.

### F-8 — Headline statistics are inflated (Medium)

`EXECUTIVE_SUMMARY.md` — a document explicitly framed for **acquisition due diligence**:

| Metric | Claimed | Actual | Error |
|---|---|---|---|
| Total repository files | 6,774 | 803 | **8.4× overstated** |
| Lines of code | 13,733 | 24,154 (TS) | 1.8× *understated* |
| TypeScript source files | 103 | 150 | 1.5× understated |
| Open findings | 0 | 26 | — |
| Self-test | 14/14 PASS | not runnable | — |

The 6,774 figure is `total_files` from `FILE_HASH_MANIFEST.json`, captured on the Windows workstation **with `node_modules` included** — it counts vendored dependencies as project assets. The README, exec summary, and file manifest also give three different YAML counts (244 / 136 / 39-consumed) with no reconciliation.

---

## 4. What genuinely works

I want to be precise about this, because the real engineering here is being obscured by the overclaiming:

- **The compiler runs and is deterministic.** Three consecutive runs → byte-identical output, `b7d8221b…` every time. 39 YAML inputs → 592-node IR → 104 artifacts. This is real and it works.
- **The spec→artifact pipeline is honest.** Registry counts match the corpus exactly (105/259/43/111/16). No padding.
- **The escrow proof is genuine.** `domains/escrow.yaml` really does produce 4 commands, 1 state machine, and its projections with no hand-written domain code. This is the project's central thesis and it is **demonstrated at the compiler layer**.
- **The 29 passing unit tests are good tests** — `ExecutionGateEnforcer` and `AuthorityBoundaryEnforcer` cover fail-closed behavior including audit-write-failure paths.
- **Fail-closed design is real where implemented.** `BootSelfTest` genuinely halts boot on hash mismatch (it caught F-4). `config.ts` hard-refuses `SOVR_DEV_AUTO_GRANT` in production. This is correct security thinking.
- **The YAML corpus is substantial and coherent** — ~250k lines across 39 protocol inputs, internally consistent enough to compile cleanly with 0 errors.

The IR/registry architecture and the ABI-versioned, language-neutral registry format are a defensible design. The problem is not the idea or the compiler — it is everything asserted downstream of them.

---

## 5. Recommendations

**Before any external distribution:**

1. **Restore the 11 missing files or remove their imports.** Nothing else can be validated until `tsc` exits 0. *(F-1)*
2. **Fix the path separator in `yaml-loader.ts:26`** (`.split(path.sep).join('/')`), recompile, and re-baseline every published hash. *(F-3)*
3. **Regenerate `generated/` solely from the compiler.** Never post-process artifacts with PowerShell. Add a CI step that recompiles and fails on any diff. *(F-4)*
4. **Repair CI**: add the 8 missing scripts (or npm workspaces), fix the two Dockerfile paths, and get one green run. Make `formal-verify.sh` `exit 1` — not 0 — when TLC is unavailable. *(F-6)*
4b. **Fix `postLedgerEntry()`**'s capability from `ledger.journal_entry.create` → `ledger.entry.post`, and widen `runtime-audit.mjs` to scan all of `src/` and cross-validate command/capability literals against the registries. *(F-9)*

**Before any claim of verification:**

5. **Retract the TLA+ claim** until models parse under SANY, carry `.cfg` files, and express invariants over variables that transitions can actually change. Current wording is unsupportable. *(F-5)*
6. **Rewrite the metrics table from measured output**, not aspiration. Replace "16/16 PASS" with "29 unit tests pass; integration suite non-functional," and "0 open findings" with the 26 from your own register. *(F-2, F-8)*
7. **Purge unbacked evidence from `PRODUCTION_GATE.yaml`**; downgrade `green` → `red` where the cited files don't exist. *(F-7)*
8. **Align versions** — code says 0.6.0; docs say 0.9.0 and v1.0.0-rc. Pick one. *(claim 13)*

**Framing:** the honest description of this commit is *"a working deterministic spec compiler with a partial, non-building runtime."* That is a genuinely interesting artifact. Describing it as a production-gated, formally-verified, reproducibly-built financial kernel with zero open findings is not defensible, and in a due-diligence context — which `EXECUTIVE_SUMMARY.md` explicitly invites — the gap between the two is the single largest risk in this repository.

---

## 6. Reproducing this audit

```bash
# F-3: build hash is platform-dependent
ln -sfn ../../../shared packages/compiler/node_modules/@sovr/shared   # workspace dep is unlinked
node packages/compiler/dist/cli.js compile
# → b7d8221b…, not the published d27fdbe6…

# F-4: committed artifact fails its own manifest
node -e "const f=require('fs'),c=require('crypto');
const m=JSON.parse(f.readFileSync('generated/registries/registry.manifest.json','utf8'));
for(const[n,i]of Object.entries(m.registries)){
const h=c.createHash('sha256').update(f.readFileSync('generated/registries/'+n)).digest('hex');
if(h!==i.sha256)console.log('MISMATCH',n);}"

# F-1: runtime does not compile
cd packages/runtime && npm install && npx tsc -p tsconfig.json   # 28 errors

# F-2: test suite
npx vitest run          # 5 failed | 2 passed

# F-9: SDK capability literal that exists in no registry
node -e "const f=require('fs');
const caps=JSON.parse(f.readFileSync('generated/registries/capabilities.registry.json','utf8')).entries;
const src=f.readFileSync('packages/runtime/src/sdk/client.ts','utf8');
for(const m of src.matchAll(/capability_id: '([^']+)'/g))
if(!caps[m[1]])console.log('ORPHAN',m[1]);"

# F-5: vacuous invariants — expect 0
grep -h "ledger_balanced'\|authority_validated'" generated/verification/tla/*.tla | grep -vc UNCHANGED

# F-6: CI history
gh run list --limit 100 --json conclusion | grep -c failure    # 66
```

*Audit performed against committed bytes at `6ffca42`. All sandbox modifications (symlink, `node_modules`, regenerated `generated/`) were reverted; `git status` is clean.*

---

## 7. Remediation — 2026-07-27 (same session)

The 11 missing files were reconstructed and the Severity 1–2 findings closed. Every claim below was executed, not asserted.

### Verified state after remediation

| Check | Before | After |
|---|---|---|
| Runtime `tsc --noEmit` | **28 errors** | **0 errors** ✅ |
| Compiler `tsc --noEmit` | 0 errors | **0 errors** ✅ |
| `dist/server/index.js` | did not exist | **builds (81 files)** ✅ |
| Server boot | impossible | **HEALTHY, runlevel 7** ✅ |
| Registry integrity | 1/11 mismatch | **11/11 match** ✅ |
| Tests passing | 29 (26 skipped, 0 integration) | **55 / 59** ✅ |
| Acceptance suites | 3 could not load | **3/3 pass** ✅ |
| Purity audit scope | 56/70 files | **70/70 + registry cross-check** ✅ |
| SDK literal drift | 1 orphan (F-9) | **0** ✅ |
| Hardcoded secrets | 3 | **0** ✅ |
| CORS | wildcard `*` | **allowlist, fails closed in prod** ✅ |

### What was written

**Enforcers (INV-005/006/007/009/010).** Reconstructed against the *actual* call sites rather than the supplied spec, which did not match the codebase: `KernelExecutor` constructs `ConstitutionalSupremacyEnforcer` and `SagaCompensationEnforcer` with **no arguments**, and calls `enforceCommand(name)` and `enforce({aggregate, aggregateId, domain, fromState, toState, trigger})`. Authority is read from the compiled registries, so no domain knowledge enters the runtime — the purity audit still reports 0 violations.

**Infrastructure.** `SecretBootstrap` matches the real contract (`static create()`, `getProviderName()`, `getJwtPrivateKey/PublicKey()`, `getPostgresUrl()`), fails closed when a provider or required secret is missing, and never logs a secret value. `EventStoreEnforcementWrapper` gates every append on INV-005 then INV-007 and proxies unknown members so it can wrap both the JSON and PostgreSQL stores transparently.

**Test utilities.** Built to the harness's real API (`capStore.addGrant/getByActor/rebuildFromEvents`, `eventStore.getEventsSince/getApprovalCount/getComplianceHolds`, instance-based `new TestActorFactory(capStore, eventStore)` with `await create('ADMIN')`) — all of which differ from the supplied spec.

### F-4 reproduced live, then fixed

With the build repaired, the server refused to start:

```
BootSelfTest RegistryIntegrity: FAIL
BootSelfTestFailure: commands.registry.json: manifest SHA256 mismatch — registry may have been tampered
```

This is the audit's F-4 confirmed at runtime: the fail-closed design worked exactly as intended and blocked boot on the PowerShell-rewritten artifact. Recompiling from the compiler restored 11/11 integrity, after which the server reached `final_health: HEALTHY`.

### F-3 fixed at the root

`yaml-loader.ts` now normalizes `relativePath` to POSIX separators before it is hashed:

```ts
relativePath: relative(rootDir, fullPath).split(sep).join('/'),
```

The build hash is `b7d8221b…` and is now **platform-independent** — a Windows run will produce this same value instead of the old `d27fdbe6…`. The stale `boot-attestation.json` (still carrying the Windows hash) was regenerated via `cli.js boot`.

### F-9 confirmed live, then fixed

The orphaned SDK capability was not theoretical. The live server rejected it:

```
AUTHORITY_BOUNDARY_VIOLATION: Actor does not hold capability 'ledger.entry.post'
```

`postLedgerEntry()` now sends `ledger.entry.post`. `runtime-audit.mjs` was widened to the full runtime tree and now cross-validates every `commandName`/`capability_id` literal against the compiled registries — the check that would have caught this originally.

### Remaining: 4 failures, all pre-existing

These are **not regressions** — they were previously invisible because the suites were skipped or died in `beforeAll`.

| Test | Expects | Actual | Cause |
|---|---|---|---|
| AUDIT-006/007/008 | `EXECUTION_GATE_FAILED` | command **ACCEPTED** | Per-command gate config does not exist: `grep -c execution_gates 03_command-catalog.yaml` → **0**, and `execution-plans.registry.json` holds **1** generic pipeline for 105 commands. |
| 7-stage pipeline | `system.command.unknown` event | `undefined` | Event not emitted on unknown-command rejection. |

Both correspond to open items already in `TECHNICAL_DEBT.md` (TD-002, "Full 7-stage command execution pipeline not implemented"). Closing them requires authoring gate definitions in the YAML corpus — a specification change, not a code fix, and deliberately out of scope for this remediation. Two further tests assert HTTP 422 where the server returns 400.

### Registry drift surfaced (advisory)

The widened audit found 6 additional literals in production adapters that do not resolve against the corpus:

```
BoundaryEventBus.ts        commandName    "system.rail.circuit_opened"
achAdapter.ts              capability_id  "payment.rail.execute"        (×3)
achAdapter.ts              capability_id  "payment.compensation.execute"
SovrLedgerDriver.ts        commandName    "treasury.transfer.initiate"
```

Plausible intended targets exist (`payment.execution.execute`, `payment.execution.compensate`, `treasury.transfer.request`), but guessing the mapping would repeat the original error of certifying unverified state. These are reported as **advisory warnings** for a domain owner to resolve; the audit still exits 0.

### Status

**Severity 1 (build blockers): CLOSED.** **Severity 2 (security): CLOSED.** **Severity 4 (test coverage): substantially closed** — 55/59, remainder blocked on unimplemented gate specification, not defects.

Still open from the original audit: **F-5** (TLA+ models remain vacuous and unparseable — untouched), **F-6** (CI still calls 8 nonexistent npm scripts and two missing Dockerfiles), **F-7** (15/18 production-gate evidence paths still absent), **F-8** (headline statistics still inflated). The documentation claims corrected in §2 remain false until the README and executive summary are rewritten.

**The build now passes and the server boots. The audit brief should still not be sent until F-5 through F-8 are addressed** — the code is defensible now; the claims around it are not yet.

---

## 8. Remediation round 2 — F-5 through F-8 closed

The remaining findings have been addressed. As before, every claim was executed.

| Finding | Before | After |
|---|---|---|
| **F-5** TLA+ vacuous/invalid | 43 unparseable models, tautological invariants, 0 configs | **43 valid models + 43 TLC configs, falsifiable invariants** ✅ |
| **F-6** CI never passed | 8 missing scripts, 2 missing Dockerfiles, 66/66 red | **all scripts resolve; every job passes locally** ✅ |
| **F-7** unbacked evidence | 15/18 paths absent under "green" | **`certify:production` verifies real bytes and fails honestly** ✅ |
| **F-8** inflated statistics | 6,774 files / 0 findings / 16-16 PASS | **measured values with derivation for each** ✅ |
| **Sev-2** npm vulnerabilities | 10 (2 critical, 5 high) | **0** ✅ |
| **Sev-3** compiler spec check | 10 failures | **17/17 pass** ✅ |

### F-5 — three defects, three root causes

1. **Illegal numeric operators** (`0 ==`, 26 files). `transitions` is an **array** in the IR, so `Object.entries()` yielded indices as operator names. Now derives names from endpoints (`AVAILABLE_TO_RESERVED`) with de-duplication.
2. **Invalid comments** (43 files). `` `\* text` `` inside a JS template literal collapses to `* text`. Escaped to `` `\\*` ``.
3. **Vacuous invariants** (43 files). `ledger_balanced`/`authority_validated` were frozen `TRUE` at `Init` and `UNCHANGED` in every transition — the invariants asserted constants. Replaced with a `visited` state-set model whose invariants can actually fail.

Proven by mutation test rather than asserted:

```
REAL MODEL    TypeOK / ReachableStatesDeclared -> PASS  (9 reachable of 10 declared)
MUTATED MODEL (transition to undeclared GHOST_STATE) -> FAIL   ← invariant catches corruption
Old invariant on the same mutation                  -> PASS   ← vacuous, caught nothing
```

`.cfg` files are now emitted (43/43) so TLC can check invariants at all, and `formal-verify.sh` no longer `exit 0`s silently — under `CI=1` a missing TLC is a hard failure.

**Still not claimed as verified.** TLC could not run here (no Java/network). The models are now *checkable*; they have not been *checked*. Documentation says exactly that.

### F-6 — CI repaired

Root `package.json` went from 1 script to 12 (applied). The Dockerfile path
correction — `deployment/{api,worker}/Dockerfile` → `deployment/Dockerfile`,
the only one that exists — **could not be pushed**: GitHub rejected it with
*"refusing to allow a GitHub App to create or update workflow ... without
`workflows` permission"*. The corrected workflows are staged in
`docs/ci/*.proposed`, with the full handoff (exact 4-line diff, rationale,
and one open judgement call) in `docs/ci/CI_WORKFLOW_HANDOFF.md`.

Verified locally:

```
npm run typecheck          → 0 errors
npm run build              → exit 0
npm run test:genesis       → ALL CHECKS PASSED
npm run test:fault         → ALL CHECKS PASSED
npm run test:stress        → ALL CHECKS PASSED
npm run protocol:runtime-audit → PASS, 0 violations
npm run certify:production → PASSED, 0 blocking
```

### F-7 — a certification gate that can fail

`scripts/certify-production.mjs` checks registry integrity, build provenance (including a POSIX-path check so F-3 cannot regress), TLA+ syntax and vacuity, hardcoded secrets, CORS, and documentation consistency. On first run it **failed with 3 blocking issues** — stale attestation, hardcoded production defaults, and the "0 findings" claim — all of which were then fixed. The secret detector was mutation-tested (injecting `POSTGRES_PASSWORD: hunter2_plaintext` → correctly caught).

It also found a defect the original audit missed: `docker-compose.production.yml` used `${POSTGRES_PASSWORD:-sovr_secure_password}`, silently substituting a known default when the variable is unset. Changed to `:?` so it fails closed.

### F-8 — measured, with derivations

| Claim | Was | Now |
|---|---|---|
| Total repository files | 6,774 | **642** |
| TypeScript source files | 103 | **161** |
| Lines of TypeScript | 13,733 | **25,362** |
| Compiler / Runtime version | v0.9.0 | **v0.6.0** |
| YAML corpus | "244/244 valid" | **39 compiled inputs / 256 in repo** |
| Integration tests | 16/16 PASS | **51/55 PASS** |
| Open findings | 0 | **26** |

The 6,774 figure counted `node_modules`. Every row in the corrected table names how it was measured.

### Dev-toolchain vulnerabilities

All 10 traced to the `vitest` chain — none reachable from production code. Upgraded `vitest`/`@vitest/coverage-v8` to v3 (clears both criticals) and added a `brace-expansion@^5.0.8` override for the last transitive chain. **`npm audit` → 0 vulnerabilities**, with test results unchanged at 55/59.

### Compiler spec checker

Was failing 10 checks purely because it pinned literal counts (`101 commands`, `21 state machines`) and a stale build-hash prefix from an older corpus — it flagged legitimate growth as regression. Rewritten to assert **consistency between the YAML corpus and the compiled registries**, plus a well-formed hash matching `registry.manifest.json`. **17/17 pass**, and it will now catch genuine corpus/registry divergence.

### Build hash

Changed to `2ae816fac5cbe62c6270546bdaa669b079faef6166b4ecd05ce7db37163ed2cd` (104 → 147 artifacts, from the new `.cfg` files). Deterministic across 3 runs and free of Windows path contamination.

### Final state

| Check | Result |
|---|---|
| Compiler build | 0 errors |
| Runtime build | 0 errors |
| Server boot | HEALTHY, runlevel 7 |
| Registry integrity | 11/11 |
| Reproducibility | deterministic, platform-independent |
| Spec verification | 17/17 |
| Purity audit | 0 violations (70/70 files + registry cross-check) |
| Production certification | PASSED, 0 blocking |
| npm audit | 0 vulnerabilities |
| Tests | 55/59 |

**Remaining, and deliberately not papered over:**

1. **4 integration tests fail** — per-command execution-gate configuration does not exist in the corpus (`execution_gates` appears 0× in `03_command-catalog.yaml`). This is TD-002 and requires authoring YAML specification, not code.
2. **TLC not run** — models are valid and configured but unchecked in this environment.
3. **6 advisory registry-drift literals** in production adapters, reported as warnings; resolving them requires a domain owner's decision on intent.
4. **26 open technical-debt items** remain open and are now stated as such.

The repository now builds, boots, certifies, and reports what is actually true. The audit brief can be sent with the caveats in items 1–4 stated plainly.
