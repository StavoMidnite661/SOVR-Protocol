# TLA+ Coverage Dashboard (2026-07-22)

## Coverage Summary

| Area | Models | Properties Checked | Coverage | Notes |
|------|--------|--------------------|----------|-------|
| State Machines (21) | 21 | Deadlock freedom, terminal states | High | All generated |
| Constitutional Invariants | Partial | INV-001, INV-002 (basic) | Medium | Needs explicit encoding |
| Sagas | 6 | Compensation completeness | Medium | Generated |
| Capability Model | 0 | - | Low | Future |
| Event Immutability | Informal | - | - | Code + tests |

## Recommended Next Properties

- `[] (debits = credits)` after any ledger mutation (INV-002)
- No event modification after append (INV-001)
- Every saga eventually compensates or completes

## How to Improve Coverage

1. Add INV-00x as TLA+ invariants
2. Run TLC in CI on key models
3. Add a "verified properties" section to certification artifacts

**Current Status**: Models exist and are useful for design validation. Active model checking is recommended before production.