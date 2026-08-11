import type { Projection } from '../server/projectionEngine.js';
import type { EventEnvelope } from '../server/eventStore.js';

export function createPortfolio(): Projection {
  const state = new Map<string, any>();
  return {
    name: 'portfolio',
    description: 'All assets held by an identity across all vaults',
    sourceEvents: [
      'vault.asset.registered',
      'vault.asset.verified',
      'vault.asset.impaired',
      'vault.asset.write_down',
      'vault.ownership.transferred',
      'vault.valuation.updated',
      'vault.reserve.created',
      'vault.reserve.locked',
      'vault.reserve.released',
      'vault.reserve.expired',
      'vault.collateral.added',
      'vault.collateral.released',
      'vault.collateral.revalued',
    ],
    state,
    buildFromGenesis(events) {
      state.clear();
      for (const e of events) this.handleEvent(e);
    },
    handleEvent(event: EventEnvelope) {
      const identityId = event.payload?.beneficial_owner_id || event.payload?.owner_id || event.actor_id || 'unknown';
      if (!state.has(identityId)) {
        state.set(identityId, {
          identity_id: identityId,
          asset_count: 0,
          assets: [] as any[],
          risk_weighted_value: '0',
          total_collateral_value: '0',
          total_holdings_value: '0',
        });
      }
      const entry = state.get(identityId)!;
      const assetId = event.payload?.asset_id;
      switch (event.event_name) {
        case 'vault.asset.registered': {
          if (assetId && !entry.assets.find((a: any) => a.asset_id === assetId)) {
            entry.assets.push({
              asset_id: assetId,
              asset_type: event.payload?.asset_type,
              quantity: event.payload?.quantity || '0',
              face_value: event.payload?.face_value || '0',
              state: 'REGISTERED',
            });
            entry.asset_count += 1;
          }
          break;
        }
        case 'vault.asset.verified': {
          const asset = entry.assets.find((a: any) => a.asset_id === assetId);
          if (asset) asset.state = 'VERIFIED';
          break;
        }
        case 'vault.asset.impaired': {
          const asset = entry.assets.find((a: any) => a.asset_id === assetId);
          if (asset) {
            asset.state = 'IMPAIRED';
            asset.current_valuation = event.payload?.impaired_value;
          }
          break;
        }
        case 'vault.asset.write_down': {
          const asset = entry.assets.find((a: any) => a.asset_id === assetId);
          if (asset) asset.current_valuation = event.payload?.new_book_value;
          break;
        }
        case 'vault.ownership.transferred': {
          const newOwner = event.payload?.new_owner_id || event.payload?.beneficial_owner_id;
          if (newOwner && newOwner !== identityId) {
            const asset = entry.assets.find((a: any) => a.asset_id === assetId);
            if (asset) {
              entry.assets = entry.assets.filter((a: any) => a.asset_id !== assetId);
              entry.asset_count = Math.max(0, entry.asset_count - 1);
            }
          }
          break;
        }
        case 'vault.valuation.updated': {
          const asset = entry.assets.find((a: any) => a.asset_id === assetId);
          if (asset) asset.current_valuation = event.payload?.new_valuation;
          break;
        }
        case 'vault.reserve.created':
        case 'vault.reserve.locked':
        case 'vault.reserve.released':
        case 'vault.reserve.expired':
          break;
        case 'vault.collateral.added': {
          const collateralValue = Number(event.payload?.effective_value || 0);
          entry.total_collateral_value = String(Number(entry.total_collateral_value) + collateralValue);
          break;
        }
        case 'vault.collateral.released': {
          const collateralValue = Number(event.payload?.effective_value || 0);
          entry.total_collateral_value = String(Math.max(0, Number(entry.total_collateral_value) - collateralValue));
          break;
        }
        case 'vault.collateral.revalued': {
          const valueChange = Number(event.payload?.value_change || 0);
          entry.total_collateral_value = String(Number(entry.total_collateral_value) + valueChange);
          break;
        }
      }
      const totalHoldings = entry.assets.reduce((sum: number, a: any) => sum + Number(a.current_valuation || a.face_value || a.quantity || 0), 0);
      entry.total_holdings_value = String(totalHoldings);
      entry.risk_weighted_value = entry.total_holdings_value;
    },
  };
}
