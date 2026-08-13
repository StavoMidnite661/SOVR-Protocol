---------------- MODULE TREASURY_TRANSFER_LIFECYCLE ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: treasury_transfer_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"AUTHORIZED", "COMPENSATION_REQUIRED", "EXECUTING", "EXPIRED", "FAILED", "PENDING_SETTLEMENT", "REJECTED", "REQUESTED", "RESERVED", "SETTLED", "UNKNOWN_EXTERNAL_STATE"}

FinalStates == {"EXPIRED", "REJECTED", "SETTLED"}

Init == 
    /\ state = "REQUESTED"
    /\ visited = {"REQUESTED"}

AUTHORIZED_TO_REJECTED == 
    /\ state = "AUTHORIZED"
    /\ state' = "REJECTED"
    /\ visited' = visited \cup {"REJECTED"}
\* Trigger: TREASURY_TRANSFER_REJECTED

AUTHORIZED_TO_RESERVED == 
    /\ state = "AUTHORIZED"
    /\ state' = "RESERVED"
    /\ visited' = visited \cup {"RESERVED"}
\* Trigger: TREASURY_TRANSFER_RESERVED

EXECUTING_TO_FAILED == 
    /\ state = "EXECUTING"
    /\ state' = "FAILED"
    /\ visited' = visited \cup {"FAILED"}
\* Trigger: TREASURY_TRANSFER_FAILED

EXECUTING_TO_SETTLED == 
    /\ state = "EXECUTING"
    /\ state' = "SETTLED"
    /\ visited' = visited \cup {"SETTLED"}
\* Trigger: TREASURY_TRANSFER_SETTLED

FAILED_TO_COMPENSATION_REQUIRED == 
    /\ state = "FAILED"
    /\ state' = "COMPENSATION_REQUIRED"
    /\ visited' = visited \cup {"COMPENSATION_REQUIRED"}
\* Trigger: TREASURY_TRANSFER_COMPENSATION_REQUIRED

PENDING_SETTLEMENT_TO_FAILED == 
    /\ state = "PENDING_SETTLEMENT"
    /\ state' = "FAILED"
    /\ visited' = visited \cup {"FAILED"}
\* Trigger: TREASURY_TRANSFER_FAILED

PENDING_SETTLEMENT_TO_SETTLED == 
    /\ state = "PENDING_SETTLEMENT"
    /\ state' = "SETTLED"
    /\ visited' = visited \cup {"SETTLED"}
\* Trigger: TREASURY_TRANSFER_SETTLED

REQUESTED_TO_AUTHORIZED == 
    /\ state = "REQUESTED"
    /\ state' = "AUTHORIZED"
    /\ visited' = visited \cup {"AUTHORIZED"}
\* Trigger: TREASURY_TRANSFER_AUTHORIZED

REQUESTED_TO_EXPIRED == 
    /\ state = "REQUESTED"
    /\ state' = "EXPIRED"
    /\ visited' = visited \cup {"EXPIRED"}
\* Trigger: TREASURY_TRANSFER_EXPIRED

REQUESTED_TO_REJECTED == 
    /\ state = "REQUESTED"
    /\ state' = "REJECTED"
    /\ visited' = visited \cup {"REJECTED"}
\* Trigger: TREASURY_TRANSFER_REJECTED

RESERVED_TO_EXECUTING == 
    /\ state = "RESERVED"
    /\ state' = "EXECUTING"
    /\ visited' = visited \cup {"EXECUTING"}
\* Trigger: TREASURY_TRANSFER_EXECUTING

RESERVED_TO_EXPIRED == 
    /\ state = "RESERVED"
    /\ state' = "EXPIRED"
    /\ visited' = visited \cup {"EXPIRED"}
\* Trigger: TREASURY_TRANSFER_EXPIRED

SETTLED_TO_SETTLED == 
    /\ state = "SETTLED"
    /\ state' = "SETTLED"
    /\ visited' = visited \cup {"SETTLED"}
\* Trigger: TREASURY_SETTLEMENT_CONFIRMED

UNKNOWN_EXTERNAL_STATE_TO_COMPENSATION_REQUIRED == 
    /\ state = "UNKNOWN_EXTERNAL_STATE"
    /\ state' = "COMPENSATION_REQUIRED"
    /\ visited' = visited \cup {"COMPENSATION_REQUIRED"}
\* Trigger: TREASURY_TRANSFER_COMPENSATION_REQUIRED

UNKNOWN_EXTERNAL_STATE_TO_FAILED == 
    /\ state = "UNKNOWN_EXTERNAL_STATE"
    /\ state' = "FAILED"
    /\ visited' = visited \cup {"FAILED"}
\* Trigger: TREASURY_TRANSFER_FAILED

UNKNOWN_EXTERNAL_STATE_TO_SETTLED == 
    /\ state = "UNKNOWN_EXTERNAL_STATE"
    /\ state' = "SETTLED"
    /\ visited' = visited \cup {"SETTLED"}
\* Trigger: TREASURY_TRANSFER_SETTLED

Terminated == 
    /\ state \in FinalStates
    /\ UNCHANGED <<state, visited>>

Next == 
    AUTHORIZED_TO_REJECTED \/ AUTHORIZED_TO_RESERVED \/ EXECUTING_TO_FAILED \/ EXECUTING_TO_SETTLED \/ FAILED_TO_COMPENSATION_REQUIRED \/ PENDING_SETTLEMENT_TO_FAILED \/ PENDING_SETTLEMENT_TO_SETTLED \/ REQUESTED_TO_AUTHORIZED \/ REQUESTED_TO_EXPIRED \/ REQUESTED_TO_REJECTED \/ RESERVED_TO_EXECUTING \/ RESERVED_TO_EXPIRED \/ SETTLED_TO_SETTLED \/ UNKNOWN_EXTERNAL_STATE_TO_COMPENSATION_REQUIRED \/ UNKNOWN_EXTERNAL_STATE_TO_FAILED \/ UNKNOWN_EXTERNAL_STATE_TO_SETTLED \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == <>(state \in FinalStates)

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================