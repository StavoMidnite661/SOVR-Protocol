---------------- MODULE LEDGER_ACCOUNT_LIFECYCLE ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: ledger_account_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"ACTIVE", "CLOSED", "FROZEN"}

FinalStates == {"CLOSED", "FROZEN"}

Init == 
    /\ state = "ACTIVE"
    /\ visited = {"ACTIVE"}

ACTIVE_TO_CLOSED == 
    /\ state = "ACTIVE"
    /\ state' = "CLOSED"
    /\ visited' = visited \cup {"CLOSED"}
\* Trigger: LEDGER_PERIOD_CLOSE

ACTIVE_TO_FROZEN == 
    /\ state = "ACTIVE"
    /\ state' = "FROZEN"
    /\ visited' = visited \cup {"FROZEN"}
\* Trigger: LEDGER_ACCOUNT_FREEZE

Terminated == 
    /\ state \in FinalStates
    /\ UNCHANGED <<state, visited>>

Next == 
    ACTIVE_TO_CLOSED \/ ACTIVE_TO_FROZEN \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == <>(state \in FinalStates)

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================