// ============================================================
// SOVR Financial OS — Deterministic EventStore Factory
// Creates an EventStore with controllable ID and timestamp generation.
// ============================================================

import { EventStore } from '../server/eventStore.js';
import { deterministicUUID, deterministicTimestamp, setSimulationSeed, advanceSimulationTime } from './deterministic.js';

export function createDeterministicEventStore(seed = 0xDEADBEEF): EventStore {
  setSimulationSeed(seed);
  return new EventStore(undefined, {
    strictCausation: true,
    idGenerator: deterministicUUID,
    timestampGenerator: deterministicTimestamp,
  });
}
