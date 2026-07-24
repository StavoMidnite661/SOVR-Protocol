---------------- MODULE VAULT_RESERVATION_LIFECYCLE ----------------
* SOVR Financial OS — Generated TLA+ Model
* Compiler: 0.6.0 Protocol: 1.0.0
* Provenance: vault_reservation_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, ledger_balanced, authority_validated

States == {"ACTIVE", "CONSUMED", "EXPIRED", "FAILED", "PENDING", "RELEASED"}

Init == 
    /\ state = "PENDING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE

ACTIVE_TO_CONSUMED == 
    /\ state = "ACTIVE"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "CONSUMED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: CONSUMING_TRANSACTION_COMPLETED

ACTIVE_TO_EXPIRED == 
    /\ state = "ACTIVE"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "EXPIRED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_RESERVE_EXPIRED

ACTIVE_TO_RELEASED == 
    /\ state = "ACTIVE"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "RELEASED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_RESERVE_RELEASED

PENDING_TO_ACTIVE == 
    /\ state = "PENDING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "ACTIVE"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_RESERVE_LOCKED

PENDING_TO_EXPIRED == 
    /\ state = "PENDING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "EXPIRED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_RESERVE_EXPIRED

PENDING_TO_FAILED == 
    /\ state = "PENDING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FAILED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_RESERVE_CREATION_FAILED

PENDING_TO_RELEASED == 
    /\ state = "PENDING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "RELEASED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_RESERVE_RELEASED

Next == 
    ACTIVE_TO_CONSUMED \/ ACTIVE_TO_EXPIRED \/ ACTIVE_TO_RELEASED \/ PENDING_TO_ACTIVE \/ PENDING_TO_EXPIRED \/ PENDING_TO_FAILED \/ PENDING_TO_RELEASED

* Invariant 1: State must always be in defined States
TypeOK == state \in States

* Invariant 2: INV-002 Double Entry balance holds
DoubleEntryBalance == ledger_balanced = TRUE

* Invariant 3: INV-003 Actor never exceeds authority
AuthorityBound == authority_validated = TRUE

Spec == Init /\ [][Next]_<<state, ledger_balanced, authority_validated>>

=====================================================