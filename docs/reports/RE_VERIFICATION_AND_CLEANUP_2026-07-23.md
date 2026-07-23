# SOVR Protocol — Re-Verification & Repository Cleanup Report

**Date:** 2026-07-23
**Branch:** `arena/019f9146-sovr-protocol` (from `4ca7e99`)
**Scope:** (1) Independently re-run every claim-bearing command the project documents to confirm the protocol does what it says. (2) Organize the repository — move audit/report/status clutter out of the root into `docs/` and `management/`, and fix every cross-reference.

This report does not re-derive the spec counts (commands/events/capabilities/etc.) — those are already exhaustively verified in [`VERIFIED_CLAIMS_AUDIT_2026-07-23.md`](./VERIFIED_CLAIMS_AUDIT_2026-07-23.md), and this session reproduced the same numbers byte-for-byte. This report focuses on **functional verification** (does it actually run?) and the **repository reorganization**.

---

## 1. Functional Verification (fresh clone-equivalent run)

| Step | Command | Result |
|------|---------|--------|
| Compiler build | `cd packages/compiler && node dist/cli.js compile` | ✅ 62 artifacts, `build_hash 20c57cfb56b202ce975b4932c06b3c4fe81feaefb2b63eccc11a628e009ebb1e`, 0 errors / 0 warnings |
| Reproducibility | `node dist/cli.js verify` | ✅ byte-identical hash confirmed |
| Boot sequence | `node dist/cli.js boot` | ✅ 8/8 runlevels HEALTHY, boot attestation written |
| Spec test suite | `npm run test:genesis` / `test:fault` / `test:stress` / `test:integration` (all four, via `scripts/verify-spec.mjs`) | ✅ all pass — 38/38 input YAML parse, 101 commands, 251 events, 107 capabilities, 21 state machines, 60 acceptance tests, 0 invalid YAML in the repo |
| Runtime build | `cd packages/runtime && npm install && npm run build` | ✅ clean TypeScript build, no errors |
| Runtime unit/integration tests | `npx vitest run` | ✅ 16/16 tests pass (identity session, vault asset registration, INV-002 double-entry rejection, ACH rail prepare→execute→confirm, capability grants, event stream, projections) |
| Live server | `PORT=3001 node dist/server/index.js` then `curl /health`, `/api/v1/manifest`, `/api/v1/boot-attestation` | ✅ `HEALTHY`, `build_hash` in manifest and boot-attestation match (`20c57cfb…`), 15 projections rebuilt, 107 capability definitions loaded |
| Example frontend | `npx tsx example-frontend/src/App.ts` against the live server above | ✅ Real HTTP round trip: boot-screen polls `/health` until HEALTHY, fetches `/api/v1/manifest`, opens a session (`identity.session`), registers a vault asset, reads back events + the `vault_asset_view` projection — all against the running Fastify server, not a mock |

**Conclusion:** The core claim of the project — "a spec-first YAML protocol that compiles deterministically into a running, auditable financial kernel with a live API and a working example frontend" — holds up under direct, independent execution. Nothing here was taken on faith from the README; every number above was reproduced live in this session.

### Known, previously-documented gaps (still true, not fixed in this session — out of scope for a docs/reorg pass)
- The generated runtime SDK types under `generated/src/**` are compiler output, not hand-maintained; some generated modules assume `ioredis`/`kafkajs` at import time (now present as real deps in `packages/runtime/package.json`, confirmed installable).
- Several `certification/*.yaml` files still describe earlier phases (e.g. Phase XIII interim numbers) and are explicitly marked historical — see `docs/reports/VERIFIED_CLAIMS_AUDIT_2026-07-23.md` §2 for the itemized list of which certification docs are current vs. historical.
- `management/DEPENDENCY_GRAPH.yaml` and `management/MILESTONES.yaml` are valid YAML mappings but are intentionally excluded from the compiler's frozen-spec frontier (`discoverProtocolInputs`) — they are project-management documents, not protocol inputs. This was already true before the reorg and is unchanged.

---

## 2. Repository Reorganization

