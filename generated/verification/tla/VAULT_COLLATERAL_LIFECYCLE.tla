---------------- MODULE VAULT_COLLATERAL_LIFECYCLE ----------------
* SOVR Financial OS — Generated TLA+ Model
* Compiler: 0.6.0 Protocol: 1.0.0
* Provenance: vault_collateral_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, ledger_balanced, authority_validated

States == {"ACTIVE", "LIQUIDATED", "LIQUIDATING", "MARGIN_CALL", "PROPOSED", "RELEASED"}

Init == 
    /\ state = "PROPOSED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE

ACTIVE_TO_MARGIN_CALL == 
    /\ state = "ACTIVE"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "MARGIN_CALL"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_COLLATERAL_MARGIN_CALL

ACTIVE_TO_RELEASED == 
    /\ state = "ACTIVE"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "RELEASED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_COLLATERAL_RELEASED

LIQUIDATING_TO_LIQUIDATED == 
    /\ state = "LIQUIDATING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "LIQUIDATED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: LIQUIDATION_COMPLETED

LIQUIDATING_TO_RELEASED == 
    /\ state = "LIQUIDATING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "RELEASED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: LIQUIDATION_CANCELLED

MARGIN_CALL_TO_ACTIVE == 
    /\ state = "MARGIN_CALL"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "ACTIVE"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_COLLATERAL_REVALUED

MARGIN_CALL_TO_LIQUIDATING == 
    /\ state = "MARGIN_CALL"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "LIQUIDATING"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: MARGIN_CALL_TIMEOUT

MARGIN_CALL_TO_RELEASED == 
    /\ state = "MARGIN_CALL"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "RELEASED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_COLLATERAL_RELEASED

PROPOSED_TO_ACTIVE == 
    /\ state = "PROPOSED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "ACTIVE"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_COLLATERAL_ADDED

PROPOSED_TO_FAILED == 
    /\ state = "PROPOSED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FAILED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_COLLATERAL_ADDITION_FAILED

Next == 
    ACTIVE_TO_MARGIN_CALL \/ ACTIVE_TO_RELEASED \/ LIQUIDATING_TO_LIQUIDATED \/ LIQUIDATING_TO_RELEASED \/ MARGIN_CALL_TO_ACTIVE \/ MARGIN_CALL_TO_LIQUIDATING \/ MARGIN_CALL_TO_RELEASED \/ PROPOSED_TO_ACTIVE \/ PROPOSED_TO_FAILED

* Invariant 1: State must always be in defined States
TypeOK == state \in States

* Invariant 2: INV-002 Double Entry balance holds
DoubleEntryBalance == ledger_balanced = TRUE

* Invariant 3: INV-003 Actor never exceeds authority
AuthorityBound == authority_validated = TRUE

Spec == Init /\ [][Next]_<<state, ledger_balanced, authority_validated>>

=====================================================