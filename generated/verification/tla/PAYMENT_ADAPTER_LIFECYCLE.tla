---------------- MODULE PAYMENT_ADAPTER_LIFECYCLE ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: payment_adapter_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"DISABLED", "ENABLED", "EXECUTING", "PREPARING"}

FinalStates == {"DISABLED"}

Init == 
    /\ state = "ENABLED"
    /\ visited = {"ENABLED"}

ENABLED_TO_DISABLED == 
    /\ state = "ENABLED"
    /\ state' = "DISABLED"
    /\ visited' = visited \cup {"DISABLED"}
\* Trigger: PAYMENT_ADAPTER_DISABLE

ENABLED_TO_PREPARING == 
    /\ state = "ENABLED"
    /\ state' = "PREPARING"
    /\ visited' = visited \cup {"PREPARING"}
\* Trigger: PAYMENT_EXECUTION_PREPARE

EXECUTING_TO_ENABLED == 
    /\ state = "EXECUTING"
    /\ state' = "ENABLED"
    /\ visited' = visited \cup {"ENABLED"}
\* Trigger: 2

PREPARING_TO_EXECUTING == 
    /\ state = "PREPARING"
    /\ state' = "EXECUTING"
    /\ visited' = visited \cup {"EXECUTING"}
\* Trigger: PAYMENT_EXECUTION_EXECUTE

Terminated == 
    /\ state \in FinalStates
    /\ UNCHANGED <<state, visited>>

Next == 
    ENABLED_TO_DISABLED \/ ENABLED_TO_PREPARING \/ EXECUTING_TO_ENABLED \/ PREPARING_TO_EXECUTING \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == <>(state \in FinalStates)

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================