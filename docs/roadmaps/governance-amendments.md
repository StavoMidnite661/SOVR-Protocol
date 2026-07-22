# Governance Amendment Visual Workflow

```mermaid
flowchart LR
    A[Proposal Submitted] --> B[Review Board]
    B -->|Approved| C[Ratification Vote]
    B -->|Rejected| Z[Closed]
    C -->|Passed| D[Constitution Updated]
    C -->|Failed| Z
    D --> E[Runtime Reload<br/>(governance approval only)]
    E --> F[New Build Hash Generated]
```

## Key Articles

- Amendment process is defined in `11_governance-amendments.yaml`
- Protected articles require higher thresholds
- All amendments must be auditable events

**Visual Status**: This is the current intended flow. A more detailed state machine exists in the spec.