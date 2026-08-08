import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../');

describe('Phase 10A.1 Simulation Registry Schema Validation', () => {
  it('all compiled scenarios have required fields', () => {
    const content = readFileSync(join(ROOT, 'generated', 'simulation', 'scenarios.registry.json'), 'utf8');
    const registry = JSON.parse(content) as {
      abi_version: string;
      integrity: { algorithm: string; hash: string };
      scenarios: Record<string, any>;
    };

    expect(registry.abi_version).toBe('v1');
    expect(registry.integrity).toBeTruthy();
    expect(registry.integrity.algorithm).toBe('SHA256');
    expect(registry.integrity.hash).toBeTruthy();

    for (const [scenarioId, scenario] of Object.entries(registry.scenarios)) {
      expect(scenario.scenario_id).toBe(scenarioId);
      expect(scenario.name).toBeTruthy();
      expect(scenario.description).toBeTruthy();
      expect(Array.isArray(scenario.actors)).toBe(true);
      expect(scenario.actors.length).toBeGreaterThan(0);
      expect(Array.isArray(scenario.commands)).toBe(true);
      expect(scenario.commands.length).toBeGreaterThan(0);
    }
  });

  it('all compiled commands exist in compiler command registry', () => {
    const simContent = readFileSync(join(ROOT, 'generated', 'simulation', 'scenarios.registry.json'), 'utf8');
    const simRegistry = JSON.parse(simContent) as { scenarios: Record<string, any> };
    const cmdContent = readFileSync(join(ROOT, 'generated', 'registries', 'commands.registry.json'), 'utf8');
    const cmdRegistry = JSON.parse(cmdContent) as { entries: Record<string, unknown> };

    const validCommands = new Set(Object.keys(cmdRegistry.entries ?? {}));

    for (const scenario of Object.values(simRegistry.scenarios)) {
      for (const cmd of scenario.commands) {
        expect(validCommands.has(cmd.command_name)).toBe(true);
      }
    }
  });

  it('all compiled events exist in compiler event registry', () => {
    const simContent = readFileSync(join(ROOT, 'generated', 'simulation', 'scenarios.registry.json'), 'utf8');
    const simRegistry = JSON.parse(simContent) as { scenarios: Record<string, any> };
    const eventContent = readFileSync(join(ROOT, 'generated', 'registries', 'events.registry.json'), 'utf8');
    const eventRegistry = JSON.parse(eventContent) as { entries: Record<string, unknown> };

    const validEvents = new Set(Object.keys(eventRegistry.entries ?? {}));

    for (const scenario of Object.values(simRegistry.scenarios)) {
      if (scenario.expected_events) {
        for (const evt of scenario.expected_events) {
          expect(validEvents.has(evt.event_name)).toBe(true);
        }
      }
    }
  });
});
