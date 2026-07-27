---------------- MODULE SAGA_LIFECYCLE ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: saga_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"COMPENSATED", "COMPENSATING", "COMPLETED", "FAILED", "PENDING", "RUNNING"}

FinalStates == {"COMPENSATED", "COMPLETED", "FAILED"}

Init == 
    /\ state = "PENDING"
    /\ visited = {"PENDING"}

COMPENSATING_TO_COMPENSATED == 
    /\ state = "COMPENSATING"
    /\ state' = "COMPENSATED"
    /\ visited' = visited \cup {"COMPENSATED"}
\* Trigger: 4

FAILED_TO_COMPENSATING == 
    /\ state = "FAILED"
    /\ state' = "COMPENSATING"
    /\ visited' = visited \cup {"COMPENSATING"}
\* Trigger: SAGA_COMPENSATE

PENDING_TO_RUNNING == 
    /\ state = "PENDING"
    /\ state' = "RUNNING"
    /\ visited' = visited \cup {"RUNNING"}
\* Trigger: 0

RUNNING_TO_COMPLETED == 
    /\ state = "RUNNING"
    /\ state' = "COMPLETED"
    /\ visited' = visited \cup {"COMPLETED"}
\* Trigger: 1

RUNNING_TO_FAILED == 
    /\ state = "RUNNING"
    /\ state' = "FAILED"
    /\ visited' = visited \cup {"FAILED"}
\* Trigger: 2

Terminated == 
    /\ state \in FinalStates
    /\ UNCHANGED <<state, visited>>

Next == 
    COMPENSATING_TO_COMPENSATED \/ FAILED_TO_COMPENSATING \/ PENDING_TO_RUNNING \/ RUNNING_TO_COMPLETED \/ RUNNING_TO_FAILED \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == <>(state \in FinalStates)

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================