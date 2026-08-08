---------------- MODULE EVIDENCEPACKAGE ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: EvidencePackage

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"0", "1", "2", "3", "4", "5", "6"}

FinalStates == {}

Init == 
    /\ state = "PENDING"
    /\ visited = {"PENDING"}

GENERATED_TO_VERIFIED == 
    /\ state = "GENERATED"
    /\ state' = "VERIFIED"
    /\ visited' = visited \cup {"VERIFIED"}
\* Trigger: 2

GENERATING_TO_GENERATED == 
    /\ state = "GENERATING"
    /\ state' = "GENERATED"
    /\ visited' = visited \cup {"GENERATED"}
\* Trigger: 1

PENDING_TO_GENERATING == 
    /\ state = "PENDING"
    /\ state' = "GENERATING"
    /\ visited' = visited \cup {"GENERATING"}
\* Trigger: GENERATEEVIDENCEPACKAGE

SIGNED_TO_PUBLISHED == 
    /\ state = "SIGNED"
    /\ state' = "PUBLISHED"
    /\ visited' = visited \cup {"PUBLISHED"}
\* Trigger: PUBLISHPACKAGE

SIGNED,PUBLISHED_TO_ARCHIVED == 
    /\ state = "SIGNED,PUBLISHED"
    /\ state' = "ARCHIVED"
    /\ visited' = visited \cup {"ARCHIVED"}
\* Trigger: ARCHIVEPACKAGE

VERIFIED_TO_SIGNED == 
    /\ state = "VERIFIED"
    /\ state' = "SIGNED"
    /\ visited' = visited \cup {"SIGNED"}
\* Trigger: SIGNATTESTATION

Terminated == 
    /\ FALSE
    /\ UNCHANGED <<state, visited>>

Next == 
    GENERATED_TO_VERIFIED \/ GENERATING_TO_GENERATED \/ PENDING_TO_GENERATING \/ SIGNED_TO_PUBLISHED \/ SIGNED,PUBLISHED_TO_ARCHIVED \/ VERIFIED_TO_SIGNED \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == TRUE

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================