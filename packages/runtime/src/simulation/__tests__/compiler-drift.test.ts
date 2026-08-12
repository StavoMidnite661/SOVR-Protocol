import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../');
const SCENARIO_FILE = join(ROOT, 'governance', 'simulation', 'scenarios', 'SIM-001-VAULT-FUNDING-LIFECYCLE.yaml');

// Repaired contract: the compiled scenario carries the nested integrity
// block (integrity.hash). The legacy flat `integrity_hash` field is no
// longer emitted by the compiler (see SIMULATION_REGISTRY_ABI_v1 history
// and the determinism remediation).
function getRegistryHash(): string {
  const content = readFileSync(join(ROOT, 'generated', 'simulation', 'scenarios.registry.json'), 'utf8');
  const registry = JSON.parse(content);
  const scenario = registry.scenarios['SIM-001-VAULT-FUNDING-LIFECYCLE'];
  return scenario.integrity.hash;
}

function compile(): void {
  // Isolated compilation subcommand: runs the real current compiler from
  // dist without the two-process verification overhead (drift detection
  // only needs regeneration).
  execSync('node packages/compiler/dist/cli.js __compile-isolated', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

describe('Phase 10A.1 Compiler Drift Detection', () => {
  it('detects hash change when YAML is modified', () => {
    const originalContent = readFileSync(SCENARIO_FILE, 'utf8');
    const originalHash = getRegistryHash();

    const modifiedContent = originalContent.replace('amount: 1000', 'amount: 1001');
    if (modifiedContent === originalContent) {
      return;
    }

    try {
      writeFileSync(SCENARIO_FILE, modifiedContent, 'utf8');
      compile();

      const modifiedHash = getRegistryHash();
      expect(modifiedHash).not.toBe(originalHash);
    } finally {
      writeFileSync(SCENARIO_FILE, originalContent, 'utf8');
      compile();
    }
  });

  it('restores original hash when YAML is reverted', () => {
    const originalContent = readFileSync(SCENARIO_FILE, 'utf8');
    const originalHash = getRegistryHash();

    const modifiedContent = originalContent.replace('amount: 1000', 'amount: 1001');
    if (modifiedContent === originalContent) {
      return;
    }

    try {
      writeFileSync(SCENARIO_FILE, modifiedContent, 'utf8');
      compile();

      writeFileSync(SCENARIO_FILE, originalContent, 'utf8');
      compile();

      const restoredHash = getRegistryHash();
      expect(restoredHash).toBe(originalHash);
    } finally {
      writeFileSync(SCENARIO_FILE, originalContent, 'utf8');
      compile();
    }
  });
});
