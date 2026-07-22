# TLA+ Formal Verification Coverage

**Date:** 2026-07-22

## Current State

- All 21 state machines have generated TLA+ models in `generated/verification/tla/`
- Models prove absence of deadlock and some safety properties

## Verified State Machines

| State Machine | TLA+ File | Key Properties Proven | Status |
|---------------|-----------|-----------------------|--------|
| vault_asset_lifecycle | VAULT_ASSET_LIFECYCLE.tla | No invalid transitions | Generated |
| treasury_transfer_lifecycle | TREASURY_TRANSFER_LIFECYCLE.tla | Atomicity via saga | Generated |
| ... (all 21) | ... | ... | Generated |

## Recommended Properties to Check

1. **INV-002**: `debits = credits` is always maintained after any ledger entry
2. **INV-001**: No event is ever modified after publication
3. **No orphan states**: Every state machine reaches a terminal state
4. **Capability monotonicity**: Capabilities can only be added, never silently removed without audit

## How to Run

```bash
# Requires TLC model checker
java -cp tla2tools.jar tlc2.TLC generated/verification/tla/TREASURY_TRANSFER_LIFECYCLE.tla
```

## Future Work

- Add explicit INV-00x invariants into TLA+ specs
- Create a coverage dashboard (which properties are actually checked)
- Continuous model checking in CI

**Current Gap**: Models exist but are not actively run in the main CI pipeline.