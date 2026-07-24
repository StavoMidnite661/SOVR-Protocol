---------------- MODULE PAYMENT_ADAPTER_LIFECYCLE ----------------
* SOVR Financial OS — Generated TLA+ Model
* Compiler: 0.6.0 Protocol: 1.0.0
* Provenance: payment_adapter_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, ledger_balanced, authority_validated

States == {"DISABLED", "ENABLED", "EXECUTING", "PREPARING"}

Init == 
    /\ state = "ENABLED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE

0 == 
    /\ state = "ENABLED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "PREPARING"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: PAYMENT_EXECUTION_PREPARE

1 == 
    /\ state = "PREPARING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "EXECUTING"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: PAYMENT_EXECUTION_EXECUTE

2 == 
    /\ state = "EXECUTING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "ENABLED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 2

3 == 
    /\ state = "ENABLED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "DISABLED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: PAYMENT_ADAPTER_DISABLE

Next == 
    0 \/ 1 \/ 2 \/ 3

* Invariant 1: State must always be in defined States
TypeOK == state \in States

* Invariant 2: INV-002 Double Entry balance holds
DoubleEntryBalance == ledger_balanced = TRUE

* Invariant 3: INV-003 Actor never exceeds authority
AuthorityBound == authority_validated = TRUE

Spec == Init /\ [][Next]_<<state, ledger_balanced, authority_validated>>

=====================================================