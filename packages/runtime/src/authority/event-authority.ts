// ============================================================
// Event Authority — Adapter for the events + envelopes registries
// Phase 10B.1: Replaces YAML-based event definition loading with
// compiler-generated registry artifacts.
// ============================================================

import type { EventRegistry, EventRegistryEntry, EventEnvelope } from './types.js';

export interface EventEnvelopeSpec {
  fields: Record<string, unknown>;
}

export class EventAuthority {
  constructor(
    private readonly eventsRegistry: EventRegistry,
    private readonly envelopesRegistry: EventRegistry,
  ) {}

  has(eventName: string): boolean {
    return eventName in (this.eventsRegistry.entries ?? {});
  }

  get(eventName: string): EventRegistryEntry | undefined {
    return this.eventsRegistry.entries?.[eventName];
  }

  getEnvelope(): EventEnvelopeSpec {
    const env = this.eventsRegistry.event_envelope ?? this.envelopesRegistry.entries.event_envelope;
    return { fields: (env?.fields ?? {}) as Record<string, unknown> };
  }

  getFields(): Record<string, unknown> {
    return this.getEnvelope().fields;
  }

  getAggregate(eventName: string): string | undefined {
    return this.eventsRegistry.entries?.[eventName]?.aggregate;
  }

  getSourceDomain(eventName: string): string | undefined {
    return this.eventsRegistry.entries?.[eventName]?.source_domain;
  }

  getProjectionEffect(eventName: string): { target: string; operation: string } | undefined {
    return this.eventsRegistry.entries?.[eventName]?.projection_effect;
  }

  allEventNames(): string[] {
    return Object.keys(this.eventsRegistry.entries ?? {});
  }

  getEnvelopeFields(): Record<string, unknown> {
    const env = this.eventsRegistry.event_envelope ?? this.envelopesRegistry.entries.event_envelope;
    return (env?.fields ?? {}) as Record<string, unknown>;
  }
}
