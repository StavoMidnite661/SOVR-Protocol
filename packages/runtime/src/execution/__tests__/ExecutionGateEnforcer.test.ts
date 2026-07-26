import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExecutionGateEnforcer }    from '../ExecutionGateEnforcer'
import { GateCheckInput, GateDefinition, GateEvaluator, GateType, GateConfig } from '../types'

class AlwaysPassGate implements GateEvaluator {
  readonly type: GateType = 'BALANCE_SUFFICIENT'
  async evaluate() { return { passed: true } }
}

class AlwaysFailGate implements GateEvaluator {
  readonly type: GateType = 'STATE_PRECONDITION'
  async evaluate() { return { passed: false, reason: 'Test failure reason' } }
}

class ThrowingGate implements GateEvaluator {
  readonly type: GateType = 'COMPLIANCE_HOLD_ABSENT'
  async evaluate(): Promise<{ passed: boolean; reason?: string }> {
    throw new Error('Evaluator internal error')
  }
}

function makeGate(
  type:  GateType,
  fatal: boolean = true,
  overrides: Partial<GateDefinition> = {}
): GateDefinition {
  return {
    gateId:      `gate-${type}`,
    type,
    fatal,
    description: `Test gate: ${type}`,
    config:      { type } as unknown as GateConfig,
    ...overrides
  }
}

function makeInput(
  gates:   GateDefinition[] = [],
  overrides: Partial<GateCheckInput> = {}
): GateCheckInput {
  return {
    commandName:   'escrow.account.release',
    commandId:     'cmd-001',
    correlationId: 'corr-001',
    aggregateId:   'escrow-001',
    actorId:       'actor-001',
    payload:       { escrowAccountId: 'acct-001', releaseAmount: '500' },
    gates,
    ...overrides
  }
}

function makeEventStore() {
  return {
    append: vi.fn().mockResolvedValue({ eventId: 'evt-001' })
  }
}

