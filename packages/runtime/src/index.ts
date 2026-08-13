// ============================================================
// @sovr/runtime — Financial protocol kernel runtime
// Authority: compiled registries via authority-loader → KernelExecutor
// ============================================================

export * from './execution/index.js';
export * from './sdk/client.js';
export * from './adapters/boundary.js';

export { CapabilityEngine } from './server/capabilityEngine.js';
export type { CapabilityDef, GrantedCapability } from './server/capabilityEngine.js';

export const SOVR_KERNEL = {
  name: 'SOVR Financial OS',
  description: 'Registry-driven financial kernel',
  protocolVersion: '1.0.0',
  compilerVersion: '0.6.0',
  principle: 'YAML → compiler → IR → generated registries → authority-loader → KernelExecutor',
  guarantees: [
    'Runtime loads compiled registries. It does not parse protocol YAML.',
    'KernelExecutor is the sole command execution authority.',
    'State transitions are looked up from machines.registry.json.',
  ],
};
