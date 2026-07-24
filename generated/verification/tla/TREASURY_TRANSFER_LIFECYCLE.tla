---------------- MODULE TREASURY_TRANSFER_LIFECYCLE ----------------
* SOVR Financial OS — Generated TLA+ Model
* Compiler: 0.6.0 Protocol: 1.0.0
* Provenance: treasury_transfer_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, ledger_balanced, authority_validated

States == {"AUTHORIZED", "COMPENSATION_REQUIRED", "EXECUTING", "EXPIRED", "FAILED", "PENDING_SETTLEMENT", "REJECTED", "REQUESTED", "RESERVED", "SETTLED", "UNKNOWN_EXTERNAL_STATE"}

Init == 
    /\ state = "REQUESTED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE

AUTHORIZED_TO_REJECTED == 
    /\ state = "AUTHORIZED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "REJECTED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: POLICY DENIED

AUTHORIZED_TO_RESERVED == 
    /\ state = "AUTHORIZED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "RESERVED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT RESERVATION LOCKED

EXECUTING_TO_FAILED == 
    /\ state = "EXECUTING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FAILED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: EXECUTION ERROR

EXECUTING_TO_PENDING_SETTLEMENT == 
    /\ state = "EXECUTING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "PENDING_SETTLEMENT"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: EXECUTION COMPLETED, AWAITING CONFIRMATION

EXECUTING_TO_SETTLED == 
    /\ state = "EXECUTING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "SETTLED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: INTERNAL SETTLEMENT CONFIRMED DIRECTLY

EXECUTING_TO_UNKNOWN_EXTERNAL_STATE == 
    /\ state = "EXECUTING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "UNKNOWN_EXTERNAL_STATE"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: EXTERNAL TIMEOUT

FAILED_TO_COMPENSATION_REQUIRED == 
    /\ state = "FAILED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "COMPENSATION_REQUIRED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: COMPENSATION SAGA INITIATED

PENDING_SETTLEMENT_TO_FAILED == 
    /\ state = "PENDING_SETTLEMENT"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FAILED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: SETTLEMENT FAILED

PENDING_SETTLEMENT_TO_SETTLED == 
    /\ state = "PENDING_SETTLEMENT"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "SETTLED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: SETTLEMENT CONFIRMED

PENDING_SETTLEMENT_TO_UNKNOWN_EXTERNAL_STATE == 
    /\ state = "PENDING_SETTLEMENT"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "UNKNOWN_EXTERNAL_STATE"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: TIMEOUT OR UNKNOWN RESPONSE

REQUESTED_TO_AUTHORIZED == 
    /\ state = "REQUESTED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "AUTHORIZED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: IDENTITY+CAPABILITY+POLICY PASSED

REQUESTED_TO_EXPIRED == 
    /\ state = "REQUESTED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "EXPIRED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: TIMEOUT

REQUESTED_TO_REJECTED == 
    /\ state = "REQUESTED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "REJECTED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VALIDATION FAILED

RESERVED_TO_EXECUTING == 
    /\ state = "RESERVED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "EXECUTING"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: EXECUTION BEGINS

RESERVED_TO_EXPIRED == 
    /\ state = "RESERVED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "EXPIRED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: VAULT RESERVATION EXPIRED

UNKNOWN_EXTERNAL_STATE_TO_COMPENSATION_REQUIRED == 
    /\ state = "UNKNOWN_EXTERNAL_STATE"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "COMPENSATION_REQUIRED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: GOVERNANCE ORDERS COMPENSATION

UNKNOWN_EXTERNAL_STATE_TO_FAILED == 
    /\ state = "UNKNOWN_EXTERNAL_STATE"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FAILED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: FAILURE CONFIRMED

UNKNOWN_EXTERNAL_STATE_TO_SETTLED == 
    /\ state = "UNKNOWN_EXTERNAL_STATE"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "SETTLED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: LATE CONFIRMATION RECEIVED

Next == 
    AUTHORIZED_TO_REJECTED \/ AUTHORIZED_TO_RESERVED \/ EXECUTING_TO_FAILED \/ EXECUTING_TO_PENDING_SETTLEMENT \/ EXECUTING_TO_SETTLED \/ EXECUTING_TO_UNKNOWN_EXTERNAL_STATE \/ FAILED_TO_COMPENSATION_REQUIRED \/ PENDING_SETTLEMENT_TO_FAILED \/ PENDING_SETTLEMENT_TO_SETTLED \/ PENDING_SETTLEMENT_TO_UNKNOWN_EXTERNAL_STATE \/ REQUESTED_TO_AUTHORIZED \/ REQUESTED_TO_EXPIRED \/ REQUESTED_TO_REJECTED \/ RESERVED_TO_EXECUTING \/ RESERVED_TO_EXPIRED \/ UNKNOWN_EXTERNAL_STATE_TO_COMPENSATION_REQUIRED \/ UNKNOWN_EXTERNAL_STATE_TO_FAILED \/ UNKNOWN_EXTERNAL_STATE_TO_SETTLED

* Invariant 1: State must always be in defined States
TypeOK == state \in States

* Invariant 2: INV-002 Double Entry balance holds
DoubleEntryBalance == ledger_balanced = TRUE

* Invariant 3: INV-003 Actor never exceeds authority
AuthorityBound == authority_validated = TRUE

Spec == Init /\ [][Next]_<<state, ledger_balanced, authority_validated>>

=====================================================