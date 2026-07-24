---------------- MODULE ESCROW_ACCOUNT_LIFECYCLE ----------------
* SOVR Financial OS — Generated TLA+ Model
* Compiler: 0.6.0 Protocol: 1.0.0
* Provenance: escrow_account_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, ledger_balanced, authority_validated

States == {"CANCELLED", "CREATED", "FUNDED", "RELEASED"}

Init == 
    /\ state = "CREATED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE

CREATED_TO_CANCELLED == 
    /\ state = "CREATED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "CANCELLED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: ESCROW_ACCOUNT_CANCELLED

CREATED_TO_FUNDED == 
    /\ state = "CREATED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FUNDED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: ESCROW_ACCOUNT_FUNDED

FUNDED_TO_CANCELLED == 
    /\ state = "FUNDED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "CANCELLED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: ESCROW_ACCOUNT_CANCELLED

FUNDED_TO_RELEASED == 
    /\ state = "FUNDED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "RELEASED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: ESCROW_ACCOUNT_RELEASED

Next == 
    CREATED_TO_CANCELLED \/ CREATED_TO_FUNDED \/ FUNDED_TO_CANCELLED \/ FUNDED_TO_RELEASED

* Invariant 1: State must always be in defined States
TypeOK == state \in States

* Invariant 2: INV-002 Double Entry balance holds
DoubleEntryBalance == ledger_balanced = TRUE

* Invariant 3: INV-003 Actor never exceeds authority
AuthorityBound == authority_validated = TRUE

Spec == Init /\ [][Next]_<<state, ledger_balanced, authority_validated>>

=====================================================