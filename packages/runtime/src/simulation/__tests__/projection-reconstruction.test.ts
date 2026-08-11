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

describe('Phase 10B Projection Reconstruction Certification', () => {
  it('rebuilds identical projection state from genesis after clearing', async () => {
    const registry = loadCompiledRegistry();
    const compiled = registry['SIM-004-ASSET-RESERVE-LIFECYCLE'];

    const bootstrap = await bootstrapSimulation(0xDEADBEEF);
    const { kernelExecutor, projectionEngine, eventStore } = bootstrap;

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
      for (const event of result.events ?? []) {
        projectionEngine.handleEvent(event);
      }
    }

    const projectionName = 'vault_holdings';
    const beforeProjection = projectionEngine.getProjection(projectionName);
    const beforeHash = computeMapHash(beforeProjection);

    projectionEngine.rebuildFromGenesis([]);
    const clearedProjection = projectionEngine.getProjection(projectionName);
    expect(clearedProjection?.size ?? 0).toBe(0);

    const events = eventStore.getAll();
    projectionEngine.rebuildFromGenesis(events);
    const afterProjection = projectionEngine.getProjection(projectionName);
    const afterHash = computeMapHash(afterProjection);

    expect(afterHash).toBe(beforeHash);
    expect(afterProjection?.size ?? 0).toBeGreaterThan(0);
  });
});

function computeMapHash(map: Map<string, any> | undefined): string {
  if (!map) return '';
  const entries = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}
