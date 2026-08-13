---------------- MODULE PAYMENT_REQUEST_LIFECYCLE ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: payment_request_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"CANCELLED", "COMPENSATING", "CONFIRMING", "EXECUTING", "FAILED", "PLANNING", "PREPARING", "RECEIVED", "RECONCILING", "REVERSED", "ROUTING", "SETTLED"}

FinalStates == {"CANCELLED", "REVERSED", "SETTLED"}

Init == 
    /\ state = "RECEIVED"
    /\ visited = {"RECEIVED"}

COMPENSATING_TO_REVERSED == 
    /\ state = "COMPENSATING"
    /\ state' = "REVERSED"
    /\ visited' = visited \cup {"REVERSED"}
\* Trigger: 20

CONFIRMING_TO_COMPENSATING == 
    /\ state = "CONFIRMING"
    /\ state' = "COMPENSATING"
    /\ visited' = visited \cup {"COMPENSATING"}
\* Trigger: PAYMENT_COMPENSATION_STARTED

CONFIRMING_TO_FAILED == 
    /\ state = "CONFIRMING"
    /\ state' = "FAILED"
    /\ visited' = visited \cup {"FAILED"}
\* Trigger: 15

CONFIRMING_TO_RECONCILING == 
    /\ state = "CONFIRMING"
    /\ state' = "RECONCILING"
    /\ visited' = visited \cup {"RECONCILING"}
\* Trigger: 14

EXECUTING_TO_COMPENSATING == 
    /\ state = "EXECUTING"
    /\ state' = "COMPENSATING"
    /\ visited' = visited \cup {"COMPENSATING"}
\* Trigger: PAYMENT_COMPENSATION_STARTED

EXECUTING_TO_CONFIRMING == 
    /\ state = "EXECUTING"
    /\ state' = "CONFIRMING"
    /\ visited' = visited \cup {"CONFIRMING"}
\* Trigger: 10

EXECUTING_TO_FAILED == 
    /\ state = "EXECUTING"
    /\ state' = "FAILED"
    /\ visited' = visited \cup {"FAILED"}
\* Trigger: 11

EXECUTING_TO_FAILED_2 == 
    /\ state = "EXECUTING"
    /\ state' = "FAILED"
    /\ visited' = visited \cup {"FAILED"}
\* Trigger: 12

FAILED_TO_COMPENSATING == 
    /\ state = "FAILED"
    /\ state' = "COMPENSATING"
    /\ visited' = visited \cup {"COMPENSATING"}
\* Trigger: PAYMENT_COMPENSATION_STARTED

PLANNING_TO_CANCELLED == 
    /\ state = "PLANNING"
    /\ state' = "CANCELLED"
    /\ visited' = visited \cup {"CANCELLED"}
\* Trigger: PAYMENT_REQUEST_CANCELLED

PLANNING_TO_FAILED == 
    /\ state = "PLANNING"
    /\ state' = "FAILED"
    /\ visited' = visited \cup {"FAILED"}
\* Trigger: 3

PLANNING_TO_ROUTING == 
    /\ state = "PLANNING"
    /\ state' = "ROUTING"
    /\ visited' = visited \cup {"ROUTING"}
\* Trigger: 2

PREPARING_TO_EXECUTING == 
    /\ state = "PREPARING"
    /\ state' = "EXECUTING"
    /\ visited' = visited \cup {"EXECUTING"}
\* Trigger: 8

PREPARING_TO_FAILED == 
    /\ state = "PREPARING"
    /\ state' = "FAILED"
    /\ visited' = visited \cup {"FAILED"}
\* Trigger: 9

RECEIVED_TO_CANCELLED == 
    /\ state = "RECEIVED"
    /\ state' = "CANCELLED"
    /\ visited' = visited \cup {"CANCELLED"}
\* Trigger: PAYMENT_REQUEST_CANCELLED

RECEIVED_TO_PLANNING == 
    /\ state = "RECEIVED"
    /\ state' = "PLANNING"
    /\ visited' = visited \cup {"PLANNING"}
\* Trigger: PAYMENT_EXECUTION_PLANNED

RECONCILING_TO_SETTLED == 
    /\ state = "RECONCILING"
    /\ state' = "SETTLED"
    /\ visited' = visited \cup {"SETTLED"}
\* Trigger: 17

RECONCILING_TO_SETTLED_2 == 
    /\ state = "RECONCILING"
    /\ state' = "SETTLED"
    /\ visited' = visited \cup {"SETTLED"}
\* Trigger: PAYMENT_RECEIPT_ISSUED

ROUTING_TO_CANCELLED == 
    /\ state = "ROUTING"
    /\ state' = "CANCELLED"
    /\ visited' = visited \cup {"CANCELLED"}
\* Trigger: PAYMENT_REQUEST_CANCELLED

ROUTING_TO_FAILED == 
    /\ state = "ROUTING"
    /\ state' = "FAILED"
    /\ visited' = visited \cup {"FAILED"}
\* Trigger: 6

ROUTING_TO_PREPARING == 
    /\ state = "ROUTING"
    /\ state' = "PREPARING"
    /\ visited' = visited \cup {"PREPARING"}
\* Trigger: PAYMENT_EXECUTION_STARTED

Terminated == 
    /\ state \in FinalStates
    /\ UNCHANGED <<state, visited>>

Next == 
    COMPENSATING_TO_REVERSED \/ CONFIRMING_TO_COMPENSATING \/ CONFIRMING_TO_FAILED \/ CONFIRMING_TO_RECONCILING \/ EXECUTING_TO_COMPENSATING \/ EXECUTING_TO_CONFIRMING \/ EXECUTING_TO_FAILED \/ EXECUTING_TO_FAILED_2 \/ FAILED_TO_COMPENSATING \/ PLANNING_TO_CANCELLED \/ PLANNING_TO_FAILED \/ PLANNING_TO_ROUTING \/ PREPARING_TO_EXECUTING \/ PREPARING_TO_FAILED \/ RECEIVED_TO_CANCELLED \/ RECEIVED_TO_PLANNING \/ RECONCILING_TO_SETTLED \/ RECONCILING_TO_SETTLED_2 \/ ROUTING_TO_CANCELLED \/ ROUTING_TO_FAILED \/ ROUTING_TO_PREPARING \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == <>(state \in FinalStates)

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================