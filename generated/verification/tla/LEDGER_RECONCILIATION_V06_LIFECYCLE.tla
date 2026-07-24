---------------- MODULE LEDGER_RECONCILIATION_V06_LIFECYCLE ----------------
* SOVR Financial OS — Generated TLA+ Model
* Compiler: 0.6.0 Protocol: 1.0.0
* Provenance: ledger_reconciliation_v06_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, ledger_balanced, authority_validated

States == {"ACTIVE"}

Init == 
    /\ state = "ACTIVE"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE

0 == 
    /\ state = "ACTIVE"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "ACTIVE"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: LEDGER_RECONCILIATION_STARTED

1 == 
    /\ state = "ACTIVE"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "ACTIVE"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: LEDGER_RECONCILIATION_COMPLETED

Next == 
    0 \/ 1

* Invariant 1: State must always be in defined States
TypeOK == state \in States

* Invariant 2: INV-002 Double Entry balance holds
DoubleEntryBalance == ledger_balanced = TRUE

* Invariant 3: INV-003 Actor never exceeds authority
AuthorityBound == authority_validated = TRUE

Spec == Init /\ [][Next]_<<state, ledger_balanced, authority_validated>>

=====================================================