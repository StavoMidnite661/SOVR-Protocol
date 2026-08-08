export interface AuditProof {
  scenario_id: string;
  build_hash: string;
  command_sequence: any[];
  event_sequence: any[];
  state_transitions: any[];
  projection_hash: string;
  merkle_root: string;
  deterministic_hash: string;
}