**Problem:** The repository root had accumulated 6 dated audit reports, 3 long-form guides, and 4 project-status/milestone YAMLs — 13 files, none of which are compiler inputs — sitting alongside the 15 frozen protocol-specification YAML files that *are* compiler inputs. This made it hard to tell, at a glance, what is protocol law vs. project history/paperwork.

**What moved:**

| From (root) | To | Why |
|---|---|---|
| `AUDIT_REPORT_2026-07-18.md` | `docs/reports/` | Dated, historical audit — not a spec input |
| `COMPLETE_VERIFICATION_AUDIT.md` | `docs/reports/` | Dated, historical audit |
| `SOVR_FULL_AUDIT_2026-07-21.md` | `docs/reports/` | Dated, historical audit |
| `VERIFICATION_REPORT.md` | `docs/reports/` | Dated, historical audit |
| `WALL_TO_WALL_AUDIT_2026-07-22.md` | `docs/reports/` | Dated, historical audit |
| `VERIFIED_CLAIMS_AUDIT_2026-07-23.md` | `docs/reports/` | Current authoritative audit (kept alongside its predecessors for continuity) |
| `BOOT_SEQUENCE_GUIDE.md` | `docs/guides/` | Operator/developer guide, joins the existing `docs/guides/` directory |
| `KERNEL_WORKING_GUIDE.md` | `docs/guides/` | Same |
| `PROTOCOL_API_SERVICE_GUIDE.md` | `docs/guides/` | Same |
| `MILESTONES.yaml` | `management/` | Project-management artifact, joins the existing `management/` directory |
| `DEPENDENCY_GRAPH.yaml` | `management/` | Same |
| `DOMAIN_STATUS_MATRIX.yaml` | `management/` | Same (already marked `_deprecated: true`, superseded by `PROJECT_STATUS_2026-07-22.yaml`) |
| `PROJECT_STATUS_2026-07-22.yaml` | `management/` | The canonical "current state" document — belongs with the other management dashboards |

**What did not move (and why):** The 15 files that make up the compiler's frozen input frontier (`00_protocol-manifest.yaml` … `13_compiler-adr.yaml`, `acceptance-tests.yaml`, `compiler.yaml`, `hybrid-boundary.yaml`, `phase_j_protocol_closure.yaml`, `projection-engine.yaml`) stay at the root, because `packages/compiler/src/utils/yaml-loader.ts::discoverProtocolInputs()` enumerates root-level `*.yaml` files directly and already special-cases (excludes) status/report files by filename prefix. Moving the frozen spec files would require changing compiler logic; moving the status/report files does not, since they were already excluded from compilation — this reorg simply makes that exclusion visible in the directory layout too.

**Reference fixes:** Every Markdown link and every plain-text path mention across `README.md`, `docs/**`, `management/**`, `certification/**`, `containers/**/STATUS.yaml`, `containers/**/DEPENDENCIES.yaml`, and `protocol/BOOT_SEQUENCE.yaml` was updated to the new paths. Historical audit reports' *narrative prose* (e.g. "per `VERIFICATION_REPORT.md`") was intentionally left as-is inside those reports, since they are dated snapshots describing the repo layout as it existed on that day — rewriting history inside a historical document would be inaccurate.

**Verification after the move:** Re-ran the full pipeline (`compile` → `verify` → `boot` → `test:genesis/fault/stress/integration`) after the move. **`build_hash` is unchanged: `20c57cfb56b202ce975b4932c06b3c4fe81feaefb2b63eccc11a628e009ebb1e`.** The move touched zero files inside the compiler's 38-file input frontier, so reproducibility was never at risk — this was confirmed empirically, not just asserted.

### New root layout

The repository root now contains only: the 15 frozen protocol-specification YAML files, `README.md`, `.env.example`, `.gitignore`, and directories (`domains/`, `compiler/`, `protocol/`, `certification/`, `packages/`, `containers/`, `generated/`, `governance/`, `knowledge/`, `management/`, `docs/`, `snapshots/`, `_test_output/`, `_archive/`, `deployment/`, `example-frontend/`, `.github/`).
