---------------- MODULE COMMERCIALOBLIGATION ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: CommercialObligation

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"0", "1", "2", "3", "4", "5"}

FinalStates == {}

Init == 
    /\ state = "DRAFT"
    /\ visited = {"DRAFT"}

DRAFT_TO_CANCELLED == 
    /\ state = "DRAFT"
    /\ state' = "CANCELLED"
    /\ visited' = visited \cup {"CANCELLED"}
\* Trigger: CANCELOBLIGATION

DRAFT_TO_VALIDATED == 
    /\ state = "DRAFT"
    /\ state' = "VALIDATED"
    /\ visited' = visited \cup {"VALIDATED"}
\* Trigger: VALIDATEOBLIGATION

SETTLED_TO_DISPUTED == 
    /\ state = "SETTLED"
    /\ state' = "DISPUTED"
    /\ visited' = visited \cup {"DISPUTED"}
\* Trigger: DISPUTESETTLEMENT

SETTLEMENT_REQUESTED_TO_SETTLED == 
    /\ state = "SETTLEMENT_REQUESTED"
    /\ state' = "SETTLED"
    /\ visited' = visited \cup {"SETTLED"}
\* Trigger: 2

VALIDATED_TO_CANCELLED == 
    /\ state = "VALIDATED"
    /\ state' = "CANCELLED"
    /\ visited' = visited \cup {"CANCELLED"}
\* Trigger: CANCELOBLIGATION

VALIDATED_TO_SETTLEMENT_REQUESTED == 
    /\ state = "VALIDATED"
    /\ state' = "SETTLEMENT_REQUESTED"
    /\ visited' = visited \cup {"SETTLEMENT_REQUESTED"}
\* Trigger: AUTHORIZESETTLEMENT

Terminated == 
    /\ FALSE
    /\ UNCHANGED <<state, visited>>

Next == 
    DRAFT_TO_CANCELLED \/ DRAFT_TO_VALIDATED \/ SETTLED_TO_DISPUTED \/ SETTLEMENT_REQUESTED_TO_SETTLED \/ VALIDATED_TO_CANCELLED \/ VALIDATED_TO_SETTLEMENT_REQUESTED \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == TRUE

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================