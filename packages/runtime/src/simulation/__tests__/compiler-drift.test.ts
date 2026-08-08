import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../');
const SCENARIO_FILE = join(ROOT, 'governance', 'simulation', 'scenarios', 'SIM-001-VAULT-FUNDING-LIFECYCLE.yaml');

function getRegistryHash(): string {
  const content = readFileSync(join(ROOT, 'generated', 'simulation', 'scenarios.registry.json'), 'utf8');
  const registry = JSON.parse(content);
  const scenario = registry.scenarios['SIM-001-VAULT-FUNDING-LIFECYCLE'];
  return scenario.integrity_hash;
}

function compile(): void {
  execSync('node packages/compiler/dist/cli.js compile', {
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
      require('fs').writeFileSync(SCENARIO_FILE, modifiedContent, 'utf8');
      compile();

      const modifiedHash = getRegistryHash();
      expect(modifiedHash).not.toBe(originalHash);
    } finally {
      require('fs').writeFileSync(SCENARIO_FILE, originalContent, 'utf8');
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
      require('fs').writeFileSync(SCENARIO_FILE, modifiedContent, 'utf8');
      compile();

      require('fs').writeFileSync(SCENARIO_FILE, originalContent, 'utf8');
      compile();

      const restoredHash = getRegistryHash();
      expect(restoredHash).toBe(originalHash);
    } finally {
      require('fs').writeFileSync(SCENARIO_FILE, originalContent, 'utf8');
      compile();
    }
  });
});
