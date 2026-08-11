import type { Projection } from '../server/projectionEngine.js';
import type { EventEnvelope } from '../server/eventStore.js';

export function createVaultHoldings(): Projection {
  const state = new Map<string, any>();
  const GLOBAL = 'global';
  return {
    name: 'vault_holdings',
    description: 'Current vault state, reserves, and collateral',
    sourceEvents: [
      'vault.asset.registered',
      'vault.asset.verified',
      'vault.asset.rejected',
      'vault.asset.impaired',
      'vault.asset.write_down',
      'vault.reserve.created',
      'vault.reserve.locked',
      'vault.reserve.released',
      'vault.reserve.expired',
      'vault.custody.attested',
      'vault.custody.proof_expired',
      'vault.valuation.updated',
      'vault.collateral.added',
      'vault.collateral.released',
      'vault.collateral.revalued',
      'vault.reconciliation.completed',
    ],
    state,
    buildFromGenesis(events) {
      state.clear();
      for (const e of events) this.handleEvent(e);
    },
    handleEvent(event: EventEnvelope) {
      if (!state.has(GLOBAL)) {
        state.set(GLOBAL, {
          total_assets_value: '0',
          total_collateral_held: '0',
          total_reserves_locked: '0',
          assets_by_state: {} as Record<string, number>,
          assets_by_type: {} as Record<string, number>,
          custody_proofs_active: 0,
          custody_proofs_expired: 0,
          last_reconciliation_at: undefined as string | undefined,
        });
      }
      const entry = state.get(GLOBAL)!;
      const assetId = event.payload?.asset_id;
      const amount = Number(event.payload?.amount || event.payload?.effective_value || event.payload?.reserved_amount || 0);
      switch (event.event_name) {
        case 'vault.asset.registered': {
          const assetType = event.payload?.asset_type || 'unknown';
          entry.assets_by_type[assetType] = (entry.assets_by_type[assetType] || 0) + 1;
          entry.assets_by_state['REGISTERED'] = (entry.assets_by_state['REGISTERED'] || 0) + 1;
          entry.total_assets_value = String(Number(entry.total_assets_value) + Number(event.payload?.face_value || 0));
          break;
        }
        case 'vault.asset.verified': {
          entry.assets_by_state['VERIFIED'] = (entry.assets_by_state['VERIFIED'] || 0) + 1;
          entry.assets_by_state['REGISTERED'] = Math.max(0, (entry.assets_by_state['REGISTERED'] || 0) - 1);
          break;
        }
        case 'vault.asset.rejected': {
          entry.assets_by_state['REJECTED'] = (entry.assets_by_state['REJECTED'] || 0) + 1;
          entry.assets_by_state['REGISTERED'] = Math.max(0, (entry.assets_by_state['REGISTERED'] || 0) - 1);
          entry.total_assets_value = String(Math.max(0, Number(entry.total_assets_value) - Number(event.payload?.face_value || 0)));
          break;
        }
        case 'vault.asset.impaired': {
          entry.assets_by_state['IMPAIRED'] = (entry.assets_by_state['IMPAIRED'] || 0) + 1;
          entry.assets_by_state['VERIFIED'] = Math.max(0, (entry.assets_by_state['VERIFIED'] || 0) - 1);
          entry.total_assets_value = String(Number(entry.total_assets_value) - Number(event.payload?.previous_value || 0) + Number(event.payload?.impaired_value || 0));
          break;
        }
        case 'vault.asset.write_down': {
          entry.total_assets_value = String(Number(entry.total_assets_value) - Number(event.payload?.write_down_amount || 0));
          break;
        }
        case 'vault.reserve.created':
        case 'vault.reserve.locked':
          entry.total_reserves_locked = String(Number(entry.total_reserves_locked) + amount);
          break;
        case 'vault.reserve.released':
        case 'vault.reserve.expired':
          entry.total_reserves_locked = String(Math.max(0, Number(entry.total_reserves_locked) - amount));
          break;
        case 'vault.custody.attested':
          entry.custody_proofs_active += 1;
          break;
        case 'vault.custody.proof_expired':
          entry.custody_proofs_active = Math.max(0, entry.custody_proofs_active - 1);
          entry.custody_proofs_expired += 1;
          break;
        case 'vault.valuation.updated':
          entry.total_assets_value = event.payload?.new_valuation || entry.total_assets_value;
          break;
        case 'vault.collateral.added':
          entry.total_collateral_held = String(Number(entry.total_collateral_held) + Number(event.payload?.effective_value || 0));
          break;
        case 'vault.collateral.released':
          entry.total_collateral_held = String(Math.max(0, Number(entry.total_collateral_held) - Number(event.payload?.effective_value || 0)));
          break;
        case 'vault.collateral.revalued':
          entry.total_collateral_held = String(Number(entry.total_collateral_held) + Number(event.payload?.value_change || 0));
          break;
        case 'vault.reconciliation.completed':
          entry.last_reconciliation_at = event.timestamp;
          break;
      }
    },
  };
}
