---------------- MODULE AGENT_LIFECYCLE ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: agent_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"ACTIVE", "REGISTERED", "SUSPENDED", "TERMINATED"}

FinalStates == {"TERMINATED"}

Init == 
    /\ state = "REGISTERED"
    /\ visited = {"REGISTERED"}

ACTIVE_TO_SUSPENDED == 
    /\ state = "ACTIVE"
    /\ state' = "SUSPENDED"
    /\ visited' = visited \cup {"SUSPENDED"}
\* Trigger: AGENT_SUSPEND

ACTIVE_TO_TERMINATED == 
    /\ state = "ACTIVE"
    /\ state' = "TERMINATED"
    /\ visited' = visited \cup {"TERMINATED"}
\* Trigger: AGENT_TERMINATE

REGISTERED_TO_ACTIVE == 
    /\ state = "REGISTERED"
    /\ state' = "ACTIVE"
    /\ visited' = visited \cup {"ACTIVE"}
\* Trigger: AGENT_ACTIVATE

REGISTERED_TO_TERMINATED == 
    /\ state = "REGISTERED"
    /\ state' = "TERMINATED"
    /\ visited' = visited \cup {"TERMINATED"}
\* Trigger: AGENT_TERMINATE

SUSPENDED_TO_ACTIVE == 
    /\ state = "SUSPENDED"
    /\ state' = "ACTIVE"
    /\ visited' = visited \cup {"ACTIVE"}
\* Trigger: AGENT_ACTIVATE

SUSPENDED_TO_TERMINATED == 
    /\ state = "SUSPENDED"
    /\ state' = "TERMINATED"
    /\ visited' = visited \cup {"TERMINATED"}
\* Trigger: AGENT_TERMINATE

Terminated == 
    /\ state \in FinalStates
    /\ UNCHANGED <<state, visited>>

Next == 
    ACTIVE_TO_SUSPENDED \/ ACTIVE_TO_TERMINATED \/ REGISTERED_TO_ACTIVE \/ REGISTERED_TO_TERMINATED \/ SUSPENDED_TO_ACTIVE \/ SUSPENDED_TO_TERMINATED \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == <>(state \in FinalStates)

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================