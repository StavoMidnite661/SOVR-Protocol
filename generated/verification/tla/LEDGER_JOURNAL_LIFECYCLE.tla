---------------- MODULE LEDGER_JOURNAL_LIFECYCLE ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: ledger_journal_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"CREATED", "POSTED", "RECONCILED", "REJECTED", "SETTLED", "VALIDATING"}

FinalStates == {"REJECTED"}

Init == 
    /\ state = "CREATED"
    /\ visited = {"CREATED"}

CREATED_TO_REJECTED == 
    /\ state = "CREATED"
    /\ state' = "REJECTED"
    /\ visited' = visited \cup {"REJECTED"}
\* Trigger: TIMEOUT

CREATED_TO_VALIDATING == 
    /\ state = "CREATED"
    /\ state' = "VALIDATING"
    /\ visited' = visited \cup {"VALIDATING"}
\* Trigger: VALIDATION_STARTED

POSTED_TO_RECONCILED == 
    /\ state = "POSTED"
    /\ state' = "RECONCILED"
    /\ visited' = visited \cup {"RECONCILED"}
\* Trigger: RECONCILIATION_CONFIRMS

POSTED_TO_SETTLED == 
    /\ state = "POSTED"
    /\ state' = "SETTLED"
    /\ visited' = visited \cup {"SETTLED"}
\* Trigger: ORIGINATING_DOMAIN_CONFIRMS

SETTLED_TO_RECONCILED == 
    /\ state = "SETTLED"
    /\ state' = "RECONCILED"
    /\ visited' = visited \cup {"RECONCILED"}
\* Trigger: RECONCILIATION_CONFIRMS

VALIDATING_TO_POSTED == 
    /\ state = "VALIDATING"
    /\ state' = "POSTED"
    /\ visited' = visited \cup {"POSTED"}
\* Trigger: VALIDATION_PASSED

VALIDATING_TO_REJECTED == 
    /\ state = "VALIDATING"
    /\ state' = "REJECTED"
    /\ visited' = visited \cup {"REJECTED"}
\* Trigger: VALIDATION_FAILED

Terminated == 
    /\ state \in FinalStates
    /\ UNCHANGED <<state, visited>>

Next == 
    CREATED_TO_REJECTED \/ CREATED_TO_VALIDATING \/ POSTED_TO_RECONCILED \/ POSTED_TO_SETTLED \/ SETTLED_TO_RECONCILED \/ VALIDATING_TO_POSTED \/ VALIDATING_TO_REJECTED \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == <>(state \in FinalStates)

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================