import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../');

describe('Phase 10C Economic Domain Registry Certification', () => {
  it('generates economic.registry.json with integrity block', () => {
    const path = join(ROOT, 'generated', 'registries', 'economic.registry.json');
    const content = readFileSync(path, 'utf8');
    const registry = JSON.parse(content);
    expect(registry.abi_version).toBe('v1');
    expect(registry.kind).toBe('economic');
    expect(registry.entry_count).toBeGreaterThan(0);
    expect(registry.integrity).toBeDefined();
    expect(registry.integrity.algorithm).toBe('SHA256');
    expect(registry.integrity.hash).toBeTruthy();
    expect(registry.integrity.generated_by.compiler_version).toBe('0.6.0');
  });

  it('generates settlement.registry.json with integrity block', () => {
    const path = join(ROOT, 'generated', 'registries', 'settlement.registry.json');
    const content = readFileSync(path, 'utf8');
    const registry = JSON.parse(content);
    expect(registry.abi_version).toBe('v1');
    expect(registry.kind).toBe('settlement');
    expect(registry.entry_count).toBeGreaterThan(0);
    expect(registry.integrity).toBeDefined();
    expect(registry.lifecycle).toContain('CREATED');
    expect(registry.lifecycle).toContain('VERIFIED');
  });

  it('generates reserve.registry.json with integrity block', () => {
    const path = join(ROOT, 'generated', 'registries', 'reserve.registry.json');
    const content = readFileSync(path, 'utf8');
    const registry = JSON.parse(content);
    expect(registry.abi_version).toBe('v1');
    expect(registry.kind).toBe('reserve');
    expect(registry.entry_count).toBeGreaterThan(0);
    expect(registry.integrity).toBeDefined();
    expect(registry.reserve_policy).toBe('Requested <= Approved <= Reserved <= Available');
  });
});
