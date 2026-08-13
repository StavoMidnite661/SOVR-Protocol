---------------- MODULE SETTLEMENTVALUEUNIT ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: SettlementValueUnit

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"ISSUED", "REDEEMED"}

FinalStates == {"REDEEMED"}

Init == 
    /\ state = "ISSUED"
    /\ visited = {"ISSUED"}

ISSUED_TO_REDEEMED == 
    /\ state = "ISSUED"
    /\ state' = "REDEEMED"
    /\ visited' = visited \cup {"REDEEMED"}
\* Trigger: SVUREDEEMED

Terminated == 
    /\ state \in FinalStates
    /\ UNCHANGED <<state, visited>>

Next == 
    ISSUED_TO_REDEEMED \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == <>(state \in FinalStates)

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================