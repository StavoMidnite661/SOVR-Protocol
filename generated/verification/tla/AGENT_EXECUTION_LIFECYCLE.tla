---------------- MODULE AGENT_EXECUTION_LIFECYCLE ----------------
* SOVR Financial OS — Generated TLA+ Model
* Compiler: 0.2.0-kernel-working Protocol: 1.0.0
* Provenance: agent_execution_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, ledger_balanced, authority_validated

States == {"INIT", "ACTIVE", "COMPLETED", "FAILED"}

Init == 
    /\ state = "INIT"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE

ACTIVATE == 
    /\ state = "INIT"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "ACTIVE"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>

COMPLETE == 
    /\ state = "ACTIVE"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "COMPLETED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>

FAIL == 
    /\ state = "ACTIVE"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FAILED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>

Next == 
    ACTIVATE \/ COMPLETE \/ FAIL

* Invariant 1: State must always be in defined States
TypeOK == state \in States

* Invariant 2: INV-002 Double Entry balance holds
DoubleEntryBalance == ledger_balanced = TRUE

* Invariant 3: INV-003 Actor never exceeds authority
AuthorityBound == authority_validated = TRUE

Spec == Init /\ [][Next]_<<state, ledger_balanced, authority_validated>>

=====================================================