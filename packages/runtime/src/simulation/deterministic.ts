// ============================================================
// SOVR Financial OS — Deterministic Primitives for Simulation
// Provides controllable UUID and timestamp generation.
// ============================================================

let seed = 0;
let counter = 0;
let baseTime = new Date('2026-08-07T00:00:00.000Z').getTime();
let timeOffset = 0;

export function setSimulationSeed(s: number): void {
  seed = s;
  counter = 0;
  baseTime = new Date('2026-08-07T00:00:00.000Z').getTime();
  timeOffset = 0;
}

export function resetSimulationTime(): void {
  timeOffset = 0;
}

export function advanceSimulationTime(ms: number): void {
  timeOffset += ms;
}

export function deterministicUUID(): string {
  const h = (seed ^ (counter * 0x9e3779b9)) >>> 0;
  const parts = [
    h.toString(16).padStart(8, '0'),
    ((h >>> 16) ^ (counter * 0x85ebca6b)).toString(16).padStart(4, '0'),
    ((counter * 0xc2b2ae35) >>> 0).toString(16).padStart(4, '0'),
    ((seed * 0xa5a5a5a5) >>> 0).toString(16).padStart(4, '0'),
    ((counter * 0x12345678) >>> 0).toString(16).padStart(12, '0'),
  ];
  counter++;
  return parts.join('-');
}

export function deterministicTimestamp(): string {
  const ts = baseTime + timeOffset + counter * 1000;
  return new Date(ts).toISOString();
}

export function deterministicCommandId(): string {
  return `cmd-${deterministicUUID()}`;
}

export function deterministicCorrelationId(): string {
  return `corr-${deterministicUUID()}`;
}
