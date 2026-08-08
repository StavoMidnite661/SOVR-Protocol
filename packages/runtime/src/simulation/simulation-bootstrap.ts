// ============================================================
// SOVR Financial OS — Simulation Bootstrap
// Wires runtime components for isolated simulation execution.
// No production adapters. No external I/O.
// ============================================================

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDeterministicEventStore } from './deterministic-event-store.js';
import { EventStore } from '../server/eventStore.js';
import { CapabilityEngine } from '../server/capabilityEngine.js';
import { ProjectionEngine } from '../server/projectionEngine.js';
import { CommandBus } from '../server/commandBus.js';
import { StateMachineInterpreter } from '../execution/state-machine-interpreter.js';
import { StateRegistry } from '../execution/state-registry.js';
import { EventFactory } from '../execution/event-factory.js';
import { AtomicCommit } from '../execution/atomic-commit.js';
import { InstructionEvaluator } from '../execution/instruction-evaluator.js';
import { KernelExecutor } from '../execution/kernel-executor.js';
import { registerAssertionHandlers } from '../boot/assertion-registry.js';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROTOCOL_ROOT = path.resolve(__dirname, '../../../../');

export interface SimulationBootstrapResult {
  eventStore: EventStore;
  capabilityEngine: CapabilityEngine;
  projectionEngine: ProjectionEngine;
  kernelExecutor: KernelExecutor;
  stateMachineInterpreter: StateMachineInterpreter;
  stateRegistry: StateRegistry;
}

export async function bootstrapSimulation(seed = 0xDEADBEEF): Promise<SimulationBootstrapResult> {
  process.env.SOVR_TEST_XXIII_GATES = 'true';
  const eventStore = createDeterministicEventStore(seed);
  const capabilityEngine = new CapabilityEngine(PROTOCOL_ROOT);
  const projectionEngine = new ProjectionEngine();
  const stateMachineInterpreter = StateMachineInterpreter.fromFiles(
    path.join(PROTOCOL_ROOT, 'generated', 'sovr-ir.json'),
    undefined,
    { allowUnresolvedConditions: true }
  );

  const stateRegistry = new StateRegistry(
    (domain: string | undefined, aggregate: string) => {
      const machine = domain ? stateMachineInterpreter.getMachineFor(domain, aggregate) : undefined;
      return machine?.initialState;
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
    stateMachineInterpreter,
    stateRegistry,
  };
}
