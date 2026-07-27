---------------- MODULE VAULT_ASSET_LIFECYCLE ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: vault_asset_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"AVAILABLE", "CONSUMED", "IMPAIRED", "LOCKED", "RECONCILIATION_REQUIRED", "REGISTERED", "REJECTED", "RELEASED", "RESERVED", "VERIFIED"}

FinalStates == {"IMPAIRED", "REJECTED"}

Init == 
    /\ state = "REGISTERED"
    /\ visited = {"REGISTERED"}

AVAILABLE_TO_IMPAIRED == 
    /\ state = "AVAILABLE"
    /\ state' = "IMPAIRED"
    /\ visited' = visited \cup {"IMPAIRED"}
\* Trigger: VAULT_ASSET_IMPAIRED

AVAILABLE_TO_RESERVED == 
    /\ state = "AVAILABLE"
    /\ state' = "RESERVED"
    /\ visited' = visited \cup {"RESERVED"}
\* Trigger: VAULT_RESERVE_CREATED

CONSUMED_TO_AVAILABLE == 
    /\ state = "CONSUMED"
    /\ state' = "AVAILABLE"
    /\ visited' = visited \cup {"AVAILABLE"}
\* Trigger: AUTOMATIC

IMPAIRED_TO_AVAILABLE == 
    /\ state = "IMPAIRED"
    /\ state' = "AVAILABLE"
    /\ visited' = visited \cup {"AVAILABLE"}
\* Trigger: VAULT_VALUATION_UPDATED

LOCKED_TO_AVAILABLE == 
    /\ state = "LOCKED"
    /\ state' = "AVAILABLE"
    /\ visited' = visited \cup {"AVAILABLE"}
\* Trigger: VAULT_RESERVE_RELEASED

LOCKED_TO_CONSUMED == 
    /\ state = "LOCKED"
    /\ state' = "CONSUMED"
    /\ visited' = visited \cup {"CONSUMED"}
\* Trigger: TREASURY_TRANSFER_SETTLED

RECONCILIATION_REQUIRED_TO_AVAILABLE == 
    /\ state = "RECONCILIATION_REQUIRED"
    /\ state' = "AVAILABLE"
    /\ visited' = visited \cup {"AVAILABLE"}
\* Trigger: VAULT_RECONCILIATION_COMPLETED

RECONCILIATION_REQUIRED_TO_LOCKED == 
    /\ state = "RECONCILIATION_REQUIRED"
    /\ state' = "LOCKED"
    /\ visited' = visited \cup {"LOCKED"}
\* Trigger: VAULT_RECONCILIATION_COMPLETED

RECONCILIATION_REQUIRED_TO_VERIFIED == 
    /\ state = "RECONCILIATION_REQUIRED"
    /\ state' = "VERIFIED"
    /\ visited' = visited \cup {"VERIFIED"}
\* Trigger: VAULT_RECONCILIATION_COMPLETED

REGISTERED_TO_REJECTED == 
    /\ state = "REGISTERED"
    /\ state' = "REJECTED"
    /\ visited' = visited \cup {"REJECTED"}
\* Trigger: VAULT_ASSET_REJECTED

REGISTERED_TO_VERIFIED == 
    /\ state = "REGISTERED"
    /\ state' = "VERIFIED"
    /\ visited' = visited \cup {"VERIFIED"}
\* Trigger: VAULT_ASSET_VERIFIED

RELEASED_TO_AVAILABLE == 
    /\ state = "RELEASED"
    /\ state' = "AVAILABLE"
    /\ visited' = visited \cup {"AVAILABLE"}
\* Trigger: AUTOMATIC

RESERVED_TO_AVAILABLE == 
    /\ state = "RESERVED"
    /\ state' = "AVAILABLE"
    /\ visited' = visited \cup {"AVAILABLE"}
\* Trigger: VAULT_RESERVE_RELEASED

RESERVED_TO_IMPAIRED == 
    /\ state = "RESERVED"
    /\ state' = "IMPAIRED"
    /\ visited' = visited \cup {"IMPAIRED"}
\* Trigger: VAULT_ASSET_IMPAIRED

RESERVED_TO_LOCKED == 
    /\ state = "RESERVED"
    /\ state' = "LOCKED"
    /\ visited' = visited \cup {"LOCKED"}
\* Trigger: VAULT_RESERVE_LOCKED

RESERVED_TO_RECONCILIATION_REQUIRED == 
    /\ state = "RESERVED"
    /\ state' = "RECONCILIATION_REQUIRED"
    /\ visited' = visited \cup {"RECONCILIATION_REQUIRED"}
\* Trigger: VAULT_RECONCILIATION_DISCREPANCY_FOUND

VERIFIED_TO_AVAILABLE == 
    /\ state = "VERIFIED"
    /\ state' = "AVAILABLE"
    /\ visited' = visited \cup {"AVAILABLE"}
\* Trigger: VAULT_RESERVE_CREATED

VERIFIED_TO_RECONCILIATION_REQUIRED == 
    /\ state = "VERIFIED"
    /\ state' = "RECONCILIATION_REQUIRED"
    /\ visited' = visited \cup {"RECONCILIATION_REQUIRED"}
\* Trigger: VAULT_RECONCILIATION_DISCREPANCY_FOUND

VERIFIED_TO_REJECTED == 
    /\ state = "VERIFIED"
    /\ state' = "REJECTED"
    /\ visited' = visited \cup {"REJECTED"}
\* Trigger: VAULT_ASSET_REJECTED

Terminated == 
    /\ state \in FinalStates
    /\ UNCHANGED <<state, visited>>

Next == 
    AVAILABLE_TO_IMPAIRED \/ AVAILABLE_TO_RESERVED \/ CONSUMED_TO_AVAILABLE \/ IMPAIRED_TO_AVAILABLE \/ LOCKED_TO_AVAILABLE \/ LOCKED_TO_CONSUMED \/ RECONCILIATION_REQUIRED_TO_AVAILABLE \/ RECONCILIATION_REQUIRED_TO_LOCKED \/ RECONCILIATION_REQUIRED_TO_VERIFIED \/ REGISTERED_TO_REJECTED \/ REGISTERED_TO_VERIFIED \/ RELEASED_TO_AVAILABLE \/ RESERVED_TO_AVAILABLE \/ RESERVED_TO_IMPAIRED \/ RESERVED_TO_LOCKED \/ RESERVED_TO_RECONCILIATION_REQUIRED \/ VERIFIED_TO_AVAILABLE \/ VERIFIED_TO_RECONCILIATION_REQUIRED \/ VERIFIED_TO_REJECTED \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == <>(state \in FinalStates)

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================