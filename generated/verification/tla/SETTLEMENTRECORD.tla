---------------- MODULE SETTLEMENTRECORD ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: SettlementRecord

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"CANCELLED", "DISPUTED", "FINALIZED", "LEDGER_POSTED", "PENDING"}

FinalStates == {"CANCELLED", "FINALIZED"}

Init == 
    /\ state = "PENDING"
    /\ visited = {"PENDING"}

FINALIZED_TO_DISPUTED == 
    /\ state = "FINALIZED"
    /\ state' = "DISPUTED"
    /\ visited' = visited \cup {"DISPUTED"}
\* Trigger: SETTLEMENTDISPUTED

LEDGER_POSTED_TO_FINALIZED == 
    /\ state = "LEDGER_POSTED"
    /\ state' = "FINALIZED"
    /\ visited' = visited \cup {"FINALIZED"}
\* Trigger: SETTLEMENTFINALIZED

PENDING_TO_CANCELLED == 
    /\ state = "PENDING"
    /\ state' = "CANCELLED"
    /\ visited' = visited \cup {"CANCELLED"}
\* Trigger: SETTLEMENTCANCELLED

PENDING_TO_LEDGER_POSTED == 
    /\ state = "PENDING"
    /\ state' = "LEDGER_POSTED"
    /\ visited' = visited \cup {"LEDGER_POSTED"}
\* Trigger: SETTLEMENTEXECUTED

Terminated == 
    /\ state \in FinalStates
    /\ UNCHANGED <<state, visited>>

Next == 
    FINALIZED_TO_DISPUTED \/ LEDGER_POSTED_TO_FINALIZED \/ PENDING_TO_CANCELLED \/ PENDING_TO_LEDGER_POSTED \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == <>(state \in FinalStates)

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================