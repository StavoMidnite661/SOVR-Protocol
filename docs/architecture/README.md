# SOVR Architecture Documentation

This directory contains the official visual and textual architecture views for the SOVR Financial OS.

## Primary Diagrams

| Diagram | Purpose | Files |
|---------|---------|-------|
| **Connection Model** | How third parties, frontends, and external systems connect to the central kernel | `connection-model.mmd`, `connection-model.svg` |
| **End-to-End Sequence** | Full lifecycle of a treasury transfer with settlement | `sequence-treasury-transfer.mmd` |
| **C4 Context** | High-level system context and external actors | `c4-context.mmd` |
| **Build Provenance** | How the unfakeable build_hash chain is created and verified | `build-provenance.mmd` |

## Recommended Order for Readers

1. Start with the **Connection Model** (main integration view).
2. Review the **Sequence Diagram** for a concrete transaction flow.
3. Use the **C4 Context** for executive / stakeholder overview.
4. Study **Build Provenance** to understand reproducibility and trust.

## Live References

- **Authoritative text + diagrams**: [PROJECT_STATUS_2026-07-22.yaml](../../PROJECT_STATUS_2026-07-22.yaml) → `integration_surfaces`
- **Detailed guide**: [PROTOCOL_API_SERVICE_GUIDE.md](../../PROTOCOL_API_SERVICE_GUIDE.md)
- **Quick start**: [README.md](../../README.md)

All diagrams are maintained as Mermaid source for easy editing and version control.

---

**Last updated**: 2026-07-22 (Phase J — Runtime Live)