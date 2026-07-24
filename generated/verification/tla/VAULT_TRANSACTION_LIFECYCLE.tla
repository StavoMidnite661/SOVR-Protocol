---------------- MODULE VAULT_TRANSACTION_LIFECYCLE ----------------
* SOVR Financial OS — Generated TLA+ Model
* Compiler: 0.6.0 Protocol: 1.0.0
* Provenance: vault_transaction_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, ledger_balanced, authority_validated

States == {"CLOSED", "CREATED", "DISBURSED", "FAILED", "FUNDED", "FUNDING_PENDING", "FUNDING_REQUESTED", "RELEASE_AUTHORIZED", "RELEASE_PENDING"}

Init == 
    /\ state = "CREATED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE

CREATED_TO_FAILED == 
    /\ state = "CREATED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FAILED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_TRANSACTION_CANCEL

CREATED_TO_FUNDING_REQUESTED == 
    /\ state = "CREATED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FUNDING_REQUESTED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_TRANSACTION_FUND

DISBURSED_TO_CLOSED == 
    /\ state = "DISBURSED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "CLOSED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: AUTOMATIC

FUNDED_TO_RELEASE_PENDING == 
    /\ state = "FUNDED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "RELEASE_PENDING"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_TRANSACTION_AUTHORIZE_RELEASE

FUNDING_PENDING_TO_FAILED == 
    /\ state = "FUNDING_PENDING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FAILED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: TIMEOUT

FUNDING_PENDING_TO_FUNDED == 
    /\ state = "FUNDING_PENDING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FUNDED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: FUNDING_SETTLEMENT_CONFIRMED

FUNDING_REQUESTED_TO_FAILED == 
    /\ state = "FUNDING_REQUESTED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FAILED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_TRANSACTION_CANCEL

FUNDING_REQUESTED_TO_FUNDING_PENDING == 
    /\ state = "FUNDING_REQUESTED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FUNDING_PENDING"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: EXTERNAL_FUNDING_CONFIRMED

RELEASE_AUTHORIZED_TO_DISBURSED == 
    /\ state = "RELEASE_AUTHORIZED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "DISBURSED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_TRANSACTION_DISBURSE

RELEASE_PENDING_TO_FAILED == 
    /\ state = "RELEASE_PENDING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FAILED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_TRANSACTION_CANCEL

RELEASE_PENDING_TO_RELEASE_AUTHORIZED == 
    /\ state = "RELEASE_PENDING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "RELEASE_AUTHORIZED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_TRANSACTION_AUTHORIZE_RELEASE

Next == 
    CREATED_TO_FAILED \/ CREATED_TO_FUNDING_REQUESTED \/ DISBURSED_TO_CLOSED \/ FUNDED_TO_RELEASE_PENDING \/ FUNDING_PENDING_TO_FAILED \/ FUNDING_PENDING_TO_FUNDED \/ FUNDING_REQUESTED_TO_FAILED \/ FUNDING_REQUESTED_TO_FUNDING_PENDING \/ RELEASE_AUTHORIZED_TO_DISBURSED \/ RELEASE_PENDING_TO_FAILED \/ RELEASE_PENDING_TO_RELEASE_AUTHORIZED

* Invariant 1: State must always be in defined States
TypeOK == state \in States

* Invariant 2: INV-002 Double Entry balance holds
DoubleEntryBalance == ledger_balanced = TRUE

* Invariant 3: INV-003 Actor never exceeds authority
AuthorityBound == authority_validated = TRUE

Spec == Init /\ [][Next]_<<state, ledger_balanced, authority_validated>>

=====================================================