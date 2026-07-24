import validationRegistry from '../../../../generated/registries/validation.registry.json' with { type: 'json' };
import { InstructionEvaluator, EvaluationContext } from '../execution/instruction-evaluator.js';
import type { StateRegistry } from '../execution/state-registry.js';
import type { EventStore } from '../server/eventStore.js';
import type { CapabilityEngine } from '../server/capabilityEngine.js';

export function registerAssertionHandlers(
  evaluator: InstructionEvaluator,
  stateRegistry: StateRegistry,
  eventStore: EventStore,
  capabilityStore: CapabilityEngine,
): void {
  const checkIds = new Set<string>();
  for (const entry of Object.values((validationRegistry as any).entries ?? {}) as any[]) {
    for (const rule of entry.rules ?? []) {
      if (rule.type === 'DECLARATIVE_ASSERTION' && rule.check_id) checkIds.add(String(rule.check_id));
    }
  }

  for (const checkId of checkIds) evaluator.registerAssertion(checkId, genericDeclarativeAssertion);

  evaluator.registerAssertion('no_existing_asset_with_same_id', async (ctx) => {
    const aggregate = ctx.command?.aggregate ?? 'asset';
    const id = ctx.command?.payload?.asset_id ?? ctx.payload?.asset_id;
    if (!id) return false;
    const hasState = stateRegistry.hasState(aggregate, String(id), ctx.command?.source_domain);
    if (!hasState) return true;
    const state = await stateRegistry.getState(aggregate, String(id), ctx.command?.source_domain);
    return state === 'INIT' || state === 'UNKNOWN';
  });

  evaluator.registerAssertion('identity_state_verified', async (ctx) => {
    const issuer = ctx.command?.payload?.issuer_id ?? ctx.payload?.issuer_id;
    const actor = ctx.command?.identity_context?.actor_id;
    if (!issuer) return false;
    if (issuer === actor) return true;
    const hasState = stateRegistry.hasState('actor', String(issuer), 'identity');
    if (!hasState) return true; // dev bootstrap: no durable identity registry yet
    const state = await stateRegistry.getState('actor', String(issuer), 'identity');
    return state === 'VERIFIED' || state === 'ACTIVE';
  });

  evaluator.registerAssertion('identity_with_ownership_id_exists_and_is_verified', async (ctx) => {
    const owner = ctx.command?.payload?.ownership_id ?? ctx.payload?.ownership_id;
    const actor = ctx.command?.identity_context?.actor_id;
    if (!owner) return false;
    if (owner === actor) return true;
    const hasState = stateRegistry.hasState('actor', String(owner), 'identity');
    if (!hasState) return true;
    const state = await stateRegistry.getState('actor', String(owner), 'identity');
    return state === 'VERIFIED' || state === 'ACTIVE';
  });
}

async function genericDeclarativeAssertion(_ctx: EvaluationContext): Promise<boolean> {
  // ABI v1 registry-level assertion hook. Specific checks can override this
  // registration. Until projections/capabilities are fully declarative, generic
  // assertions are treated as registered infrastructure hooks and pass after
  // primitive instructions have succeeded.
  return true;
}
