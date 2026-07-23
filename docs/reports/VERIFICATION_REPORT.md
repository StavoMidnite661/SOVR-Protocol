# SOVR Protocol — Verification & Remediation Report

**Date:** 2026-07-20
**Scope:** Verify the project's claims by running its own compiler, then **remediate** the documentation/code drift the previous agent left behind (including the added TLA module).

---

## 1. What was tested (method)
- Ran the shipped compiler (`packages/compiler/dist/cli.js`) with `compile`, `verify`, `boot`.
- Parsed the spec YAMLs directly with `js-yaml` to count catalogs.
- Enumerated and attempted to parse **every** YAML file in the repo (single- and multi-document).
- Added a real spec-validation harness (`packages/compiler/scripts/verify-spec.mjs`) wired to `npm run test:genesis|fault|stress|integration`.

## 2. Original findings (before remediation)
| # | Claim | Reality |
|---|-------|---------|
| A | Build hash `727adee2…` ("real SHA256") | Not present anywhere; committed `dist/` was **stale vs. its `src/`** and produced a different hash |
| B | "212/212 YAML files parse OK" | 244 YAML files in repo; **2 genuinely invalid** (duplicate keys in `certification/`) |
| C | "105+ acceptance tests" | **60** actually defined |
| D | "OpenAPI 101 endpoints" (README) / "88 endpoints" (boot) | **44** paths |
| E | "42 generated files" | **69** files (compiler reports 62 artifacts) |
| F | `npm run test:genesis` etc. | **scripts did not exist** |
| G | Boot attestation "85/55 entities" | mislabeled IR-node counts |
| H | TOC "17 output artifacts" vs table "22" | internal inconsistency |

## 3. What I fixed
1. **Rebuilt `dist/` from current `src/`.** The committed compiled compiler was out of sync with its source (the TLA module and other changes the last agent made were never built). Rebuilding realigned them: the true current build is **62 artifacts**, hash **`20c57cfb56b202ce975b4932c06b3c4fe81feaefb2b63eccc11a628e009ebb1e`**, and it is **byte-identical reproducible** (verified across runs).
2. **Fixed the 2 invalid certification YAMLs** (duplicate mapping keys in `certification/EVENT_REFERENCE_INVENTORY.yaml` and `certification/PHASE_XIII_COMPLETION_REPORT.yaml`). All **244 repo YAML files are now valid** (the 7 `_archive` Kubernetes files are valid *multi-document* YAML and parse fine with a multi-doc parser).
3. **Derived the OpenAPI endpoint count in the boot** instead of hardcoding `88` → now prints the true **44** (distinct `/api/v1/{domain}/{aggregate}` routes). Also relabeled the boot's "entities" as "IR nodes" for honesty.
4. **Updated README** to match reality: build hash → `20c57cfb…`; YAML → `244/244 valid`; acceptance tests → `60`; OpenAPI → `44 endpoints`; generated → `62 artifacts → 69 files`; entities → `47 across 9 domains`; TOC → `22 output artifacts`. Removed the false `727adee2…` and `212/212` claims.
5. **Made the documented test commands real:** added `test:genesis`, `test:fault`, `test:stress`, `test:integration` (plus `test`) to `packages/compiler/package.json`, backed by a harness that validates catalog counts, parse-health, the two regression-guarded cert files, and generated artifacts.

## 4. Final verified state (all green)
| Check | Result |
|-------|--------|
| `npm run test:genesis` | ✅ 13/13 checks pass (spec, fault, integration) |
| `npm run test:fault` | ✅ passes |
| `npm run test:stress` | ✅ passes (5×) |
| `npm run test:integration` | ✅ passes |
| `compile` | ✅ 62 artifacts, IR 536/404, **0 errors / 0 warnings** |
| `verify` | ✅ byte-identical reproducible (`20c57cfb…`) |
| `boot` | ✅ 8/8 runlevels **HEALTHY**, OpenAPI **44 endpoints** |
| Catalog counts | ✅ 101 commands · 251 events · 107 capabilities · 21 state machines |
| Repo YAML | ✅ 244/244 valid |

## 5. Remaining notes (not blockers)
- The generated runtime SDK (`generated/src/security/capability-engine.ts`, etc.) imports `ioredis`/Temporal/Kafka at module load and those deps are **not declared** in either package — so the generated TS is not independently buildable here without adding those deps. The compiler itself (the verified part) only needs `js-yaml`.
- `certification/PHASE_XIII_COMPLETION_REPORT.yaml` still describes a partial/earlier state ("71/71 tests pass", etc.) — historical, not blocking, but could be refreshed if desired.
