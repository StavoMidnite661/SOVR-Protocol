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
\* Trigger: POLICY_DENIED

AUTHORIZED_TO_RESERVED == 
    /\ state = "AUTHORIZED"
    /\ state' = "RESERVED"
    /\ visited' = visited \cup {"RESERVED"}
\* Trigger: VAULT_RESERVATION_LOCKED

EXECUTING_TO_FAILED == 
    /\ state = "EXECUTING"
    /\ state' = "FAILED"
    /\ visited' = visited \cup {"FAILED"}
\* Trigger: EXECUTION_ERROR

EXECUTING_TO_PENDING_SETTLEMENT == 
    /\ state = "EXECUTING"
    /\ state' = "PENDING_SETTLEMENT"
    /\ visited' = visited \cup {"PENDING_SETTLEMENT"}
\* Trigger: EXECUTION_COMPLETED__AWAITING_CONFIRMATION

EXECUTING_TO_SETTLED == 
    /\ state = "EXECUTING"
    /\ state' = "SETTLED"
    /\ visited' = visited \cup {"SETTLED"}
\* Trigger: INTERNAL_SETTLEMENT_CONFIRMED_DIRECTLY

EXECUTING_TO_UNKNOWN_EXTERNAL_STATE == 
    /\ state = "EXECUTING"
    /\ state' = "UNKNOWN_EXTERNAL_STATE"
    /\ visited' = visited \cup {"UNKNOWN_EXTERNAL_STATE"}
\* Trigger: EXTERNAL_TIMEOUT

FAILED_TO_COMPENSATION_REQUIRED == 
    /\ state = "FAILED"
    /\ state' = "COMPENSATION_REQUIRED"
    /\ visited' = visited \cup {"COMPENSATION_REQUIRED"}
\* Trigger: COMPENSATION_SAGA_INITIATED

PENDING_SETTLEMENT_TO_FAILED == 
    /\ state = "PENDING_SETTLEMENT"
    /\ state' = "FAILED"
    /\ visited' = visited \cup {"FAILED"}
\* Trigger: SETTLEMENT_FAILED

PENDING_SETTLEMENT_TO_SETTLED == 
    /\ state = "PENDING_SETTLEMENT"
    /\ state' = "SETTLED"
    /\ visited' = visited \cup {"SETTLED"}
\* Trigger: SETTLEMENT_CONFIRMED

PENDING_SETTLEMENT_TO_UNKNOWN_EXTERNAL_STATE == 
    /\ state = "PENDING_SETTLEMENT"
    /\ state' = "UNKNOWN_EXTERNAL_STATE"
    /\ visited' = visited \cup {"UNKNOWN_EXTERNAL_STATE"}
\* Trigger: TIMEOUT_OR_UNKNOWN_RESPONSE

REQUESTED_TO_AUTHORIZED == 
    /\ state = "REQUESTED"
    /\ state' = "AUTHORIZED"
    /\ visited' = visited \cup {"AUTHORIZED"}
\* Trigger: IDENTITY_CAPABILITY_POLICY_PASSED

REQUESTED_TO_EXPIRED == 
    /\ state = "REQUESTED"
    /\ state' = "EXPIRED"
    /\ visited' = visited \cup {"EXPIRED"}
\* Trigger: TIMEOUT

REQUESTED_TO_REJECTED == 
    /\ state = "REQUESTED"
    /\ state' = "REJECTED"
    /\ visited' = visited \cup {"REJECTED"}
\* Trigger: VALIDATION_FAILED

RESERVED_TO_EXECUTING == 
    /\ state = "RESERVED"
    /\ state' = "EXECUTING"
    /\ visited' = visited \cup {"EXECUTING"}
\* Trigger: EXECUTION_BEGINS

RESERVED_TO_EXPIRED == 
    /\ state = "RESERVED"
    /\ state' = "EXPIRED"
    /\ visited' = visited \cup {"EXPIRED"}
\* Trigger: VAULT_RESERVATION_EXPIRED

UNKNOWN_EXTERNAL_STATE_TO_COMPENSATION_REQUIRED == 
    /\ state = "UNKNOWN_EXTERNAL_STATE"
    /\ state' = "COMPENSATION_REQUIRED"
    /\ visited' = visited \cup {"COMPENSATION_REQUIRED"}
\* Trigger: GOVERNANCE_ORDERS_COMPENSATION

UNKNOWN_EXTERNAL_STATE_TO_FAILED == 
    /\ state = "UNKNOWN_EXTERNAL_STATE"
    /\ state' = "FAILED"
    /\ visited' = visited \cup {"FAILED"}
\* Trigger: FAILURE_CONFIRMED

UNKNOWN_EXTERNAL_STATE_TO_SETTLED == 
    /\ state = "UNKNOWN_EXTERNAL_STATE"
    /\ state' = "SETTLED"
    /\ visited' = visited \cup {"SETTLED"}
\* Trigger: LATE_CONFIRMATION_RECEIVED

Terminated == 
    /\ state \in FinalStates
    /\ UNCHANGED <<state, visited>>

Next == 
    AUTHORIZED_TO_REJECTED \/ AUTHORIZED_TO_RESERVED \/ EXECUTING_TO_FAILED \/ EXECUTING_TO_PENDING_SETTLEMENT \/ EXECUTING_TO_SETTLED \/ EXECUTING_TO_UNKNOWN_EXTERNAL_STATE \/ FAILED_TO_COMPENSATION_REQUIRED \/ PENDING_SETTLEMENT_TO_FAILED \/ PENDING_SETTLEMENT_TO_SETTLED \/ PENDING_SETTLEMENT_TO_UNKNOWN_EXTERNAL_STATE \/ REQUESTED_TO_AUTHORIZED \/ REQUESTED_TO_EXPIRED \/ REQUESTED_TO_REJECTED \/ RESERVED_TO_EXECUTING \/ RESERVED_TO_EXPIRED \/ UNKNOWN_EXTERNAL_STATE_TO_COMPENSATION_REQUIRED \/ UNKNOWN_EXTERNAL_STATE_TO_FAILED \/ UNKNOWN_EXTERNAL_STATE_TO_SETTLED \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == <>(state \in FinalStates)

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================