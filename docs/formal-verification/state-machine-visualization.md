# State Machine Visualization Example

## Treasury Transfer Lifecycle (Simplified)

```mermaid
stateDiagram-v2
    [*] --> REQUESTED
    REQUESTED --> AUTHORIZED : transfer.authorize
    AUTHORIZED --> RESERVED : vault.reserve.create (INV-007)
    RESERVED --> EXECUTING
    EXECUTING --> PENDING_SETTLEMENT
    PENDING_SETTLEMENT --> SETTLED : payment confirmed
    PENDING_SETTLEMENT --> FAILED
    FAILED --> COMPENSATION_REQUIRED
    COMPENSATION_REQUIRED --> COMPENSATED : saga compensation
    SETTLED --> [*]
    FAILED --> [*]

    note right of RESERVED
        INV-002 must hold before leaving this state
    end note
```

## Full 21 State Machines

See `05_state-machines.yaml` for complete definitions.

**Recommended Visuals to Generate:**
- Vault Asset Lifecycle (most complex)
- Payment Request Lifecycle
- Agent Execution Lifecycle (with escalation)

**Tooling Suggestion**: Use the existing TLA+ models + a visualizer, or generate PlantUML/Mermaid from the YAML state machines.