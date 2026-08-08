import { describe, it, expect } from 'vitest';
import { EconomicValidator } from '../economic-validator.js';

describe('Phase 10B Economic Integrity Validator', () => {
  const validator = new EconomicValidator();

  it('validates conservation invariant across transfer lifecycle', () => {
    const events = [
      { event_name: 'treasury.transfer.requested', payload: { amount: 100 } },
      { event_name: 'treasury.transfer.reserved', payload: { amount: 100 } },
      { event_name: 'treasury.transfer.settled', payload: { amount: 100 } },
    ];
    const result = validator.validateConservation(events);
    expect(result.passed).toBe(true);
    expect(result.failure_code).toBeUndefined();
  });

  it('validates conservation with remaining reserve', () => {
    const events = [
      { event_name: 'treasury.transfer.requested', payload: { amount: 100 } },
      { event_name: 'treasury.transfer.reserved', payload: { amount: 100 } },
    ];
    const result = validator.validateConservation(events);
    expect(result.passed).toBe(true);
    expect(result.failure_code).toBeUndefined();
  });

  it('rejects conservation violation', () => {
    const events = [
      { event_name: 'treasury.transfer.requested', payload: { amount: 100 } },
      { event_name: 'treasury.transfer.settled', payload: { amount: 150 } },
    ];
    const result = validator.validateConservation(events);
    expect(result.passed).toBe(false);
    expect(result.failure_code).toBe('ECONOMIC_INVARIANT_FAILURE');
  });

  it('validates ledger balance invariant', () => {
    const events = [
      {
        event_name: 'ledger.entry.posted',
        payload: {
          postings: [
            { amount: 100, direction: 'DEBIT' },
            { amount: 100, direction: 'CREDIT' },
          ],
        },
      },
    ];
    const result = validator.validateLedgerBalance(events);
    expect(result.passed).toBe(true);
    expect(result.failure_code).toBeUndefined();
  });

  it('rejects unbalanced ledger', () => {
    const events = [
      {
        event_name: 'ledger.entry.posted',
        payload: {
          postings: [
            { amount: 100, direction: 'DEBIT' },
            { amount: 50, direction: 'CREDIT' },
          ],
        },
      },
    ];
    const result = validator.validateLedgerBalance(events);
    expect(result.passed).toBe(false);
    expect(result.failure_code).toBe('ECONOMIC_INVARIANT_FAILURE');
  });

  it('validates treasury authorization chain', () => {
    const events = [
      { event_name: 'treasury.transfer.requested', payload: { amount: 50 } },
      { event_name: 'treasury.transfer.authorized', payload: { amount: 50 } },
      { event_name: 'treasury.transfer.reserved', payload: { amount: 50 } },
    ];
    const result = validator.validateTreasuryAuthorization(events);
    expect(result.passed).toBe(true);
    expect(result.failure_code).toBeUndefined();
  });

  it('rejects treasury authorization violation', () => {
    const events = [
      { event_name: 'treasury.transfer.requested', payload: { amount: 50 } },
      { event_name: 'treasury.transfer.authorized', payload: { amount: 30 } },
      { event_name: 'treasury.transfer.reserved', payload: { amount: 20 } },
    ];
    const result = validator.validateTreasuryAuthorization(events);
    expect(result.passed).toBe(false);
    expect(result.failure_code).toBe('ECONOMIC_INVARIANT_FAILURE');
  });
});
