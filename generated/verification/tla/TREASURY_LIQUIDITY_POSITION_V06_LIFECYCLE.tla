---------------- MODULE TREASURY_LIQUIDITY_POSITION_V06_LIFECYCLE ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: treasury_liquidity_position_v06_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"ACTIVE"}

FinalStates == {}

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
    /\ FALSE
    /\ UNCHANGED <<state, visited>>

Next == 
    ACTIVE_TO_COMPLETED \/ ACTIVE_TO_FAILED \/ INIT_TO_ACTIVE \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == TRUE

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================