---------------- MODULE LEDGER_JOURNAL_LIFECYCLE ----------------
* SOVR Financial OS — Generated TLA+ Model
* Compiler: 0.6.0 Protocol: 1.0.0
* Provenance: ledger_journal_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, ledger_balanced, authority_validated

States == {"CREATED", "POSTED", "RECONCILED", "REJECTED", "SETTLED", "VALIDATING"}

Init == 
    /\ state = "CREATED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE

CREATED_TO_REJECTED == 
    /\ state = "CREATED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "REJECTED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: TIMEOUT

CREATED_TO_VALIDATING == 
    /\ state = "CREATED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "VALIDATING"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VALIDATION_STARTED

POSTED_TO_RECONCILED == 
    /\ state = "POSTED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "RECONCILED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: RECONCILIATION_CONFIRMS

POSTED_TO_SETTLED == 
    /\ state = "POSTED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "SETTLED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: ORIGINATING_DOMAIN_CONFIRMS

SETTLED_TO_RECONCILED == 
    /\ state = "SETTLED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "RECONCILED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: RECONCILIATION_CONFIRMS

VALIDATING_TO_POSTED == 
    /\ state = "VALIDATING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "POSTED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VALIDATION_PASSED

VALIDATING_TO_REJECTED == 
    /\ state = "VALIDATING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "REJECTED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VALIDATION_FAILED

Next == 
    CREATED_TO_REJECTED \/ CREATED_TO_VALIDATING \/ POSTED_TO_RECONCILED \/ POSTED_TO_SETTLED \/ SETTLED_TO_RECONCILED \/ VALIDATING_TO_POSTED \/ VALIDATING_TO_REJECTED

* Invariant 1: State must always be in defined States
TypeOK == state \in States

* Invariant 2: INV-002 Double Entry balance holds
DoubleEntryBalance == ledger_balanced = TRUE

* Invariant 3: INV-003 Actor never exceeds authority
AuthorityBound == authority_validated = TRUE

Spec == Init /\ [][Next]_<<state, ledger_balanced, authority_validated>>

=====================================================