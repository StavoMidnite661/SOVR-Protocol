// ============================================================
// SOVR Financial OS — Simulation Bootstrap
// Wires runtime components for isolated simulation execution.
// No production adapters. No external I/O.
// Execution authority: compiled registries → CommandBus → KernelExecutor.
// ============================================================

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDeterministicEventStore } from './deterministic-event-store.js';
import { EventStore } from '../server/eventStore.js';
import { CapabilityEngine } from '../server/capabilityEngine.js';
import { ProjectionEngine } from '../server/projectionEngine.js';
import { CommandBus } from '../server/commandBus.js';
import { StateRegistry } from '../execution/state-registry.js';
import { KernelExecutor } from '../execution/kernel-executor.js';
import { JsonRegistryLoader } from '../authority/authority-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROTOCOL_ROOT = path.resolve(__dirname, '../../../../');

export interface SimulationBootstrapResult {
  eventStore: EventStore;
  capabilityEngine: CapabilityEngine;
  projectionEngine: ProjectionEngine;
  kernelExecutor: KernelExecutor;
  stateRegistry: StateRegistry;
}

export async function bootstrapSimulation(_seed = 0xDEADBEEF): Promise<SimulationBootstrapResult> {
  process.env.SOVR_TEST_XXIII_GATES = 'true';
  const eventStore = createDeterministicEventStore(_seed);
  const capabilityEngine = new CapabilityEngine(PROTOCOL_ROOT);
  const projectionEngine = new ProjectionEngine();
  const machines = new JsonRegistryLoader().loadMachines();

  const stateRegistry = new StateRegistry(
    (domain: string | undefined, aggregate: string) => {
      if (!domain) return undefined;
      for (const [name, def] of Object.entries((machines as any).entries ?? {}) as Array<[string, any]>) {
        if (name === 'abi' || !def || typeof def !== 'object') continue;
        if (def.domain === domain && def.aggregate === aggregate) {
          return def.initial_state ?? def.initialState;
        }
      }
      return undefined;
    },
    { usePostgres: false }
  );

  const commandBus = new CommandBus(PROTOCOL_ROOT, eventStore, capabilityEngine, projectionEngine);
  await commandBus.ready();
  await stateRegistry.rebuildFromEventLog(eventStore);

  return {
    eventStore,
    capabilityEngine,
    projectionEngine,
    kernelExecutor: (commandBus as any).kernelExecutor,
    stateRegistry,
  };
}
