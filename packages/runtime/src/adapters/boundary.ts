// ============================================================
// Boundary Adapters — External connectivity for every digitalizable infra
// hybrid-boundary.yaml defines abstract interfaces — adapters implement
// Prohibition: ADAPTERS_MAY_NOT_MUTATE_CONSTITUTIONAL_STATE (INV-001, INV-005)
// ============================================================

export interface ChainAdapter {
  chainId: number;
  chainType: 'EVM'|'EVM_L2'|'SVM'|'MOVE'|'COSMOS'|'SUBSTRATE'|'EXTENSIBLE';
  finalityModel: 'PROBABILISTIC'|'INSTANT'|'PROOF_OF_FINALITY'|'HYBRID';
  prepare(operation: string, params: any): Promise<{ preparationId: string; estimatedGas: string; nonce: number }>;
  submit(preparationId: string, signedTx: string): Promise<{ txHash: string; blockNumber: number }>;
  confirm(txHash: string, requiredConfirmations: number): Promise<{ confirmed: boolean; confirmationBlock: number; finalityLevel: string }>;
  rollback(txHash: string, reason: string): Promise<{ rollbackId: string }>;
  // Prohibition: adapter must emit events, not mutate vault/ledger directly
}

// Rail type union aligned with domains/payment.yaml — 12 rails.
export const SUPPORTED_RAIL_TYPES = [
  'ACH', 'FEDNOW', 'WIRE', 'RTP', 'CARD', 'BLOCKCHAIN',
  'INTERNAL_TRANSFER', 'STABLECOIN', 'SWIFT', 'SEPA',
  'CASH_SETTLEMENT', 'FUTURE_ADAPTER',
] as const;
export type RailType = typeof SUPPORTED_RAIL_TYPES[number];

// Example: payment rail adapter
export interface PaymentRailAdapter {
  railType: RailType;
  prepare(paymentRequestId: string, amount: any): Promise<{ railPreparationId: string; fees: string }>;
  execute(railPreparationId: string): Promise<{ railExecutionId: string; railReferenceId: string }>;
  confirm(railExecutionId: string): Promise<{ confirmed: boolean; confirmedAmount: string; fees: string }>;
  // Compensation for failed payments — saga orchestration
  compensate(railExecutionId: string, reason: string): Promise<{ reversalRailReferenceId: string }>;
}

// Registry of future adapters — extensible per hybrid-boundary.yaml future_chain
export class AdapterRegistry {
  private chains = new Map<number, ChainAdapter>();
  private rails = new Map<string, PaymentRailAdapter>();

  registerChain(adapter: ChainAdapter) { this.chains.set(adapter.chainId, adapter); }
  registerRail(adapter: PaymentRailAdapter) { this.rails.set(adapter.railType, adapter); }

  getChain(chainId: number) { return this.chains.get(chainId); }
  getRail(railType: string) { return this.rails.get(railType); }

  // Unfakeable: every adapter execution must emit event with full audit envelope
  // No adapter may bypass constitutional gates — INV-008 enforced via ExecutionContext
}
