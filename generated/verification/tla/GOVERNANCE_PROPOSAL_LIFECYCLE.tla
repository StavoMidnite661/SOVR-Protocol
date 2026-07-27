---------------- MODULE GOVERNANCE_PROPOSAL_LIFECYCLE ----------------
\* SOVR Financial OS — Generated TLA+ Model
\* Compiler: 0.6.0 Protocol: 1.0.0
\* Provenance: governance_proposal_lifecycle

EXTENDS Naturals, Sequences

VARIABLES state, visited

States == {"APPROVED", "CANCELLED", "DRAFT", "EXPIRED", "IMPLEMENTED", "PENDING_REVIEW", "REJECTED"}

FinalStates == {"CANCELLED", "EXPIRED", "IMPLEMENTED", "REJECTED"}

Init == 
    /\ state = "DRAFT"
    /\ visited = {"DRAFT"}

APPROVED_TO_IMPLEMENTED == 
    /\ state = "APPROVED"
    /\ state' = "IMPLEMENTED"
    /\ visited' = visited \cup {"IMPLEMENTED"}
\* Trigger: GOVERNANCE_PROPOSAL_IMPLEMENT

DRAFT_TO_CANCELLED == 
    /\ state = "DRAFT"
    /\ state' = "CANCELLED"
    /\ visited' = visited \cup {"CANCELLED"}
\* Trigger: GOVERNANCE_PROPOSAL_CANCEL

DRAFT_TO_PENDING_REVIEW == 
    /\ state = "DRAFT"
    /\ state' = "PENDING_REVIEW"
    /\ visited' = visited \cup {"PENDING_REVIEW"}
\* Trigger: GOVERNANCE_PROPOSAL_SUBMIT

PENDING_REVIEW_TO_APPROVED == 
    /\ state = "PENDING_REVIEW"
    /\ state' = "APPROVED"
    /\ visited' = visited \cup {"APPROVED"}
\* Trigger: GOVERNANCE_PROPOSAL_APPROVE

PENDING_REVIEW_TO_CANCELLED == 
    /\ state = "PENDING_REVIEW"
    /\ state' = "CANCELLED"
    /\ visited' = visited \cup {"CANCELLED"}
\* Trigger: GOVERNANCE_PROPOSAL_CANCEL

PENDING_REVIEW_TO_EXPIRED == 
    /\ state = "PENDING_REVIEW"
    /\ state' = "EXPIRED"
    /\ visited' = visited \cup {"EXPIRED"}
\* Trigger: 3

PENDING_REVIEW_TO_REJECTED == 
    /\ state = "PENDING_REVIEW"
    /\ state' = "REJECTED"
    /\ visited' = visited \cup {"REJECTED"}
\* Trigger: GOVERNANCE_PROPOSAL_REJECT

Terminated == 
    /\ state \in FinalStates
    /\ UNCHANGED <<state, visited>>

Next == 
    APPROVED_TO_IMPLEMENTED \/ DRAFT_TO_CANCELLED \/ DRAFT_TO_PENDING_REVIEW \/ PENDING_REVIEW_TO_APPROVED \/ PENDING_REVIEW_TO_CANCELLED \/ PENDING_REVIEW_TO_EXPIRED \/ PENDING_REVIEW_TO_REJECTED \/ Terminated

\* INV-006: state is always one the compiled machine declares.
\* Falsifiable: a transition to an undeclared state breaks this.
TypeOK == state \in States

\* INV-006: every visited state is reachable and declared.
ReachableStatesDeclared == visited \subseteq States

\* Liveness: a terminal state remains reachable from anywhere.
CanTerminate == <>(state \in FinalStates)

Spec == Init /\ [][Next]_<<state, visited>>

=====================================================