---------------- MODULE VAULT_RESERVATION_LIFECYCLE ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: vault_reservation_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"ACTIVE", "CONSUMED", "EXPIRED", "FAILED", "PENDING", "RELEASED"}

FinalStates == {"EXPIRED", "FAILED"}

Init == 
    /\ state = "PENDING"
    /\ visited = {"PENDING"}

ACTIVE_TO_CONSUMED == 
    /\ state = "ACTIVE"
    /\ state' = "CONSUMED"
    /\ visited' = visited \cup {"CONSUMED"}
\* Trigger: CONSUMING_TRANSACTION_COMPLETED

ACTIVE_TO_EXPIRED == 
    /\ state = "ACTIVE"
    /\ state' = "EXPIRED"
    /\ visited' = visited \cup {"EXPIRED"}
\* Trigger: VAULT_RESERVE_EXPIRED

ACTIVE_TO_RELEASED == 
    /\ state = "ACTIVE"
    /\ state' = "RELEASED"
    /\ visited' = visited \cup {"RELEASED"}
\* Trigger: VAULT_RESERVE_RELEASED

PENDING_TO_ACTIVE == 
    /\ state = "PENDING"
    /\ state' = "ACTIVE"
    /\ visited' = visited \cup {"ACTIVE"}
\* Trigger: VAULT_RESERVE_LOCKED

PENDING_TO_EXPIRED == 
    /\ state = "PENDING"
    /\ state' = "EXPIRED"
    /\ visited' = visited \cup {"EXPIRED"}
\* Trigger: VAULT_RESERVE_EXPIRED

PENDING_TO_FAILED == 
    /\ state = "PENDING"
    /\ state' = "FAILED"
    /\ visited' = visited \cup {"FAILED"}
\* Trigger: VAULT_RESERVE_CREATION_FAILED

PENDING_TO_RELEASED == 
    /\ state = "PENDING"
    /\ state' = "RELEASED"
    /\ visited' = visited \cup {"RELEASED"}
\* Trigger: VAULT_RESERVE_RELEASED

Terminated == 
    /\ state \in FinalStates
    /\ UNCHANGED <<state, visited>>

Next == 
    ACTIVE_TO_CONSUMED \/ ACTIVE_TO_EXPIRED \/ ACTIVE_TO_RELEASED \/ PENDING_TO_ACTIVE \/ PENDING_TO_EXPIRED \/ PENDING_TO_FAILED \/ PENDING_TO_RELEASED \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == <>(state \in FinalStates)

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================