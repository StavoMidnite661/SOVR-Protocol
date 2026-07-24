---------------- MODULE POLICY_EVALUATION_LIFECYCLE ----------------
* SOVR Financial OS — Generated TLA+ Model
* Compiler: 0.6.0 Protocol: 1.0.0
* Provenance: policy_evaluation_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, ledger_balanced, authority_validated

States == {"ARCHIVED", "COMPUTING_DECISION", "DECISION_RENDERED", "EVALUATING_RULES", "GATHERING_CONTEXT", "IDLE"}

Init == 
    /\ state = "IDLE"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE

ACTIVE_TO_COMPLETED == 
    /\ state = "ACTIVE"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "COMPLETED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: COMPLETE

ACTIVE_TO_FAILED == 
    /\ state = "ACTIVE"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FAILED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: FAIL

INIT_TO_ACTIVE == 
    /\ state = "INIT"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "ACTIVE"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: ACTIVATE

Next == 
    ACTIVE_TO_COMPLETED \/ ACTIVE_TO_FAILED \/ INIT_TO_ACTIVE

* Invariant 1: State must always be in defined States
TypeOK == state \in States

* Invariant 2: INV-002 Double Entry balance holds
DoubleEntryBalance == ledger_balanced = TRUE

* Invariant 3: INV-003 Actor never exceeds authority
AuthorityBound == authority_validated = TRUE

Spec == Init /\ [][Next]_<<state, ledger_balanced, authority_validated>>

=====================================================