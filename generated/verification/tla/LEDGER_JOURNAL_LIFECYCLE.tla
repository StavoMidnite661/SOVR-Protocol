---------------- MODULE LEDGER_JOURNAL_LIFECYCLE ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: ledger_journal_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"CORRECTED", "POSTED", "REVERSED"}

FinalStates == {"CORRECTED", "REVERSED"}

Init == 
    /\ state = "POSTED"
    /\ visited = {"POSTED"}

POSTED_TO_CORRECTED == 
    /\ state = "POSTED"
    /\ state' = "CORRECTED"
    /\ visited' = visited \cup {"CORRECTED"}
\* Trigger: LEDGER_ENTRY_CORRECTED

POSTED_TO_REVERSED == 
    /\ state = "POSTED"
    /\ state' = "REVERSED"
    /\ visited' = visited \cup {"REVERSED"}
\* Trigger: LEDGER_ENTRY_REVERSED

Terminated == 
    /\ state \in FinalStates
    /\ UNCHANGED <<state, visited>>

Next == 
    POSTED_TO_CORRECTED \/ POSTED_TO_REVERSED \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == <>(state \in FinalStates)

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================