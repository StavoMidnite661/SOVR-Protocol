import type { Projection } from '../server/projectionEngine.js';
import type { EventEnvelope } from '../server/eventStore.js';

export function createRiskDashboard(): Projection {
  const state = new Map<string, any>();
  const GLOBAL = 'global';
  return {
    name: 'risk_dashboard',
    description: 'Risk metrics across all domains',
    sourceEvents: [
      'vault.asset.registered',
      'vault.asset.impaired',
      'vault.asset.write_down',
      'vault.valuation.updated',
      'vault.collateral.valued',
      'vault.collateral.margin_call',
      'vault.collateral.liquidation_initiated',
      'vault.reserve.expired',
      'treasury.liquidity.warning',
    ],
    state,
    buildFromGenesis(events) {
      state.clear();
      for (const e of events) this.handleEvent(e);
    },
    handleEvent(event: EventEnvelope) {
      if (!state.has(GLOBAL)) {
        state.set(GLOBAL, {
          active_margin_calls: 0,
          collateral_coverage_ratio: '1.00',
          concentration_risk: {} as Record<string, number>,
          impaired_assets_count: 0,
          impaired_assets_value: '0',
          liquidity_warnings_active: 0,
          total_risk_exposure: '0',
        });
      }
      const entry = state.get(GLOBAL)!;
      switch (event.event_name) {
        case 'vault.asset.registered': {
          const assetType = event.payload?.asset_type || 'unknown';
          entry.concentration_risk[assetType] = (entry.concentration_risk[assetType] || 0) + 1;
          entry.total_risk_exposure = String(Number(entry.total_risk_exposure) + Number(event.payload?.face_value || 0));
          break;
        }
        case 'vault.asset.impaired':
          entry.impaired_assets_count += 1;
          entry.impaired_assets_value = String(Number(entry.impaired_assets_value) + Number(event.payload?.impaired_value || 0));
          entry.total_risk_exposure = String(Number(entry.total_risk_exposure) + Number(event.payload?.impaired_value || 0));
          break;
        case 'vault.asset.write_down':
          entry.total_risk_exposure = String(Number(entry.total_risk_exposure) - Number(event.payload?.write_down_amount || 0));
          break;
        case 'vault.valuation.updated':
          entry.total_risk_exposure = event.payload?.new_valuation || entry.total_risk_exposure;
          break;
        case 'vault.collateral.valued':
          entry.collateral_coverage_ratio = event.payload?.new_effective_value || entry.collateral_coverage_ratio;
          break;
        case 'vault.collateral.margin_call':
          entry.active_margin_calls += 1;
          break;
        case 'vault.collateral.liquidation_initiated':
          entry.active_margin_calls = Math.max(0, entry.active_margin_calls - 1);
          break;
        case 'vault.reserve.expired':
          entry.total_risk_exposure = String(Number(entry.total_risk_exposure) - Number(event.payload?.reserved_amount || 0));
          break;
        case 'treasury.liquidity.warning':
          entry.liquidity_warnings_active += 1;
          break;
      }
    },
  };
}
