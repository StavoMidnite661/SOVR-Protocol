import { describe, it, expect } from 'vitest';
import { ReserveAccountingEngine } from '../../economic/reserve-accounting.js';

describe('Phase 10C Reserve Accounting Engine', () => {
  const engine = new ReserveAccountingEngine();

  it('validates reserve balance opening + deposits - allocations = closing', () => {
    const result = engine.validateReserveBalance({
      reserve_id: 'res-001',
      opening_balance: 1000,
      deposits: 500,
      allocations: 300,
      closing_balance: 1200,
      available_liquidity: 1200,
    });
    expect(result.passed).toBe(true);
    expect(result.failure_code).toBeUndefined();
  });

  it('rejects reserve balance failure', () => {
    const result = engine.validateReserveBalance({
      reserve_id: 'res-002',
      opening_balance: 1000,
      deposits: 0,
      allocations: 0,
      closing_balance: 999,
      available_liquidity: 999,
    });
    expect(result.passed).toBe(false);
    expect(result.failure_code).toBe('RESERVE_BALANCE_FAILURE');
  });

  it('validates allocation chain requested <= approved <= reserved <= available', () => {
    const result = engine.validateAllocation(100, 100, 100, 100);
    expect(result.passed).toBe(true);
  });

  it('rejects unauthorized allocation requested > approved', () => {
    const result = engine.validateAllocation(200, 100, 100, 100);
    expect(result.passed).toBe(false);
    expect(result.failure_code).toBe('UNAUTHORIZED_ALLOCATION');
  });

  it('rejects insufficient liquidity reserved > available', () => {
    const result = engine.validateAllocation(100, 100, 200, 100);
    expect(result.passed).toBe(false);
    expect(result.failure_code).toBe('INSUFFICIENT_LIQUIDITY');
  });

  it('validates liquidity coverage', () => {
    const result = engine.validateLiquidityCoverage(50, 100);
    expect(result.passed).toBe(true);
  });

  it('rejects liquidity coverage failure', () => {
    const result = engine.validateLiquidityCoverage(150, 100);
    expect(result.passed).toBe(false);
    expect(result.failure_code).toBe('INSUFFICIENT_LIQUIDITY');
  });

  it('generates deterministic reserve proof', () => {
    const result = engine.generateReserveProof({
      reserve_id: 'res-003',
      opening_balance: 1000,
      deposits: 500,
      allocations: 300,
      closing_balance: 1200,
      available_liquidity: 1200,
    }, { passed: true, detail: 'ok' });
    expect(result.passed).toBe(true);
    expect(result.proof_hash).toBeTruthy();
    expect(result.proof_hash).toHaveLength(64);
  });

  it('rejects reserve proof on balance failure', () => {
    const result = engine.generateReserveProof({
      reserve_id: 'res-004',
      opening_balance: 1000,
      deposits: 0,
      allocations: 0,
      closing_balance: 999,
      available_liquidity: 999,
    }, { passed: true, detail: 'ok' });
    expect(result.passed).toBe(false);
    expect(result.failure_code).toBe('RESERVE_BALANCE_FAILURE');
  });
});
