---------------- MODULE ESCROW_ACCOUNT_LIFECYCLE ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: escrow_account_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"CANCELLED", "CREATED", "FUNDED", "RELEASED"}

FinalStates == {"CANCELLED", "RELEASED"}

Init == 
    /\ state = "CREATED"
    /\ visited = {"CREATED"}

CREATED_TO_CANCELLED == 
    /\ state = "CREATED"
    /\ state' = "CANCELLED"
    /\ visited' = visited \cup {"CANCELLED"}
\* Trigger: ESCROW_ACCOUNT_CANCELLED

CREATED_TO_FUNDED == 
    /\ state = "CREATED"
    /\ state' = "FUNDED"
    /\ visited' = visited \cup {"FUNDED"}
\* Trigger: ESCROW_ACCOUNT_FUNDED

FUNDED_TO_CANCELLED == 
    /\ state = "FUNDED"
    /\ state' = "CANCELLED"
    /\ visited' = visited \cup {"CANCELLED"}
\* Trigger: ESCROW_ACCOUNT_CANCELLED

FUNDED_TO_RELEASED == 
    /\ state = "FUNDED"
    /\ state' = "RELEASED"
    /\ visited' = visited \cup {"RELEASED"}
\* Trigger: ESCROW_ACCOUNT_RELEASED

Terminated == 
    /\ state \in FinalStates
    /\ UNCHANGED <<state, visited>>

Next == 
    CREATED_TO_CANCELLED \/ CREATED_TO_FUNDED \/ FUNDED_TO_CANCELLED \/ FUNDED_TO_RELEASED \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == <>(state \in FinalStates)

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================