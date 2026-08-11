import type { Projection } from '../server/projectionEngine.js';
import type { EventEnvelope } from '../server/eventStore.js';

export function createIdentityDirectory(): Projection {
  const state = new Map<string, any>();
  return {
    name: 'identity_directory',
    description: 'Active identities, trust levels, and credentials',
    sourceEvents: [
      'identity.actor.registered',
      'identity.actor.verified',
      'identity.actor.suspended',
      'identity.actor.revoked',
      'identity.credential.issued',
      'identity.credential.expired',
      'identity.credential.revoked',
      'identity.delegation.created',
      'identity.delegation.revoked',
      'identity.delegation.expired',
      'identity.session.created',
      'identity.session.terminated',
    ],
    state,
    buildFromGenesis(events) {
      state.clear();
      for (const e of events) this.handleEvent(e);
    },
    handleEvent(event: EventEnvelope) {
      const identityId = event.payload?.identity_id || event.aggregate_id || event.actor_id;
      if (!state.has(identityId)) {
        state.set(identityId, {
          identity_id: identityId,
          state: 'UNKNOWN',
          actor_type: event.payload?.actor_type || 'UNKNOWN',
          trust_level: 'NONE',
          verified_at: undefined as string | undefined,
          active_credentials: 0,
          active_delegations: 0,
          active_sessions: 0,
        });
      }
      const entry = state.get(identityId)!;
      switch (event.event_name) {
        case 'identity.actor.registered':
          entry.state = 'REGISTERED';
          entry.actor_type = event.payload?.actor_type || entry.actor_type;
          break;
        case 'identity.actor.verified':
          entry.state = 'VERIFIED';
          entry.trust_level = event.payload?.trust_level_assigned || entry.trust_level;
          entry.verified_at = event.timestamp;
          break;
        case 'identity.actor.suspended':
          entry.state = 'SUSPENDED';
          break;
        case 'identity.actor.revoked':
          entry.state = 'REVOKED';
          break;
        case 'identity.credential.issued':
          entry.active_credentials += 1;
          break;
        case 'identity.credential.expired':
          entry.active_credentials = Math.max(0, entry.active_credentials - 1);
          break;
        case 'identity.credential.revoked':
          entry.active_credentials = Math.max(0, entry.active_credentials - 1);
          break;
        case 'identity.delegation.created':
          entry.active_delegations += 1;
          break;
        case 'identity.delegation.revoked':
          entry.active_delegations = Math.max(0, entry.active_delegations - 1);
          break;
        case 'identity.delegation.expired':
          entry.active_delegations = Math.max(0, entry.active_delegations - 1);
          break;
        case 'identity.session.created':
          entry.active_sessions += 1;
          break;
        case 'identity.session.terminated':
          entry.active_sessions = Math.max(0, entry.active_sessions - 1);
          break;
      }
    },
  };
}
