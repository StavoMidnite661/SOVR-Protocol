# POST-REMEDIATION SOVR SYSTEM AUDIT

- **Date:** 2026-08-12 (UTC)
- **Baseline:** checkpoint `sovr/determinism-remediation-checkpoint` (commit `9d5f620`, build identity `18c55c3231a606657491a39f62ffc94d8a9589f3766af66901edb863fe46ff80`)
- **Mode:** READ-ONLY evidence sweep. No files modified.
- **Question:** The determinism remediation proved `same source → same compiler → same artifacts → same identity`. It did **not** prove `source → correct protocol semantics → correct runtime behavior`. This audit ranks the failure surfaces that question exposes.

---

## 1. EXECUTIVE FINDING

**The compiler is now deterministic; the protocol it deterministically compiles contains at least one CRITICAL materialization defect and several HIGH-severity semantic gaps.** Determinism amplified the problem's visibility: the build now reproducibly exposes a ratified constitutional amendment that never materialized into executable authority.

Headline: **all 8 ratified AMD-0005 commercial commands are structurally mis-nested in the frozen command catalog** — they sit under `command_lifecycle_coverage:` instead of `commands:` — so the entire Commercial Settlement Suite (commands, and therefore every transition that references them) is inert at runtime while the README describes the protocol as if it were live. The deterministic build identity `18c55c32…` is therefore a **candidate trusted identity for a semantically incomplete protocol**.

## 2. WHAT DETERMINISM DID AND DID NOT BUY

| Proven by the remediation | NOT proven by the remediation |
|---|---|
| Same source → same artifacts → same build identity (byte-identical, two-process evidence) | That the source corpus encodes the intended protocol |
| Certification is now evidence-based | That ratified amendments are correctly materialized in the corpus |
| Runtime consumes only compiler artifacts (re-verified §3.A) | That those artifacts carry complete authority (they faithfully carry what the corpus says — including its defects) |
| Build identity moves exactly when inputs move | That state-machine guards, referenced events, and commercial lifecycles are executable |

The compiler is a faithful mirror. This audit inspects what the mirror is showing.

## 3. VERIFIED-CLEAN SURFACES (checked this sweep)

- **A. Runtime authority boundary** — zero `yaml.load`/`yaml.parse`, zero YAML `readFileSync`, zero manual dispatch patterns (`command_name ===`, `switch(command)`) in `packages/runtime/src` outside tests. Phase 10B.1's single-authority claim holds at the static level.
- **B. Compiler determinism** — re-verified at checkpoint (10/10 checks, `DETERMINISM_CHECKPOINT_VERIFICATION.md`).
- **C. Invariant enforcer presence** — 8 enforcer classes exist (`packages/runtime/src/execution/*Enforcer.ts`: AuditTrail, AuthorityBoundary, CapabilityBoundary, ConstitutionalSupremacy, EventOrdering, ExecutionGate, SagaCompensation, StateSovereignty) with live wiring sampled in `kernel-executor.ts:74`, `commandBus.ts:218`, `EventStoreEnforcementWrapper.ts:40`. (Coverage completeness across all paths: UNVERIFIED — requires dynamic runs.)
- **D. Secrets hygiene** — no real credentials found; matches limited to `.env.example` and documentation.
- **E. AMD-0005 materialization in other catalogs** — events (9/9 under `events:`), entities (4/4 under `domains:`), and state machines (3/3 under `state_machines:`) are correctly nested. The defect is isolated to the command catalog.

## 4. FAILURE SURFACES — RANKED BY SEVERITY

### F1 — CRITICAL: Ratified AMD-0005 commands mis-nested; Commercial Settlement Suite is inert

