---------------- MODULE AGENT_LIFECYCLE ----------------
* SOVR Financial OS — Generated TLA+ Model
* Compiler: 0.6.0 Protocol: 1.0.0
* Provenance: agent_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, ledger_balanced, authority_validated

States == {"ACTIVE", "REGISTERED", "SUSPENDED", "TERMINATED"}

Init == 
    /\ state = "REGISTERED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE

0 == 
    /\ state = "REGISTERED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "ACTIVE"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: AGENT_ACTIVATE

1 == 
    /\ state = "ACTIVE"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "SUSPENDED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: AGENT_SUSPEND

2 == 
    /\ state = "SUSPENDED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "ACTIVE"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: AGENT_ACTIVATE

3 == 
    /\ state = "ACTIVE"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "TERMINATED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: AGENT_TERMINATE

4 == 
    /\ state = "SUSPENDED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "TERMINATED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: AGENT_TERMINATE

5 == 
    /\ state = "REGISTERED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "TERMINATED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: AGENT_TERMINATE

Next == 
    0 \/ 1 \/ 2 \/ 3 \/ 4 \/ 5

* Invariant 1: State must always be in defined States
TypeOK == state \in States

* Invariant 2: INV-002 Double Entry balance holds
DoubleEntryBalance == ledger_balanced = TRUE

* Invariant 3: INV-003 Actor never exceeds authority
AuthorityBound == authority_validated = TRUE

Spec == Init /\ [][Next]_<<state, ledger_balanced, authority_validated>>

=====================================================