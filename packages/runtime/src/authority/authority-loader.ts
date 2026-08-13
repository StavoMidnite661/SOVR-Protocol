// ============================================================
// SOVR Authority Registry Loader
// Phase 10B.1: Loads compiler-generated authority artifacts ONLY.
//
// The runtime must have exactly one authority source: compiler-generated
// artifacts. This loader reads JSON registries from generated/registries/
// and validates their integrity before returning them to consumers.
// ============================================================

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IntegrityValidator } from './integrity-validator.js';
import type {
  CommandRegistry,
  EventRegistry,
  ConstitutionRegistry,
  CapabilityRegistry,
  MachineRegistry,
  AuthorityRegistryLoader,
} from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROTOCOL_ROOT = join(__dirname, '../../../../');
const REGISTRIES_DIR = join(PROTOCOL_ROOT, 'generated', 'registries');

export class JsonRegistryLoader implements AuthorityRegistryLoader {
  private readonly validator = new IntegrityValidator();

  constructor(private readonly registriesDir: string = REGISTRIES_DIR) {}

  loadCommands(): CommandRegistry {
    const registry = this.loadJson<CommandRegistry>('commands.registry.json');
    this.validator.assert(registry, 'commands.registry.json');
    return registry;
  }

  loadEvents(): EventRegistry {
    const events = this.loadJson<EventRegistry>('events.registry.json');
    this.validator.assert(events, 'events.registry.json');

    const envelopes = this.loadJson<{ entries: { event_envelope: { fields: Record<string, unknown> } } }>('envelopes.registry.json');
    this.validator.assert(envelopes, 'envelopes.registry.json');

    (events as any).event_envelope = envelopes.entries.event_envelope;
    return events;
  }

  loadConstitution(): ConstitutionRegistry {
    const registry = this.loadJson<ConstitutionRegistry>('constitution.registry.json');
    this.validator.assert(registry, 'constitution.registry.json');
    return registry;
  }

  loadCapabilities(): CapabilityRegistry {
    const registry = this.loadJson<CapabilityRegistry>('capabilities.registry.json');
    this.validator.assert(registry, 'capabilities.registry.json');
    return registry;
  }

  loadMachines(): MachineRegistry {
    const registry = this.loadJson<MachineRegistry>('machines.registry.json');
    this.validator.assert(registry, 'machines.registry.json');
    return registry;
  }

  loadAll(): {
    commands: CommandRegistry;
    events: EventRegistry;
    constitution: ConstitutionRegistry;
    capabilities: CapabilityRegistry;
    machines: MachineRegistry;
  } {
    return {
      commands: this.loadCommands(),
      events: this.loadEvents(),
      constitution: this.loadConstitution(),
      capabilities: this.loadCapabilities(),
      machines: this.loadMachines(),
    };
  }

  private loadJson<T>(filename: string): T {
    const fullPath = join(this.registriesDir, filename);
    const content = readFileSync(fullPath, 'utf8');
    return JSON.parse(content) as T;
  }
}

export { IntegrityValidator, AuthorityRegistryIntegrityError } from './integrity-validator.js';
export type { IntegrityVerifyResult } from './integrity-validator.js';
export type {
  CommandRegistry,
  EventRegistry,
  ConstitutionRegistry,
  CapabilityRegistry,
  CommandRegistryEntry,
  CommandLifecycleCoverage,
  EventRegistryEntry,
  EventEnvelope,
  IntegrityBlock,
  AuthorityRegistryLoader,
  MachineRegistry,
} from './types.js';
