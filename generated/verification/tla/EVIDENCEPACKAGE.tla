---------------- MODULE EVIDENCEPACKAGE ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: EvidencePackage

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"ARCHIVED", "GENERATED", "PUBLISHED", "SIGNED"}

FinalStates == {"ARCHIVED"}

Init == 
    /\ state = "GENERATED"
    /\ visited = {"GENERATED"}

GENERATED_TO_SIGNED == 
    /\ state = "GENERATED"
    /\ state' = "SIGNED"
    /\ visited' = visited \cup {"SIGNED"}
\* Trigger: ATTESTATIONSIGNED

PUBLISHED_TO_ARCHIVED == 
    /\ state = "PUBLISHED"
    /\ state' = "ARCHIVED"
    /\ visited' = visited \cup {"ARCHIVED"}
\* Trigger: EVIDENCEPACKAGEARCHIVED

SIGNED_TO_ARCHIVED == 
    /\ state = "SIGNED"
    /\ state' = "ARCHIVED"
    /\ visited' = visited \cup {"ARCHIVED"}
\* Trigger: EVIDENCEPACKAGEARCHIVED

SIGNED_TO_PUBLISHED == 
    /\ state = "SIGNED"
    /\ state' = "PUBLISHED"
    /\ visited' = visited \cup {"PUBLISHED"}
\* Trigger: EVIDENCEPACKAGEPUBLISHED

Terminated == 
    /\ state \in FinalStates
    /\ UNCHANGED <<state, visited>>

Next == 
    GENERATED_TO_SIGNED \/ PUBLISHED_TO_ARCHIVED \/ SIGNED_TO_ARCHIVED \/ SIGNED_TO_PUBLISHED \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == <>(state \in FinalStates)

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================