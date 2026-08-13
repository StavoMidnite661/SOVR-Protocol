---------------- MODULE COMMERCIALOBLIGATION ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: CommercialObligation

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"CANCELLED", "DRAFT", "VALIDATED"}

FinalStates == {"CANCELLED"}

Init == 
    /\ state = "DRAFT"
    /\ visited = {"DRAFT"}

DRAFT_TO_CANCELLED == 
    /\ state = "DRAFT"
    /\ state' = "CANCELLED"
    /\ visited' = visited \cup {"CANCELLED"}
\* Trigger: OBLIGATIONCANCELLED

DRAFT_TO_VALIDATED == 
    /\ state = "DRAFT"
    /\ state' = "VALIDATED"
    /\ visited' = visited \cup {"VALIDATED"}
\* Trigger: OBLIGATIONVALIDATED

VALIDATED_TO_CANCELLED == 
    /\ state = "VALIDATED"
    /\ state' = "CANCELLED"
    /\ visited' = visited \cup {"CANCELLED"}
\* Trigger: OBLIGATIONCANCELLED

Terminated == 
    /\ state \in FinalStates
    /\ UNCHANGED <<state, visited>>

Next == 
    DRAFT_TO_CANCELLED \/ DRAFT_TO_VALIDATED \/ VALIDATED_TO_CANCELLED \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == <>(state \in FinalStates)

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================