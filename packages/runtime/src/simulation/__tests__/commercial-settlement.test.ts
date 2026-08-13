import { describe, it, expect } from 'vitest';
import { SimulationRunner } from '../simulation-runner.js';
import { bootstrapSimulation } from '../simulation-bootstrap.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../');

function loadCompiledScenarios(): Record<string, any> {
  const content = readFileSync(join(ROOT, 'generated', 'simulation', 'scenarios.registry.json'), 'utf8');
  return JSON.parse(content).scenarios;
}

describe('AMD-0005 Commercial Settlement Suite — runtime materialization', () => {
  it('SIM-008: full chain compiles into scenario registry and executes ACCEPTED end-to-end', async () => {
    const registry = loadCompiledScenarios();
    const compiled = registry['SIM-008-COMMERCIAL-SETTLEMENT-LIFECYCLE'];
    expect(compiled, 'SIM-008 must be compiled into the scenario registry').toBeTruthy();
    const runner = new SimulationRunner();
    const report = await runner.run({
      scenario_id: 'SIM-008-COMMERCIAL-SETTLEMENT-LIFECYCLE',
      commands: compiled.commands,
      actor_context: compiled.actors[0],
      lifecycle: compiled.lifecycle,
      seed: 0xDEADBEEF,
    } as any);
    expect(report.result.error ?? '').toBe('');
    expect(report.result.commands_rejected).toBe(0);
    expect(report.result.commands_executed).toBe(10);
    expect(report.result.lifecycle_verified).toBe(true);
    expect(report.result.success).toBe(true);
    expect(report.result.events_generated).toBeGreaterThanOrEqual(11);
  });

  it('SIM-009: cancel/dispute branch commands execute ACCEPTED', async () => {
    const registry = loadCompiledScenarios();
    const compiled = registry['SIM-009-COMMERCIAL-SETTLEMENT-BRANCHES'];
    expect(compiled, 'SIM-009 must be compiled into the scenario registry').toBeTruthy();
    const runner = new SimulationRunner();
    const report = await runner.run({
      scenario_id: 'SIM-009-COMMERCIAL-SETTLEMENT-BRANCHES',
      commands: compiled.commands,
      actor_context: compiled.actors[0],
      lifecycle: compiled.lifecycle,
      seed: 0xDEADBEEF,
    } as any);
    expect(report.result.error ?? '').toBe('');
    expect(report.result.commands_rejected).toBe(0);
    expect(report.result.commands_executed).toBe(11);
    expect(report.result.success).toBe(true);
  });

  it('executes the AMD-0005 chain through the kernel against compiled registries, in order', async () => {
    const boot = await bootstrapSimulation();
    const kernel: any = boot.kernelExecutor;
    const caps: any = boot.capabilityEngine;
    const humanActor = {
      identity_id: 'sim-commercial-operator-id',
      actor_id: 'sim-commercial-operator',
      actor_type: 'human',
      session_id: 'sim-commercial-session-008',
    };
    // Archival is a system/governance-actor operation per the command's
    // issuer contract (issuer.actor_types is runtime-enforced).
    const systemActor = {
      identity_id: 'sim-archival-service-id',
      actor_id: 'sim-archival-service',
      actor_type: 'system',
      session_id: 'sim-archival-session-008',
    };
    const actorFor = (c: any) => (c.actor_context
      ? { identity_id: c.actor_context.identity_id, actor_id: c.actor_context.actor_id, actor_type: c.actor_context.actor_type, session_id: c.actor_context.session_id }
      : humanActor);
    const grants = new Set<string>();
    const envelopeFor = (c: any) => {
      const actor = actorFor(c);
      const key = `${actor.actor_id}:${c.capability_id}`;
      if (!grants.has(key)) {
        caps.grant({
          capability_id: c.capability_id,
          actor_id: actor.actor_id,
          scope_pattern: c.scope,
          granted_by: 'simulation',
        });
        grants.add(key);
      }
      return {
        command_id: c.command_id,
        command_name: c.command_name,
        aggregate: c.aggregate,
        source_domain: c.domain,
        payload: c.payload,
        identity_context: actor,
        capability_id: c.capability_id,
        scope: c.scope,
        correlation_id: c.command_id,
        causation_id: c.command_id,
        meta: {},
      };
    };

    const registry = loadCompiledScenarios();
    const compiled = registry['SIM-008-COMMERCIAL-SETTLEMENT-LIFECYCLE'];
    for (const cmd of compiled.commands) {
      const result = await kernel.execute(envelopeFor(cmd));
      expect(
        result.status,
        `${cmd.command_name} rejected: ${result.error ?? result.rejectionReason ?? result.error_type ?? ''}`,
      ).toBe('ACCEPTED');
    }

    const eventNames = boot.eventStore.getAll().map((e: any) => e.event_name);
    const expectedOrder = [
      'CommercialRecordCreated',
      'ObligationValidated',
      'SettlementAuthorized',
      'SettlementExecuted',
      'EvidencePackageGenerated',
      'AttestationSigned',
      'SettlementFinalized',
      'EvidencePackagePublished',
      'EvidencePackageArchived',
      'SVUIssued',
      'SVURedeemed',
    ];
    let cursor = -1;
    for (const name of expectedOrder) {
      const idx = eventNames.indexOf(name, cursor + 1);
      expect(idx, `event ${name} must be emitted after position ${cursor}; got: ${eventNames.join(', ')}`).toBeGreaterThan(cursor);
      cursor = idx;
    }

    // INV-001: authority state derives from the immutable event log.
    // Rebuild all aggregate states from the emitted events and verify.
    await boot.stateRegistry.rebuildFromEventLog(boot.eventStore);
    const states = boot.stateRegistry;
    expect(await states.getState('commercial_obligation', 'SOVR-OBL-000001', 'commercial')).toBe('VALIDATED');
    expect(await states.getState('settlement_record', 'SOVR-SET-000001', 'settlement')).toBe('FINALIZED');
    expect(await states.getState('evidence_package', 'SOVR-EVP-000001', 'certification')).toBe('ARCHIVED');
    expect(await states.getState('settlement_value_unit', 'SOVR-SVU-000001', 'representation')).toBe('REDEEMED');
  });

  it('rejects an illegal transition (double validation of the same obligation)', async () => {
    const boot = await bootstrapSimulation(0xABCD);
    const kernel: any = boot.kernelExecutor;
    const caps: any = boot.capabilityEngine;
    const actor = {
      identity_id: 'sim-operator-d',
      actor_id: 'sim-operator-d',
      actor_type: 'human',
      session_id: 'sim-session-d',
    };
    const registry = loadCompiledScenarios();
    const compiled = registry['SIM-008-COMMERCIAL-SETTLEMENT-LIFECYCLE'];
    const create = compiled.commands[0];
    const validate = compiled.commands[1];
    for (const c of [create, validate]) {
      caps.grant({ capability_id: c.capability_id, actor_id: actor.actor_id, scope_pattern: c.scope, granted_by: 'simulation' });
    }
    const env = (c: any) => ({
      command_id: c.command_id,
      command_name: c.command_name,
      aggregate: c.aggregate,
      source_domain: c.domain,
      payload: c.payload,
      identity_context: actor,
      capability_id: c.capability_id,
      scope: c.scope,
      correlation_id: c.command_id,
      causation_id: c.command_id,
      meta: {},
    });
    expect((await kernel.execute(env(create))).status).toBe('ACCEPTED');
    expect((await kernel.execute(env(validate))).status).toBe('ACCEPTED');
    // State sovereignty violations surface as InvalidStateTransitionError
    // thrown out of the kernel (fail-closed), not as silent acceptance.
    let thrown: any = null;
    try {
      await kernel.execute(env({ ...validate, command_id: 'dup-validate-1' }));
    } catch (e: any) {
      thrown = e;
    }
    expect(thrown, 'second ValidateObligation on a VALIDATED obligation must throw').toBeTruthy();
    expect(String(thrown?.message ?? thrown)).toMatch(/does not accept|Final state|INVALID_STATE_TRANSITION/i);
  });
});
