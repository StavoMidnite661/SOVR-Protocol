---------------- MODULE GOVERNANCE_PROPOSAL_LIFECYCLE ----------------
* SOVR Financial OS — Generated TLA+ Model
* Compiler: 0.6.0 Protocol: 1.0.0
* Provenance: governance_proposal_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, ledger_balanced, authority_validated

States == {"APPROVED", "CANCELLED", "DRAFT", "EXPIRED", "IMPLEMENTED", "PENDING_REVIEW", "REJECTED"}

Init == 
    /\ state = "DRAFT"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE

0 == 
    /\ state = "DRAFT"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "PENDING_REVIEW"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: GOVERNANCE_PROPOSAL_SUBMIT

1 == 
    /\ state = "PENDING_REVIEW"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "APPROVED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: GOVERNANCE_PROPOSAL_APPROVE

2 == 
    /\ state = "PENDING_REVIEW"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "REJECTED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: GOVERNANCE_PROPOSAL_REJECT

3 == 
    /\ state = "PENDING_REVIEW"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "EXPIRED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 3

4 == 
    /\ state = "PENDING_REVIEW"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "CANCELLED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: GOVERNANCE_PROPOSAL_CANCEL

5 == 
    /\ state = "APPROVED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "IMPLEMENTED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: GOVERNANCE_PROPOSAL_IMPLEMENT

6 == 
    /\ state = "DRAFT"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "CANCELLED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: GOVERNANCE_PROPOSAL_CANCEL

Next == 
    0 \/ 1 \/ 2 \/ 3 \/ 4 \/ 5 \/ 6

* Invariant 1: State must always be in defined States
TypeOK == state \in States

* Invariant 2: INV-002 Double Entry balance holds
DoubleEntryBalance == ledger_balanced = TRUE

* Invariant 3: INV-003 Actor never exceeds authority
AuthorityBound == authority_validated = TRUE

Spec == Init /\ [][Next]_<<state, ledger_balanced, authority_validated>>

=====================================================