---------------- MODULE AGENT_EXECUTION_LIFECYCLE ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: agent_execution_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"ACTIVE", "COMPLETED", "ESCALATED", "EXECUTING", "FAILED", "TERMINATED"}

FinalStates == {"TERMINATED"}

Init == 
    /\ state = "ACTIVE"
    /\ visited = {"ACTIVE"}

ACTIVE_TO_COMPLETED == 
    /\ state = "ACTIVE"
    /\ state' = "COMPLETED"
    /\ visited' = visited \cup {"COMPLETED"}
\* Trigger: COMPLETE

ACTIVE_TO_FAILED == 
    /\ state = "ACTIVE"
    /\ state' = "FAILED"
    /\ visited' = visited \cup {"FAILED"}
\* Trigger: FAIL

INIT_TO_ACTIVE == 
    /\ state = "INIT"
    /\ state' = "ACTIVE"
    /\ visited' = visited \cup {"ACTIVE"}
\* Trigger: ACTIVATE

Terminated == 
    /\ state \in FinalStates
    /\ UNCHANGED <<state, visited>>

Next == 
    ACTIVE_TO_COMPLETED \/ ACTIVE_TO_FAILED \/ INIT_TO_ACTIVE \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == <>(state \in FinalStates)

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================