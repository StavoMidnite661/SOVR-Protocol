---------------- MODULE PAYMENT_REQUEST_LIFECYCLE ----------------
* SOVR Financial OS — Generated TLA+ Model
* Compiler: 0.6.0 Protocol: 1.0.0
* Provenance: payment_request_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, ledger_balanced, authority_validated

States == {"CANCELLED", "COMPENSATING", "CONFIRMING", "EXECUTING", "FAILED", "PLANNING", "PREPARING", "RECEIVED", "RECONCILING", "REVERSED", "ROUTING", "SETTLED"}

Init == 
    /\ state = "RECEIVED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE

0 == 
    /\ state = "RECEIVED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "PLANNING"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: PAYMENT_EXECUTION_PLAN

1 == 
    /\ state = "RECEIVED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "CANCELLED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: PAYMENT_REQUEST_CANCEL

10 == 
    /\ state = "EXECUTING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "CONFIRMING"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 10

11 == 
    /\ state = "EXECUTING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FAILED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 11

12 == 
    /\ state = "EXECUTING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FAILED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 12

13 == 
    /\ state = "EXECUTING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "COMPENSATING"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: PAYMENT_EXECUTION_COMPENSATE

14 == 
    /\ state = "CONFIRMING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "RECONCILING"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 14

15 == 
    /\ state = "CONFIRMING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FAILED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 15

16 == 
    /\ state = "CONFIRMING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "COMPENSATING"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: PAYMENT_EXECUTION_COMPENSATE

17 == 
    /\ state = "RECONCILING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "SETTLED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 17

18 == 
    /\ state = "RECONCILING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "SETTLED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: PAYMENT_RECEIPT_ISSUE

19 == 
    /\ state = "FAILED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "COMPENSATING"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: PAYMENT_EXECUTION_COMPENSATE

2 == 
    /\ state = "PLANNING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "ROUTING"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 2

20 == 
    /\ state = "COMPENSATING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "REVERSED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 20

3 == 
    /\ state = "PLANNING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FAILED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 3

4 == 
    /\ state = "PLANNING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "CANCELLED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: PAYMENT_REQUEST_CANCEL

5 == 
    /\ state = "ROUTING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "PREPARING"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: PAYMENT_EXECUTION_EXECUTE

6 == 
    /\ state = "ROUTING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FAILED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 6

7 == 
    /\ state = "ROUTING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "CANCELLED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: PAYMENT_REQUEST_CANCEL

8 == 
    /\ state = "PREPARING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "EXECUTING"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 8

9 == 
    /\ state = "PREPARING"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "FAILED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 9

Next == 
    0 \/ 1 \/ 10 \/ 11 \/ 12 \/ 13 \/ 14 \/ 15 \/ 16 \/ 17 \/ 18 \/ 19 \/ 2 \/ 20 \/ 3 \/ 4 \/ 5 \/ 6 \/ 7 \/ 8 \/ 9

* Invariant 1: State must always be in defined States
TypeOK == state \in States

* Invariant 2: INV-002 Double Entry balance holds
DoubleEntryBalance == ledger_balanced = TRUE

* Invariant 3: INV-003 Actor never exceeds authority
AuthorityBound == authority_validated = TRUE

Spec == Init /\ [][Next]_<<state, ledger_balanced, authority_validated>>

=====================================================