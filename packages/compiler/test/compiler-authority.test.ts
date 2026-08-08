import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');

function readJson(p: string) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

async function readYaml(p: string) {
  const { default: yaml } = await import('js-yaml');
  return yaml.load(readFileSync(p, 'utf8'));
}

describe('Compiler Authority Certification', () => {
  const commandsYaml = readYaml(join(ROOT, '03_command-catalog.yaml'));
  const registry = readJson(join(ROOT, 'generated', 'registries', 'commands.registry.json'));

  it('preserves execution_gates from YAML to generated registry', async () => {
    const yamlCommands = (await commandsYaml).commands ?? {};
    const registryEntries = registry.entries ?? {};

    for (const [name, def] of Object.entries(yamlCommands)) {
      const gates = (def as any).execution_gates ?? [];
      const regEntry = registryEntries[name];
      if (!regEntry) continue;

      const regGates = regEntry.execution_gates ?? [];
      expect(regGates.length).toBe(gates.length);

      for (let i = 0; i < gates.length; i++) {
        expect(regGates[i].type).toBe(gates[i].type);
        expect(regGates[i].gate_id).toBe(gates[i].gate_id);
        expect(regGates[i].fatal).toBe(gates[i].fatal);
      }
    }
  });

  it('fails if YAML declares gate and registry is missing gate', async () => {
    const yamlCommands = (await commandsYaml).commands ?? {};
    const registryEntries = registry.entries ?? {};
    let missing = 0;

    for (const [name, def] of Object.entries(yamlCommands)) {
      const gates = (def as any).execution_gates ?? [];
      if (gates.length === 0) continue;
      const regEntry = registryEntries[name];
      if (!regEntry || !regEntry.execution_gates || regEntry.execution_gates.length === 0) {
        missing++;
      }
    }

    expect(missing).toBe(0);
  });

  it('preserves AMOUNT_WITHIN_LIMIT gate for treasury.transfer.request', async () => {
    const yamlCommands = (await commandsYaml).commands ?? {};
    const yamlDef = yamlCommands['treasury.transfer.request'];
    expect(yamlDef).toBeDefined();
    const yamlGates = (yamlDef as any).execution_gates ?? [];
    const yamlAmountGate = yamlGates.find((g: any) => g.type === 'AMOUNT_WITHIN_LIMIT');
    expect(yamlAmountGate).toBeDefined();

    const entry = registry.entries['treasury.transfer.request'];
    expect(entry).toBeDefined();
    const gates = entry.execution_gates ?? [];
    const amountGate = gates.find((g: any) => g.type === 'AMOUNT_WITHIN_LIMIT');
    expect(amountGate).toBeDefined();
    expect(amountGate.gate_id).toBe('amount_within_limit');
    expect(amountGate.config.maxAmount).toBe('50');
    expect(amountGate.config.currency).toBe('USD');
  });

  it('preserves AMOUNT_WITHIN_LIMIT gate for vault.transaction.fund', async () => {
    const yamlCommands = (await commandsYaml).commands ?? {};
    const yamlDef = yamlCommands['vault.transaction.fund'];
    expect(yamlDef).toBeDefined();
    const yamlGates = (yamlDef as any).execution_gates ?? [];
    const yamlAmountGate = yamlGates.find((g: any) => g.type === 'AMOUNT_WITHIN_LIMIT');
    expect(yamlAmountGate).toBeDefined();

    const entry = registry.entries['vault.transaction.fund'];
    expect(entry).toBeDefined();
    const gates = entry.execution_gates ?? [];
    const amountGate = gates.find((g: any) => g.type === 'AMOUNT_WITHIN_LIMIT');
    expect(amountGate).toBeDefined();
    expect(amountGate.config.maxAmount).toBe('50');
  });
});
