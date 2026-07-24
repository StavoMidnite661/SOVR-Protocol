---------------- MODULE VAULT_ASSET_LIFECYCLE ----------------
* SOVR Financial OS — Generated TLA+ Model
* Compiler: 0.6.0 Protocol: 1.0.0
* Provenance: vault_asset_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, ledger_balanced, authority_validated

States == {"AVAILABLE", "CONSUMED", "IMPAIRED", "LOCKED", "RECONCILIATION_REQUIRED", "REGISTERED", "REJECTED", "RELEASED", "RESERVED", "VERIFIED"}

Init == 
    /\ state = "REGISTERED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE

AVAILABLE_TO_IMPAIRED == 
    /\ state = "AVAILABLE"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "IMPAIRED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_ASSET_IMPAIRED

AVAILABLE_TO_RESERVED == 
    /\ state = "AVAILABLE"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "RESERVED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_RESERVE_CREATED

CONSUMED_TO_AVAILABLE == 
    /\ state = "CONSUMED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "AVAILABLE"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: AUTOMATIC

IMPAIRED_TO_AVAILABLE == 
    /\ state = "IMPAIRED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "AVAILABLE"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_VALUATION_UPDATED

LOCKED_TO_AVAILABLE == 
    /\ state = "LOCKED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "AVAILABLE"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_RESERVE_RELEASED

LOCKED_TO_CONSUMED == 
    /\ state = "LOCKED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "CONSUMED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: TREASURY_TRANSFER_SETTLED

RECONCILIATION_REQUIRED_TO_AVAILABLE == 
    /\ state = "RECONCILIATION_REQUIRED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "AVAILABLE"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_RECONCILIATION_COMPLETED

RECONCILIATION_REQUIRED_TO_LOCKED == 
    /\ state = "RECONCILIATION_REQUIRED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "LOCKED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_RECONCILIATION_COMPLETED

RECONCILIATION_REQUIRED_TO_VERIFIED == 
    /\ state = "RECONCILIATION_REQUIRED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "VERIFIED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_RECONCILIATION_COMPLETED

REGISTERED_TO_REJECTED == 
    /\ state = "REGISTERED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "REJECTED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_ASSET_REJECTED

REGISTERED_TO_VERIFIED == 
    /\ state = "REGISTERED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "VERIFIED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_ASSET_VERIFIED

RELEASED_TO_AVAILABLE == 
    /\ state = "RELEASED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "AVAILABLE"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: AUTOMATIC

RESERVED_TO_AVAILABLE == 
    /\ state = "RESERVED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "AVAILABLE"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_RESERVE_RELEASED

RESERVED_TO_IMPAIRED == 
    /\ state = "RESERVED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "IMPAIRED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_ASSET_IMPAIRED

RESERVED_TO_LOCKED == 
    /\ state = "RESERVED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "LOCKED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_RESERVE_LOCKED

RESERVED_TO_RECONCILIATION_REQUIRED == 
    /\ state = "RESERVED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "RECONCILIATION_REQUIRED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_RECONCILIATION_DISCREPANCY_FOUND

VERIFIED_TO_AVAILABLE == 
    /\ state = "VERIFIED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "AVAILABLE"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_RESERVE_CREATED

VERIFIED_TO_RECONCILIATION_REQUIRED == 
    /\ state = "VERIFIED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "RECONCILIATION_REQUIRED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_RECONCILIATION_DISCREPANCY_FOUND

VERIFIED_TO_REJECTED == 
    /\ state = "VERIFIED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "REJECTED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT_ASSET_REJECTED

Next == 
    AVAILABLE_TO_IMPAIRED \/ AVAILABLE_TO_RESERVED \/ CONSUMED_TO_AVAILABLE \/ IMPAIRED_TO_AVAILABLE \/ LOCKED_TO_AVAILABLE \/ LOCKED_TO_CONSUMED \/ RECONCILIATION_REQUIRED_TO_AVAILABLE \/ RECONCILIATION_REQUIRED_TO_LOCKED \/ RECONCILIATION_REQUIRED_TO_VERIFIED \/ REGISTERED_TO_REJECTED \/ REGISTERED_TO_VERIFIED \/ RELEASED_TO_AVAILABLE \/ RESERVED_TO_AVAILABLE \/ RESERVED_TO_IMPAIRED \/ RESERVED_TO_LOCKED \/ RESERVED_TO_RECONCILIATION_REQUIRED \/ VERIFIED_TO_AVAILABLE \/ VERIFIED_TO_RECONCILIATION_REQUIRED \/ VERIFIED_TO_REJECTED

* Invariant 1: State must always be in defined States
TypeOK == state \in States

* Invariant 2: INV-002 Double Entry balance holds
DoubleEntryBalance == ledger_balanced = TRUE

* Invariant 3: INV-003 Actor never exceeds authority
AuthorityBound == authority_validated = TRUE

Spec == Init /\ [][Next]_<<state, ledger_balanced, authority_validated>>

=====================================================