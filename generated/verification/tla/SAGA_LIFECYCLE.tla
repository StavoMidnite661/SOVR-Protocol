---------------- MODULE SAGA_LIFECYCLE ----------------
* SOVR Financial OS — Generated TLA+ Model
* Compiler: 0.6.0 Protocol: 1.0.0
* Provenance: saga_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, ledger_balanced, authority_validated

States == {"COMPENSATED", "COMPENSATING", "COMPLETED", "FAILED", "PENDING", "RUNNING"}

Init == 
    /\ state = "PENDING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE

0 == 
    /\ state = "PENDING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "RUNNING"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 0

1 == 
    /\ state = "RUNNING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "COMPLETED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 1

2 == 
    /\ state = "RUNNING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FAILED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 2

3 == 
    /\ state = "FAILED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "COMPENSATING"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: SAGA_COMPENSATE

4 == 
    /\ state = "COMPENSATING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "COMPENSATED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 4

Next == 
    0 \/ 1 \/ 2 \/ 3 \/ 4

* Invariant 1: State must always be in defined States
TypeOK == state \in States

* Invariant 2: INV-002 Double Entry balance holds
DoubleEntryBalance == ledger_balanced = TRUE

* Invariant 3: INV-003 Actor never exceeds authority
AuthorityBound == authority_validated = TRUE

Spec == Init /\ [][Next]_<<state, ledger_balanced, authority_validated>>

=====================================================