**Evidence (all mechanically verified):**
- `03_command-catalog.yaml` structure: `commands:` map at line 22; top-level `command_lifecycle_coverage:` at line 4116; the block headed "AMD-0005 EXTENSION COMMANDS … Append after existing command definitions" begins at line ~4184 — **after** the map-terminating key.
- Parse verification: `commands` contains **105** entries; `command_lifecycle_coverage` contains the 8 AMD-0005 commands as sibling keys (`CreateCommercialObligation, ValidateObligation, AuthorizeSettlement, ExecuteSettlement, GenerateEvidencePackage, SignAttestation, IssueSVU, RedeemSVU`), each tagged `amendment: AMD-0005`.
- Registry verification: `generated/registries/commands.registry.json` has **no** commercial entries (105 total).
- Consequences, all observable in the tracked manifest:
  - 13 REF-002 warnings: state machines `CommercialObligation`, `SettlementRecord`, `EvidencePackage` reference commands with no authority entries.
  - No validation rules (`validation.registry.json`), no capability bindings, no execution gates exist for these commands — they cannot be executed, validated, or simulated.
  - README describes the materialized protocol: "**113 commands**" (105 + exactly these 8), "268 events" — i.e. the documentation reflects intent; the corpus reflects a failed append.
- The amendment was ratified (`CHANGELOG.md`: AMD-0005, "Ratified: 2026-08-05", "8 new commands"; catalog header "Ratified: 2026-08-05").

**Impact:** A ratified constitutional extension is deterministically compiled into non-authority. Any downstream claim that the commercial suite is executable is false. Because compilation is now deterministic and certification honest, this defect is permanently and reproducibly visible — the build identity changes the moment it is fixed, which is the correct behavior.

**Note:** This also reclassifies the checkpoint document's 13 "command-absent-from-catalog" warnings: the commands are **present in the file but under the wrong parent key** — a structural materialization defect, not missing content.

### F2 — HIGH: Referenced-but-undefined failure-path event

- `escrow.account.cancel` declares failure event `escrow.account.cancellation_failed` (REF-003); the event exists nowhere in `04_event-catalog.yaml`.
- A command's failure branch points at an event that cannot be emitted, validated, projected, or settled. README's "268 events" appears to count it — intent vs corpus divergence again.
- Impact: the escrow cancellation failure path is semantically dangling; any audit-trail or projection logic expecting that event is unverifiable.

### F3 — HIGH: 71 natural-language guards with no executable semantics

- All 71 SEM-002 diagnostics originate in `05_state-machines.yaml`: guard conditions expressed as prose ("3600s elapsed without authorization", "all authorization gates passed", "active_reservation_confirmed_valid", …) with no structured field reference PASS-008 can resolve.
- These compile into `machines.registry.json` as data, but no runtime component can evaluate prose; transition sovereignty (INV-006/INV-009 territory) for those transitions rests on something other than the compiled guard.
- Impact: the guard layer of the affected state machines is, as compiled, non-executable semantics. Whether any of these transitions are reachable in current simulations: UNVERIFIED (no simulation scenario exercises the commercial machines; treasury/settlement scenarios use dot-notation commands with structured paths).

### F4 — MEDIUM: Contradictory protocol metrics across authoritative documents

Ground truth (registries + manifest): **105 commands, 267 events, 46 machines, 113 capabilities, 16 projections, 610 IR nodes, 462 edges, 168 primary artifacts**.

| Document | Claim | Status |
|---|---|---|
| `README.md:419,537,579,870` | 113 commands / 268 events | **INTENDED** post-AMD-0005 state — true only after F1 is fixed |
| `CHANGELOG.md:24-43` | 105 commands / 259 events / 43 machines / 592 IR nodes / 104 artifacts | **STALE** pre-extension snapshot |
| `protocol/BOOT_SEQUENCE.yaml:145,149` | "projections: 15" / "rebuild all 15 projections" | **STALE** — implementation counts from corpus (16) since audit finding D6; spec never updated (spec is PROPOSED, not frozen) |
| `CHANGELOG.md:40` | "Compiler: Version: v1.0.0" | contradicts `VERSION_AUTHORITY.yaml` (compiler 0.6.0) |
| Remediation baseline manifest | 105/267/113/46/16 | matches ground truth |

Risk: reviewers, certifiers, and future agents anchor on different numbers; "drift" accusations become indistinguishable from documentation lag.

### F5 — MEDIUM: Certification chain contains unverifiable and stale attestations

