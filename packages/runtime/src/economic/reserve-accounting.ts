export interface ReserveState {
  reserve_id: string;
  opening_balance: number;
  deposits: number;
  allocations: number;
  closing_balance: number;
  available_liquidity: number;
}

export interface ReserveValidationResult {
  passed: boolean;
  detail: string;
  failure_code?: string;
}

export class ReserveAccountingEngine {
  validateReserveBalance(state: ReserveState): ReserveValidationResult {
    const expected = state.opening_balance + state.deposits - state.allocations;
    const valid = expected === state.closing_balance;
    return {
      passed: valid,
      detail: `Opening=${state.opening_balance} + Deposits=${state.deposits} - Allocations=${state.allocations} = ${expected} vs Closing=${state.closing_balance}`,
      failure_code: valid ? undefined : 'RESERVE_BALANCE_FAILURE',
    };
  }

  validateAllocation(requested: number, approved: number, reserved: number, available: number): ReserveValidationResult {
    if (requested > approved) {
      return { passed: false, detail: `Requested ${requested} > Approved ${approved}`, failure_code: 'UNAUTHORIZED_ALLOCATION' };
    }
    if (approved > reserved) {
      return { passed: false, detail: `Approved ${approved} > Reserved ${reserved}`, failure_code: 'UNAUTHORIZED_ALLOCATION' };
    }
    if (reserved > available) {
      return { passed: false, detail: `Reserved ${reserved} > Available ${available}`, failure_code: 'INSUFFICIENT_LIQUIDITY' };
    }
    return { passed: true, detail: `Requested=${requested} <= Approved=${approved} <= Reserved=${reserved} <= Available=${available}` };
  }

  validateLiquidityCoverage(reserved: number, available: number): ReserveValidationResult {
    const covered = reserved <= available;
    return {
      passed: covered,
      detail: `Reserved=${reserved} <= Available=${available}`,
      failure_code: covered ? undefined : 'INSUFFICIENT_LIQUIDITY',
    };
  }

  generateReserveProof(state: ReserveState, allocationResult: ReserveValidationResult): ReserveValidationResult & { proof_hash: string } {
    const crypto = require('crypto');
    const data = JSON.stringify({
      opening: state.opening_balance,
      deposits: state.deposits,
      allocations: state.allocations,
      closing: state.closing_balance,
      available: state.available_liquidity,
      allocation_passed: allocationResult.passed,
    });
    const proof_hash = crypto.createHash('sha256').update(data).digest('hex');
    const balanceResult = this.validateReserveBalance(state);
    return {
      ...balanceResult,
      proof_hash,
    };
  }
}
