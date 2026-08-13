# Documentation inventory and rules

Completed as a documentation-only alignment against commit `6f2f417`
(implementation truth). Classification below is what was applied.

## Rules

1. YAML + compiler + generated registries are truth. Docs follow.
2. Do not invent architecture in markdown.
3. Prefer one authoritative document over overlapping guides.
4. Forensic reports are archived, not deleted.
5. Compiler-generated markdown under `docs/generated/` and `generated/docs/`
   is not hand-edited.

## KEEP

| Document | Reason |
| --- | --- |
| `README.md` | Entry point (rewritten to current architecture). |
| `CHANGELOG.md` | Recent unreleased notes match AMD-0005 / machines / projections. |
| `docs/ARCHITECTURE.md` | Single architecture authority. |
| `docs/DEVELOPMENT.md` | Minimum operate/extend guide. |
| `docs/DOCUMENTATION.md` | This inventory. |
| `docs/history/README.md` | Banner for archived evidence. |
| `docs/generated/*` | Compiler-emitted refs (stale vs registries; do not hand-edit). |
| `generated/docs/topology.md` | Compiler-emitted. |

## UPDATE

Applied in this pass:

- `README.md`
- `CHANGELOG.md` (header + pointer; unreleased sections retained)
- `packages/runtime/src/server/README.md`

## ARCHIVE → `docs/history/`

Forensic, phase, audit, certification, incident, and superseded design
records. See that directory.

## DELETE

Obsolete, redundant, or misleading human docs with no forensic obligation
(marketing scorecards already covered by archived certification; overlapping
guides/runbooks/roadmaps that described the old runtime-parses-YAML /
hand-wired projection model). Graph report under `graphify-out/` is a tool
byproduct, not protocol documentation.

Protocol YAML, compiler contracts, generated JSON/YAML authority, tests, and
source comments that *implement* behavior were not deleted.
