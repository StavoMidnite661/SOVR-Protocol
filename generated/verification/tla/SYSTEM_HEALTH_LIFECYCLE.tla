---------------- MODULE SYSTEM_HEALTH_LIFECYCLE ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: system_health_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"DEGRADED", "HALTED", "HEALTHY", "UNKNOWN"}

FinalStates == {"HALTED"}

Init == 
    /\ state = "HEALTHY"
    /\ visited = {"HEALTHY"}

DEGRADED_TO_HALTED == 
    /\ state = "DEGRADED"
    /\ state' = "HALTED"
    /\ visited' = visited \cup {"HALTED"}
\* Trigger: GOVERNANCE_EMERGENCY_HALT

DEGRADED_TO_HEALTHY == 
    /\ state = "DEGRADED"
    /\ state' = "HEALTHY"
    /\ visited' = visited \cup {"HEALTHY"}
\* Trigger: 1

HEALTHY_TO_DEGRADED == 
    /\ state = "HEALTHY"
    /\ state' = "DEGRADED"
    /\ visited' = visited \cup {"DEGRADED"}
\* Trigger: 0

HEALTHY_TO_HALTED == 
    /\ state = "HEALTHY"
    /\ state' = "HALTED"
    /\ visited' = visited \cup {"HALTED"}
\* Trigger: GOVERNANCE_EMERGENCY_HALT

HEALTHY_TO_UNKNOWN == 
    /\ state = "HEALTHY"
    /\ state' = "UNKNOWN"
    /\ visited' = visited \cup {"UNKNOWN"}
\* Trigger: 4

UNKNOWN_TO_HEALTHY == 
    /\ state = "UNKNOWN"
    /\ state' = "HEALTHY"
    /\ visited' = visited \cup {"HEALTHY"}
\* Trigger: 5

Terminated == 
    /\ state \in FinalStates
    /\ UNCHANGED <<state, visited>>

Next == 
    DEGRADED_TO_HALTED \/ DEGRADED_TO_HEALTHY \/ HEALTHY_TO_DEGRADED \/ HEALTHY_TO_HALTED \/ HEALTHY_TO_UNKNOWN \/ UNKNOWN_TO_HEALTHY \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == <>(state \in FinalStates)

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================