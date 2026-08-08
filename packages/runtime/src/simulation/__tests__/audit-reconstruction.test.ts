import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrapSimulation } from '../simulation-bootstrap.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../');

function loadCompiledRegistry(): Record<string, any> {
  const content = readFileSync(join(ROOT, 'generated', 'simulation', 'scenarios.registry.json'), 'utf8');
  const registry = JSON.parse(content);
  return registry.scenarios;
}

describe('Phase 10B Audit Reconstruction Engine', () => {
  it('generates deterministic audit proof for SIM-004', async () => {
    const registry = loadCompiledRegistry();
    const compiled = registry['SIM-004-ASSET-RESERVE-LIFECYCLE'];

    const bootstrap = await bootstrapSimulation(0xDEADBEEF);
    const { kernelExecutor, projectionEngine, eventStore } = bootstrap;

    const executedCommands: any[] = [];
    for (const cmd of compiled.commands) {
      const capabilityId = cmd.capability_id ?? `${cmd.domain}.${cmd.aggregate}.create`;
      const scope = cmd.scope ?? `${cmd.domain}.${cmd.aggregate}:*`;

      if (!cmd.skip_capability_grant) {
        bootstrap.capabilityEngine.grant({
          capability_id: capabilityId,
          actor_id: compiled.actors[0].actor_id,
          scope_pattern: scope,
          granted_by: 'simulation',
        });
      }

      const envelope = {
        command_id: cmd.command_id,
        command_name: cmd.command_name,
        aggregate: cmd.aggregate,
        source_domain: cmd.domain,
        payload: cmd.payload,
        identity_context: {
          identity_id: compiled.actors[0].identity_id,
          actor_id: compiled.actors[0].actor_id,
          actor_type: compiled.actors[0].actor_type,
          session_id: compiled.actors[0].session_id ?? `sim-${compiled.scenario_id}`,
        },
        capability_id: capabilityId,
        scope: scope,
        correlation_id: cmd.command_id,
        causation_id: cmd.command_id,
        meta: {},
      };

      const result = await kernelExecutor.execute(envelope);
      executedCommands.push({ ...cmd, result: result.status });
      for (const event of result.events ?? []) {
        projectionEngine.handleEvent(event);
      }
    }

    const events = eventStore.getAll();
    const { ProofManifestGenerator } = await import('../../audit/reconstruction/ProofManifestGenerator.js');
    const generator = new ProofManifestGenerator();
    const proof = generator.generate(compiled.scenario_id, events, executedCommands);

    expect(proof.scenario_id).toBe('SIM-004-ASSET-RESERVE-LIFECYCLE');
    expect(proof.merkle_root).toBeTruthy();
    expect(proof.merkle_root).toHaveLength(64);
    expect(proof.deterministic_hash).toBeTruthy();
    expect(proof.command_sequence.length).toBe(4);
    expect(proof.event_sequence.length).toBeGreaterThan(0);
    expect(proof.build_hash).toBeTruthy();
  });
});
