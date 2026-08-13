---------------- MODULE VAULT_TRANSACTION_LIFECYCLE ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: vault_transaction_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"CLOSED", "CREATED", "DISBURSED", "FAILED", "FUNDED", "FUNDING_PENDING", "FUNDING_REQUESTED", "RELEASE_AUTHORIZED", "RELEASE_PENDING"}

FinalStates == {"CLOSED", "FAILED"}

Init == 
    /\ state = "CREATED"
    /\ visited = {"CREATED"}

CREATED_TO_FAILED == 
    /\ state = "CREATED"
    /\ state' = "FAILED"
    /\ visited' = visited \cup {"FAILED"}
\* Trigger: VAULT_TRANSACTION_FAILED

CREATED_TO_FUNDING_REQUESTED == 
    /\ state = "CREATED"
    /\ state' = "FUNDING_REQUESTED"
    /\ visited' = visited \cup {"FUNDING_REQUESTED"}
\* Trigger: VAULT_TRANSACTION_FUNDING_REQUESTED

DISBURSED_TO_CLOSED == 
    /\ state = "DISBURSED"
    /\ state' = "CLOSED"
    /\ visited' = visited \cup {"CLOSED"}
\* Trigger: VAULT_TRANSACTION_CLOSED

FUNDED_TO_RELEASE_PENDING == 
    /\ state = "FUNDED"
    /\ state' = "RELEASE_PENDING"
    /\ visited' = visited \cup {"RELEASE_PENDING"}
\* Trigger: VAULT_TRANSACTION_RELEASE_PENDING

FUNDING_PENDING_TO_FAILED == 
    /\ state = "FUNDING_PENDING"
    /\ state' = "FAILED"
    /\ visited' = visited \cup {"FAILED"}
\* Trigger: VAULT_TRANSACTION_FAILED

FUNDING_PENDING_TO_FUNDED == 
    /\ state = "FUNDING_PENDING"
    /\ state' = "FUNDED"
    /\ visited' = visited \cup {"FUNDED"}
\* Trigger: VAULT_TRANSACTION_FUNDED

FUNDING_REQUESTED_TO_FAILED == 
    /\ state = "FUNDING_REQUESTED"
    /\ state' = "FAILED"
    /\ visited' = visited \cup {"FAILED"}
\* Trigger: VAULT_TRANSACTION_FAILED

FUNDING_REQUESTED_TO_FUNDING_PENDING == 
    /\ state = "FUNDING_REQUESTED"
    /\ state' = "FUNDING_PENDING"
    /\ visited' = visited \cup {"FUNDING_PENDING"}
\* Trigger: VAULT_TRANSACTION_FUNDING_PENDING

RELEASE_AUTHORIZED_TO_DISBURSED == 
    /\ state = "RELEASE_AUTHORIZED"
    /\ state' = "DISBURSED"
    /\ visited' = visited \cup {"DISBURSED"}
\* Trigger: VAULT_TRANSACTION_DISBURSED

RELEASE_PENDING_TO_FAILED == 
    /\ state = "RELEASE_PENDING"
    /\ state' = "FAILED"
    /\ visited' = visited \cup {"FAILED"}
\* Trigger: VAULT_TRANSACTION_FAILED

RELEASE_PENDING_TO_RELEASE_AUTHORIZED == 
    /\ state = "RELEASE_PENDING"
    /\ state' = "RELEASE_AUTHORIZED"
    /\ visited' = visited \cup {"RELEASE_AUTHORIZED"}
\* Trigger: VAULT_TRANSACTION_RELEASE_AUTHORIZED

Terminated == 
    /\ state \in FinalStates
    /\ UNCHANGED <<state, visited>>

Next == 
    CREATED_TO_FAILED \/ CREATED_TO_FUNDING_REQUESTED \/ DISBURSED_TO_CLOSED \/ FUNDED_TO_RELEASE_PENDING \/ FUNDING_PENDING_TO_FAILED \/ FUNDING_PENDING_TO_FUNDED \/ FUNDING_REQUESTED_TO_FAILED \/ FUNDING_REQUESTED_TO_FUNDING_PENDING \/ RELEASE_AUTHORIZED_TO_DISBURSED \/ RELEASE_PENDING_TO_FAILED \/ RELEASE_PENDING_TO_RELEASE_AUTHORIZED \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == <>(state \in FinalStates)

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================