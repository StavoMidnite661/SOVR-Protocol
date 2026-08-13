# SOVR Protocol

Spec-first financial protocol kernel.

**YAML is the protocol source of truth.**  
**The compiler is the only materialization path.**  
**Generated registries are compiled authority.**  
**The runtime loads registries. It does not parse YAML.**

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

Documentation is rewritten from the implementation. It does not drive the
architecture. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Live compiled authority

From `generated/registries` and `generated/compiler-certification.json`:

| | |
| --- | --- |
| Commands | 118 |
| Events | 292 |
| State machines | 47 |
| Capabilities | 127 |
| Projections | 57 |
| IR | 663 nodes / 516 edges |
| Build hash | `231517634d44c24bdd0a945f44fbf6e291845558127bfc1ceac99b9e3b602b29` |
| Registry ABI | v1 |
| Compiler / runtime | 0.6.0 |
| Protocol spec | 1.0.0 |

Enforced now: fail-closed compile, REF-006 command-map authority, REF-008
event-bound machine triggers, AMD-0005 commercial commands in the
authoritative map, treasury/machine canonicalization, registry-driven
projections (including `vault_asset_view`).

## Quick start

```bash
npm install
npm run build
npm run compile
PORT=3001 node packages/runtime/dist/server/index.js
```

Operator detail: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

## Repository map

| Path | Role |
| --- | --- |
| `00_`–`13_*.yaml`, `domains/`, `compiler/` | Protocol corpus |
| `packages/compiler` | Deterministic compiler |
| `packages/runtime` | Kernel, authority-loader, event store, projections |
| `generated/registries` | Compiled authority — do not edit |
| `generated/sovr-ir.json` | Canonical IR |
| `docs/` | Human docs for the *current* system |
| `docs/history/` | Forensic / remediation records only |

## Historical material

Phase reports, determinism forensics, old audits, and certification packets
live under [`docs/history/`](docs/history/README.md). They are marked:

```text
HISTORICAL / REMEDIATION RECORD
```

They are not descriptions of the current architecture.

## License

Proprietary — all rights reserved.
