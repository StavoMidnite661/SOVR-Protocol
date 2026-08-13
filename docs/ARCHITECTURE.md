# SOVR architecture (implementation truth)

This document describes the architecture **as implemented in this repository**.
It is written from the YAML corpus, the compiler, and the generated registries.
It does not describe a future or former design.

**Documentation does not drive the architecture.** Code + YAML + generated
authority do.

```text
YAML protocol corpus
      ↓
discovery / parsing
      ↓
compiler passes
      ↓
canonical IR
      ↓
generated registries/artifacts
      ↓
authority-loader
      ↓
runtime
      ↓
event store / state machines / projections
      ↓
ledger adapters / external systems
```

## Authority

| Layer | Role | Rule |
| --- | --- | --- |
| YAML corpus | Protocol source of truth | Humans edit YAML. If it is not in the corpus, it is not protocol. |
| Compiler | Only materialization path | Fail-closed. No silent drops. Deterministic (R1–R10). |
| Canonical IR | `generated/sovr-ir.json` | Content-addressed intermediate form. |
| Generated registries | Compiled authority | Never hand-edit `generated/registries/*`. |
| Runtime | Executes compiled authority | Loads registries via `authority-loader`. Does **not** parse or reinterpret YAML. |

## Live compiled counts

Read from `generated/registries/` and `generated/compiler-certification.json`
at commit `6f2f417` (working tree identical to that implementation).

| Artifact | Count |
| --- | --- |
| Commands | **118** |
| Events | **292** |
| State machines | **47** |
| Capabilities | **127** |
| Projections | **57** |
| Validation plans | 118 |
| Schemas | 410 |
| Economic entries | 170 |
| Reserve entries | 28 |
| Settlement entries | 23 |
| Canonical IR | **663 nodes, 516 edges** |
| IR hash | `16c3f8b8a6352d35acc5f449b1a00251763341a6ec1ea12e680ded6a23381d6e` |
| Build hash | `231517634d44c24bdd0a945f44fbf6e291845558127bfc1ceac99b9e3b602b29` |
| Registry ABI | v1 |
| Compiler / runtime package | 0.6.0 |
| Protocol spec version | 1.0.0 |

`docs/generated/*.md` is **compiler-emitted documentation**. It can lag the
registries. **Do not treat those markdown files as counts authority.** Do not
hand-edit them. Recompile to refresh them.

## YAML corpus

Root protocol inputs (compiled):

- `00_protocol-manifest.yaml` … `13_compiler-adr.yaml`
- `compiler.yaml`, `hybrid-boundary.yaml`, `projection-engine.yaml`
- `acceptance-tests.yaml`, `phase_j_protocol_closure.yaml`, `VERSION_AUTHORITY.yaml`
- `domains/*.yaml`, `compiler/*.yaml`

Constitutional layers L0–L7 remain as specified in `00_protocol-manifest.yaml`.

## Compiler

Package: `packages/compiler`.

Pipeline: discovery → parse → validate → resolve → transform → generate → certify → report.

Fail-closed behavior that is live in the validator / IR builder:

- Commands must live in the authoritative `commands:` map of `03_command-catalog.yaml`. Definitions outside that map fail compilation (AMD-0005 class).
- **REF-006**: domain-file command definitions absent from the authoritative map are reported (authority audit).
- **REF-008**: every machine transition `trigger` must resolve to a catalog event. Prose / command-name triggers fail the build. `emitted_events` must resolve likewise.
- Unresolved machine→command and command→event references are errors, not warnings.

Generated authority (do not edit):

- `generated/sovr-ir.json`
- `generated/registries/*.registry.json` + `registry.manifest.json`
- `generated/compiler-manifest.yaml`, `generated/compiler-certification.json`
- `generated/src/**`, `generated/openapi.json`, TLA+ under `generated/verification/tla/`

`generated/COMPILER_RUNTIME_COVERAGE.yaml` currently reports 118/118 commands
generated, 47/47 machines generated, 0 runtime bridges, 100% generated behavior.

## Runtime

Package: `packages/runtime`.

Boot loads compiled registries through
`packages/runtime/src/authority/authority-loader.ts`
(`JsonRegistryLoader`). Integrity is checked before use.

The kernel:

1. Accepts a catalog command.
2. Enforces identity / capability / constitutional gates (fail-closed).
3. Executes the compiled state machine (event-triggered transitions only).
4. Appends events to the event store (INV-001).
5. Materializes projections from the projection registry.

Projections are **registry-driven**. Hand-written models that still exist keep
precedence; remaining compiled definitions run through `GenericEventProjection`.
`vault_asset_view` is a compiled projection target (projection convergence
closed that gap).

Treasury / ledger / vault machines are event-bound (no prose triggers).

Ledger adapters (including TigerBeetle) exist under
`packages/runtime/src/ledger/` and `src/adapters/`. They are **not** the
protocol source of truth. Connecting or changing ledger integration is out of
scope for documentation and is a later engineering step.

## Simulation and integration (current)

Simulation corpus: `governance/simulation/scenarios/SIM-001` … `SIM-010`
(including AMD-0005 commercial SIM-008/009 and SIM-010 imbalance negative).

Runtime simulation tests live in `packages/runtime/src/simulation/__tests__/`
(23 files). CHANGELOG at this commit records 23/23 simulation suites green
and live-server integration 26/26 after projection convergence.

TigerBeetle suites remain environmental (host-specific paths) and are **not**
claimed as certified in this documentation pass.

## What this architecture is not

Do not describe the current system as if:

- the runtime parses YAML
- generated files are hand-maintained
- commands may exist outside the authoritative command map
- machine transitions may use arbitrary prose triggers
- projections are only manually wired
- AMD-0005 is unmaterialized
- Treasury still depends on prose triggers
- `vault_asset_view` is an unresolved projection gap
- old counts (105 commands / 259 events / 43 machines / 16 projections) or
  old build hashes (`6e97ae16…`, `18c55c32…`, `7a3ed4ce…`, `96a0b251…`) are current

Those statements belong only in `docs/history/` as remediation records.