- Remediation baseline pinned `git_commit: 1132fc67…` (absent from history) and hashes of boot artifacts not present in the tree (forensic audit §4C).
- `SOVR-GENESIS-000002_PHASE10B.1_COMPLETION_CERTIFICATE.yaml` references `generated/simulation/reports/` — absent from the current tree (runtime-run byproducts, never tracked).
- `governance/releases/*` certificates broadly assert `VERIFIED` states whose evidence (specific test runs at specific times) is not re-derivable from the tree alone. This is the systemic staleness failure mode already flagged in `docs/audit/ASSET_INVENTORY_AND_CLAIMS_AUDIT.md:428`.
- The determinism remediation fixed compiler self-certification; the governance certificate layer has no equivalent two-run/derivable-evidence discipline.

### F6 — MEDIUM: Production gating is configuration-based, not code-impossible

- Rail adapters carry real production paths gated by config, e.g. `AchDriver.ts:138-141` selects `https://api.dwolla.com` when `environment === 'production'`.
- "Production Traffic: DISABLED" in every directive is therefore an operational/config discipline, not a structural impossibility. As-designed, but it belongs in the risk register with an operational control (e.g., boot-time hard gate or removed production constants until go-live is ratified).

### F7 — LOW: Boot spec staleness and hardcoded spectacle values

- `protocol/BOOT_SEQUENCE.yaml` (PROPOSED): projection count stale (F4), boot splash hardcodes `SOVR BIOS v1.0.4`, `Runtime Node v24.15.0`, etc. — cosmetic, but the same spec asserts `SAME_YAML_SAME_COMPILER_SAME_BOOT_HASH`, which the implementation intentionally does not guarantee (boot-instance semantics, remediation §12).

### F8 — LOW: Historical evidence files at repo root

- `compile1.log` / `compile2.log` (UTF-16 Windows outputs documenting pre-remediation non-determinism) remain at the root. Valuable evidence; belongs under `audit/` with a README. No functional impact.

## 5. UNVERIFIED (explicitly out of reach for a static sweep)

- U1: Enforcer coverage completeness across every command path (needs dynamic execution of the full test/simulation matrix).
- U2: Whether any runtime path can reach the inert commercial machines (no simulation scenario references them; static reachability through saga orchestration not traced).
- U3: Projection replay at scale, TigerBeetle ledger adapter behavior, payment-rail adapter conformance.
- U4: Whether the `12_domain-contracts.yaml` registry (2 entries) is complete relative to the contract corpus (not sampled this sweep).

## 6. RECOMMENDED NEXT DIRECTIVES (ranked)

1. **[CRITICAL — governance-authorized protocol-content fix]** Re-parent the 8 AMD-0005 commands into the `commands:` map of `03_command-catalog.yaml` (the amendment's materialization is defective; fixing it realizes ratified intent). This touches a frozen-era file, so it requires an explicit governance directive citing AMD-0005. Expected mechanical outcome: 113 commands, 13 REF-002s resolved, new build identity, full re-certification at a new checkpoint. Until then, **no certification or README claim may treat the commercial suite as executable**.
2. **[HIGH]** Define `escrow.account.cancellation_failed` in the event catalog or remove the reference (same governance lane).
3. **[HIGH]** Issue a structured-guard policy directive for the 71 prose guards: classify each as structured-condition, lifecycle-exempt, or intentionally-prose, and make the compiler fail-closed on the unclassified.
4. **[MEDIUM]** Single numeric source of truth: one machine-checked inventory (commands/events/machines/capabilities/projections/IR metrics) regenerated from the registries; README/CHANGELOG/BOOT_SEQUENCE reconciled to it; CHANGELOG compiler-version claim corrected against `VERSION_AUTHORITY.yaml`.
5. **[MEDIUM]** Certificate hygiene: every governance certificate must cite re-derivable evidence (script + inputs) or be marked ATTESTATION-ONLY; stale references (F5) corrected or annotated.
6. **[LOW]** Archive compile logs under `audit/`; update or annotate BOOT_SEQUENCE spectacle/stale values when next touched.

## 7. BOTTOM LINE

`18c55c32…` is a **trustworthy build identity for an untrustworthy input** in one specific, now-precisely-located respect: the commercial extension was never structurally part of the command authority. That is exactly the failure class determinism was supposed to expose — and it did. The remediation stands; the protocol corpus needs its own directed repair, starting with F1.