describe('ExecutionGateEnforcer — INV-008', () => {

  describe('No gates declared', () => {
    it('passes when command has no gates', async () => {
      const enforcer = new ExecutionGateEnforcer([], makeEventStore())

      const result = await enforcer.check(makeInput([]))

      expect(result.passed).toBe(true)
      expect(result.evaluated).toHaveLength(0)
    })
  })

  describe('Single gate — pass', () => {
    it('passes when single gate succeeds', async () => {
      const enforcer = new ExecutionGateEnforcer(
        [new AlwaysPassGate()],
        makeEventStore()
      )

      const result = await enforcer.check(
        makeInput([makeGate('BALANCE_SUFFICIENT')])
      )

      expect(result.passed).toBe(true)
      expect(result.evaluated).toHaveLength(1)
      expect(result.evaluated[0].passed).toBe(true)
    })
  })

  describe('Single gate — fail', () => {
    it('fails when single fatal gate fails', async () => {
      const enforcer = new ExecutionGateEnforcer(
        [new AlwaysFailGate()],
        makeEventStore()
      )

      const result = await enforcer.check(
        makeInput([makeGate('STATE_PRECONDITION', true)])
      )

      expect(result.passed).toBe(false)
      expect(result.failedGate).toBe('gate-STATE_PRECONDITION')
      expect(result.reason).toBe('Test failure reason')
    })
  })

  describe('Multiple gates — all pass', () => {
    it('passes when all gates succeed', async () => {
      class PassGate2 extends AlwaysPassGate {
        readonly type: GateType = 'ACCOUNT_ACTIVE'
      }
      const enforcer = new ExecutionGateEnforcer(
        [new AlwaysPassGate(), new PassGate2()],
        makeEventStore()
      )

      const result = await enforcer.check(
        makeInput([
          makeGate('BALANCE_SUFFICIENT'),
          makeGate('ACCOUNT_ACTIVE')
        ])
      )

      expect(result.passed).toBe(true)
      expect(result.evaluated).toHaveLength(2)
    })
  })

  describe('Multiple gates — first fails', () => {
    it('stops evaluation after first fatal failure', async () => {
      class PassGate extends AlwaysPassGate {
        readonly type: GateType = 'ACCOUNT_ACTIVE'
      }
      const passGate = new PassGate()
      const evaluateSpy = vi.spyOn(passGate, 'evaluate')

      const enforcer = new ExecutionGateEnforcer(
        [new AlwaysFailGate(), passGate],
        makeEventStore()
      )

      const result = await enforcer.check(
        makeInput([
          makeGate('STATE_PRECONDITION', true),
          makeGate('ACCOUNT_ACTIVE', true)
        ])
      )

      expect(result.passed).toBe(false)
      expect(evaluateSpy).not.toHaveBeenCalled()
    })
  })

  describe('Advisory gates — non-blocking', () => {
    it('continues execution when advisory gate fails', async () => {
      class PassGate extends AlwaysPassGate {
        readonly type: GateType = 'ACCOUNT_ACTIVE'
      }

      const enforcer = new ExecutionGateEnforcer(
        [new AlwaysFailGate(), new PassGate()],
        makeEventStore()
      )

      const result = await enforcer.check(
        makeInput([
          makeGate('STATE_PRECONDITION', false),
          makeGate('ACCOUNT_ACTIVE', true)
        ])
      )

      expect(result.passed).toBe(true)
      expect(result.evaluated).toHaveLength(2)
      expect(result.evaluated[0].passed).toBe(false)
      expect(result.evaluated[1].passed).toBe(true)
    })
  })

  describe('Unknown gate type — fail closed', () => {
    it('fails closed when gate type has no evaluator', async () => {
      const enforcer = new ExecutionGateEnforcer([], makeEventStore())

      const result = await enforcer.check(
        makeInput([makeGate('AMOUNT_WITHIN_LIMIT', true)])
      )

      expect(result.passed).toBe(false)
      expect(result.reason).toContain('Unknown gate type')
    })
  })

  describe('Evaluator throws — fail closed', () => {
    it('fails closed when evaluator throws an exception', async () => {
      const enforcer = new ExecutionGateEnforcer(
        [new ThrowingGate()],
        makeEventStore()
      )

      const result = await enforcer.check(
        makeInput([makeGate('COMPLIANCE_HOLD_ABSENT', true)])
      )

      expect(result.passed).toBe(false)
      expect(result.reason).toContain('Gate evaluator error')
    })
  })

  describe('Audit trail', () => {
    it('writes rejection event when fatal gate fails', async () => {
      const eventStore = makeEventStore()
      const enforcer   = new ExecutionGateEnforcer(
        [new AlwaysFailGate()],
        eventStore
      )

      await enforcer.check(
        makeInput([makeGate('STATE_PRECONDITION', true)])
      )

      expect(eventStore.append).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'command.rejected.execution_gate_failed'
        })
      )
    })

    it('writes advisory event when non-fatal gate fails', async () => {
      const eventStore = makeEventStore()
      class PassGate extends AlwaysPassGate {
        readonly type: GateType = 'ACCOUNT_ACTIVE'
      }

      const enforcer = new ExecutionGateEnforcer(
        [new AlwaysFailGate(), new PassGate()],
        eventStore
      )

      await enforcer.check(
        makeInput([
          makeGate('STATE_PRECONDITION', false),
          makeGate('ACCOUNT_ACTIVE', true)
        ])
      )

      expect(eventStore.append).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'command.advisory.gate_warning'
        })
      )
    })

    it('includes full evaluation record in rejection event', async () => {
      const eventStore = makeEventStore()
      const enforcer   = new ExecutionGateEnforcer(
        [new AlwaysFailGate()],
        eventStore
      )

      await enforcer.check(
        makeInput([makeGate('STATE_PRECONDITION', true)])
      )

      const appendCall = eventStore.append.mock.calls[0][0]
      expect(appendCall.payload.evaluated).toBeDefined()
      expect(appendCall.payload.gateType).toBe('STATE_PRECONDITION')
    })

    it('still fails when audit write throws', async () => {
      const eventStore = {
        append: vi.fn().mockRejectedValue(new Error('DB down'))
      }
      const enforcer = new ExecutionGateEnforcer(
        [new AlwaysFailGate()],
        eventStore
      )

      const result = await enforcer.check(
        makeInput([makeGate('STATE_PRECONDITION', true)])
      )

      expect(result.passed).toBe(false)
    })
  })

  describe('Evaluation record timing', () => {
    it('records duration for each gate', async () => {
      const enforcer = new ExecutionGateEnforcer(
        [new AlwaysPassGate()],
        makeEventStore()
      )

      const result = await enforcer.check(
        makeInput([makeGate('BALANCE_SUFFICIENT')])
      )

      expect(result.evaluated[0].durationMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Registered gate types', () => {
    it('reports registered gate types', () => {
      const enforcer = new ExecutionGateEnforcer(
        [new AlwaysPassGate(), new AlwaysFailGate()],
        makeEventStore()
      )

      const types = enforcer.getRegisteredGateTypes()
      expect(types).toContain('BALANCE_SUFFICIENT')
      expect(types).toContain('STATE_PRECONDITION')
    })
  })
})
