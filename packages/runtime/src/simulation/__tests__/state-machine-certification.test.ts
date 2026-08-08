import { describe, it, expect } from 'vitest';
import { StateMachineInterpreter } from '../../execution/state-machine-interpreter.js';

describe('Phase 10B State Machine Certification', () => {
  const baseMachine = {
    id: 'SM-CERT-001',
    name: 'certification_test_machine',
    domain: 'test',
    aggregate: 'cert',
    initialState: 'INITIALIZED',
    finalStates: ['RESERVE_LOCKED'],
    states: {
      INITIALIZED: { description: 'Initial state' },
      REGISTERED: { description: 'Registered state' },
      RESERVE_LOCKED: { description: 'Terminal locked state' },
      UNINITIALIZED: { description: 'Uninitialized state' },
    },
    transitions: {
      INITIALIZED_to_REGISTERED: {
        trigger: 'REGISTER',
        from: 'INITIALIZED',
        to: 'REGISTERED',
        emitted_events: ['test.registered'],
        invalid: false,
      },
    },
    sourceFile: 'test',
    sourceRef: 'certification_test_machine',
    version: '1.0.0',
  };

  const interpreter = new StateMachineInterpreter([baseMachine], { allowUnresolvedConditions: true });

  it('Test 1: valid transition INITIALIZED -> REGISTERED via REGISTER trigger passes', () => {
    const result = interpreter.execute({
      machine: 'SM-CERT-001',
      domain: 'test',
      aggregate: 'cert',
      currentState: 'INITIALIZED',
      trigger: 'REGISTER',
      context: {},
    });

    expect(result.accepted).toBe(true);
    expect(result.fromState).toBe('INITIALIZED');
    expect(result.toState).toBe('REGISTERED');
    expect(result.reason).toBeUndefined();
  });

  it('Test 2: illegal transition from UNINITIALIZED with TRANSFER_EXECUTE is rejected as INVALID_STATE_TRANSITION', () => {
    const result = interpreter.execute({
      machine: 'SM-CERT-001',
      domain: 'test',
      aggregate: 'cert',
      currentState: 'UNINITIALIZED',
      trigger: 'TRANSFER_EXECUTE',
      context: {},
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/NO_TRANSITION/);
  });

  it('Test 3: terminal state RESERVE_LOCKED rejects further transition as FINAL_STATE', () => {
    const result = interpreter.execute({
      machine: 'SM-CERT-001',
      domain: 'test',
      aggregate: 'cert',
      currentState: 'RESERVE_LOCKED',
      trigger: 'REGISTER',
      context: {},
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('FINAL_STATE: RESERVE_LOCKED');
  });
});
