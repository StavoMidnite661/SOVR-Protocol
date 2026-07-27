---------------- MODULE VAULT_COLLATERAL_LIFECYCLE ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: vault_collateral_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"ACTIVE", "LIQUIDATED", "LIQUIDATING", "MARGIN_CALL", "PROPOSED", "RELEASED"}

FinalStates == {"LIQUIDATED", "RELEASED"}

Init == 
    /\ state = "PROPOSED"
    /\ visited = {"PROPOSED"}

ACTIVE_TO_MARGIN_CALL == 
    /\ state = "ACTIVE"
    /\ state' = "MARGIN_CALL"
    /\ visited' = visited \cup {"MARGIN_CALL"}
\* Trigger: VAULT_COLLATERAL_MARGIN_CALL

ACTIVE_TO_RELEASED == 
    /\ state = "ACTIVE"
    /\ state' = "RELEASED"
    /\ visited' = visited \cup {"RELEASED"}
\* Trigger: VAULT_COLLATERAL_RELEASED

LIQUIDATING_TO_LIQUIDATED == 
    /\ state = "LIQUIDATING"
    /\ state' = "LIQUIDATED"
    /\ visited' = visited \cup {"LIQUIDATED"}
\* Trigger: LIQUIDATION_COMPLETED

LIQUIDATING_TO_RELEASED == 
    /\ state = "LIQUIDATING"
    /\ state' = "RELEASED"
    /\ visited' = visited \cup {"RELEASED"}
\* Trigger: LIQUIDATION_CANCELLED

MARGIN_CALL_TO_ACTIVE == 
    /\ state = "MARGIN_CALL"
    /\ state' = "ACTIVE"
    /\ visited' = visited \cup {"ACTIVE"}
\* Trigger: VAULT_COLLATERAL_REVALUED

MARGIN_CALL_TO_LIQUIDATING == 
    /\ state = "MARGIN_CALL"
    /\ state' = "LIQUIDATING"
    /\ visited' = visited \cup {"LIQUIDATING"}
\* Trigger: MARGIN_CALL_TIMEOUT

MARGIN_CALL_TO_RELEASED == 
    /\ state = "MARGIN_CALL"
    /\ state' = "RELEASED"
    /\ visited' = visited \cup {"RELEASED"}
\* Trigger: VAULT_COLLATERAL_RELEASED

PROPOSED_TO_ACTIVE == 
    /\ state = "PROPOSED"
    /\ state' = "ACTIVE"
    /\ visited' = visited \cup {"ACTIVE"}
\* Trigger: VAULT_COLLATERAL_ADDED

PROPOSED_TO_FAILED == 
    /\ state = "PROPOSED"
    /\ state' = "FAILED"
    /\ visited' = visited \cup {"FAILED"}
\* Trigger: VAULT_COLLATERAL_ADDITION_FAILED

Terminated == 
    /\ state \in FinalStates
    /\ UNCHANGED <<state, visited>>

Next == 
    ACTIVE_TO_MARGIN_CALL \/ ACTIVE_TO_RELEASED \/ LIQUIDATING_TO_LIQUIDATED \/ LIQUIDATING_TO_RELEASED \/ MARGIN_CALL_TO_ACTIVE \/ MARGIN_CALL_TO_LIQUIDATING \/ MARGIN_CALL_TO_RELEASED \/ PROPOSED_TO_ACTIVE \/ PROPOSED_TO_FAILED \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == <>(state \in FinalStates)

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================