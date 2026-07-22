# SOVR Architecture Documentation Index

**Last Updated:** 2026-07-22

## Core Diagrams

- **Connection Model** — Primary integration view (`connection-model.svg`)
- **L0–L7 Layered Architecture** — Constitutional layering rules
- **Build Provenance** — How the unfakeable chain is created
- **Treasury Transfer Sequence** — Full end-to-end example
- **C4 Context** — High-level system view for stakeholders

## Security & Formal

- `security/threat-model.md` — STRIDE analysis
- `security/hardening-checklist.md` — Production checklist
- `formal-verification/tla-coverage.md` — TLA+ status
- `formal-verification/state-machine-visualization.md`

## Operations & Deployment

- `deployment/topologies.md`
- `observability/metrics.md`
- `operations/operator-runbook.md`

## Compliance & Ecosystem

- `compliance/mapping.md`
- `roadmaps/sdk.md`
- `roadmaps/governance-amendments.md`
- `guides/third-party-cookbook.md`
- `guides/openapi-client-generation.md`

## Performance

- `performance/scalability.md`

## How to Navigate

1. Start with `../images/connection-model.svg`
2. Read the main `PROJECT_STATUS_2026-07-22.yaml` → `integration_surfaces` and `architecture`
3. Use the sequence diagram for concrete understanding
4. Refer to security and formal sections before any production deployment

All diagrams are available as editable `.mmd` (Mermaid) files.