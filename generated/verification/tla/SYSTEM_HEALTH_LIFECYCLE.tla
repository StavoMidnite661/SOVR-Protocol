---------------- MODULE SYSTEM_HEALTH_LIFECYCLE ----------------
* SOVR Financial OS — Generated TLA+ Model
* Compiler: 0.6.0 Protocol: 1.0.0
* Provenance: system_health_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, ledger_balanced, authority_validated

States == {"DEGRADED", "HALTED", "HEALTHY", "UNKNOWN"}

Init == 
    /\ state = "HEALTHY"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE

0 == 
    /\ state = "HEALTHY"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "DEGRADED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 0

1 == 
    /\ state = "DEGRADED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "HEALTHY"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 1

2 == 
    /\ state = "HEALTHY"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "HALTED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: GOVERNANCE_EMERGENCY_HALT

3 == 
    /\ state = "DEGRADED"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "HALTED"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: GOVERNANCE_EMERGENCY_HALT

4 == 
    /\ state = "HEALTHY"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "UNKNOWN"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 4

5 == 
    /\ state = "UNKNOWN"
    /\ ledger_balanced = TRUE
    /\ authority_validated = TRUE
    /\ state' = "HEALTHY"
    /\ UNCHANGED <<ledger_balanced, authority_validated>>
* Trigger: 5

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