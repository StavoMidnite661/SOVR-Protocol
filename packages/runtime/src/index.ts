// ============================================================
// @sovr/runtime — Linux Kernel of Finance Runtime
// This is the core that external infrastructure connects to.
// Every digitalizable financial system can connect via adapters.
// ============================================================

export * from './execution/index.js';
export * from './sdk/client.js';
export * from './adapters/boundary.js';

// Generated artifact runtime bindings.
//
// The compiler emits output-only TypeScript under /generated/src. Those files are
// not compiled into this package yet, so the runtime exposes the wired kernel
// bindings that correspond to the generated capability engine and guardrail bus.
// The source artifact paths are retained for traceability until generated TS is
// compiled as part of the runtime bundle.
export { CapabilityEngine as GeneratedCapabilityEngine } from './server/capabilityEngine.js';
export type { CapabilityDef as GeneratedCapabilityDef, GrantedCapability as GeneratedGrantedCapability } from './server/capabilityEngine.js';
export { GuardrailCommandBus as GeneratedGuardrailCommandBus } from './execution/index.js';
export type { ExecutionContext as GeneratedExecutionContext, TransactionEffects as GeneratedTransactionEffects } from './execution/index.js';

export const GeneratedArtifacts = {
  capabilityEngine: {
    artifact: 'generated/src/security/capability-engine.ts',
    runtimeBinding: 'GeneratedCapabilityEngine',
    status: 'wired',
  },
  guardrailBus: {
    artifact: 'generated/src/execution/guardrail-bus.ts',
    runtimeBinding: 'GeneratedGuardrailCommandBus',
    status: 'wired',
  },
  stateMachineInterpreter: {
    artifact: '05_state-machines.yaml + generated/sovr-ir.json',
    runtimeBinding: 'StateMachineInterpreter',
    status: 'wired',
  },
} as const;

// Frontend developers can continue importing generated types/commands directly
// from the compiler output until generated TS is bundled into @sovr/runtime.
export const GeneratedTypes = { note: 'Import from generated/src/types/* via compiler output, not runtime bundle — see generated/' };
export const GeneratedCommands = { note: 'Import from generated/src/commands/*' };

// Kernel info
export const SOVR_KERNEL = {
  name: 'SOVR Financial OS',
  description: 'Machine-readable, compiler-enforced financial kernel — Linux of financing',
  protocolVersion: '1.0.0',
  compilerVersion: '0.6.0',
  principle: 'Same YAML input + same compiler version = byte-identical output = unfakeable provenance',
  connectivity: [
    'Vault (atomic value) answers: Can value exist?',
    'Ledger (immutable truth) answers: How is truth recorded?',
    'Treasury (controlled movement) answers: Can value move?',
    'Payment (external rails) answers: Can execution leave system?',
    'Identity (actor verification) answers: Who is acting?',
    'Policy (rule evaluation) answers: Is this permitted?',
    'Agent (bounded AI) answers: Can intelligence request action?',
    'Governance (oversight) answers: Who oversees system?',
    'Intent (natural language → command) answers: What does actor want?',
  ],
  externalConnectivity: [
    'on_chain_settlement: blockchain (ethereum, base, polygon, future_chain) via attestation_based boundary',
    'external_payment_rails: ACH, FEDNOW, WIRE, RTP, CARD, BLOCKCHAIN, SWIFT, SEPA via adapter_based',
    'regulatory_reporting: batch_export to compliance endpoints',
    'hybrid-boundary.yaml defines abstract interfaces — adapters may not mutate constitutional state',
  ],
  guarantees: [
    'Deterministic build_hash = sha256(sorted(inputs) + ir_hash + sorted(outputs) + compiler_version)',
    'No wall-clock in manifest (R5), no randomness (R4), sorted keys (R2), canonical serialization (R3)',
    'Fail-closed: any ERROR/FATAL diagnostic halts build, no partial artifacts emitted',
    'Every generated file carries source trace + hash header — tamper detection via sovr verify --check-generated',
    'Constitutional invariants INV-001..010 enforced at compile time and runtime gates',
  ],
};
