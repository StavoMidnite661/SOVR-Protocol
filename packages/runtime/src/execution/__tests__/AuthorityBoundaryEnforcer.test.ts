import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthorityBoundaryEnforcer } from '../AuthorityBoundaryEnforcer'
import {
  AuthorityCheckInput,
  CapabilityGrant
} from '../types'

function makeGrant(overrides: Partial<CapabilityGrant> = {}): CapabilityGrant {
  return {
    grantId:    'grant-001',
    actorId:    'actor-001',
    capability: 'treasury.transfer.initiate',
    scope:      '*',
    grantedBy:  'system',
    grantedAt:  Date.now() - 1000,
    ...overrides
  }
}

function makeInput(overrides: Partial<AuthorityCheckInput> = {}): AuthorityCheckInput {
  return {
    actorId:            'actor-001',
    commandName:        'treasury.transfer.initiate',
    aggregateId:        'transfer-001',
    requiredCapability: 'treasury.transfer.initiate',
    payload:            { amount: '100' },
    correlationId:      'corr-001',
    commandId:          'cmd-001',
    ...overrides
  }
}

function makeRegistry(grants: CapabilityGrant[] = []) {
  return {
    getActorCapabilities: vi.fn().mockResolvedValue(grants),
    isSystemActor:        vi.fn().mockReturnValue(false)
  }
}

function makeEventStore() {
  return {
    append: vi.fn().mockResolvedValue({ eventId: 'evt-001' })
  }
}

describe('AuthorityBoundaryEnforcer — INV-003', () => {

  describe('Capability not held', () => {
    it('denies when actor has no capabilities at all', async () => {
      const enforcer = new AuthorityBoundaryEnforcer(
        makeRegistry([]),
        makeEventStore()
      )

      const result = await enforcer.check(makeInput())

      expect(result.granted).toBe(false)
      expect(result.violation).toBe('CAPABILITY_NOT_HELD')
    })

    it('denies when actor has different capability', async () => {
      const enforcer = new AuthorityBoundaryEnforcer(
        makeRegistry([makeGrant({ capability: 'ledger.account.view' })]),
        makeEventStore()
      )

      const result = await enforcer.check(makeInput())

      expect(result.granted).toBe(false)
      expect(result.violation).toBe('CAPABILITY_NOT_HELD')
    })
  })

  describe('Scope mismatch', () => {
    it('denies when grant scope does not match aggregate', async () => {
      const enforcer = new AuthorityBoundaryEnforcer(
        makeRegistry([makeGrant({ scope: 'transfer-999' })]),
        makeEventStore()
      )

      const result = await enforcer.check(
        makeInput({ aggregateId: 'transfer-001' })
      )

      expect(result.granted).toBe(false)
      expect(result.violation).toBe('SCOPE_MISMATCH')
    })

    it('grants when scope is wildcard', async () => {
      const enforcer = new AuthorityBoundaryEnforcer(
        makeRegistry([makeGrant({ scope: '*' })]),
        makeEventStore()
      )

      const result = await enforcer.check(makeInput())

      expect(result.granted).toBe(true)
    })

    it('grants when scope matches aggregate exactly', async () => {
      const enforcer = new AuthorityBoundaryEnforcer(
        makeRegistry([makeGrant({ scope: 'transfer-001' })]),
        makeEventStore()
      )

      const result = await enforcer.check(
        makeInput({ aggregateId: 'transfer-001' })
      )

      expect(result.granted).toBe(true)
    })
  })

  describe('Capability expiry', () => {
    it('denies expired capability', async () => {
      const enforcer = new AuthorityBoundaryEnforcer(
        makeRegistry([makeGrant({ expiresAt: Date.now() - 1000 })]),
        makeEventStore()
      )

      const result = await enforcer.check(makeInput())

      expect(result.granted).toBe(false)
      expect(result.violation).toBe('CAPABILITY_EXPIRED')
    })

    it('grants capability that has not expired', async () => {
      const enforcer = new AuthorityBoundaryEnforcer(
        makeRegistry([makeGrant({ expiresAt: Date.now() + 3_600_000 })]),
        makeEventStore()
      )

      const result = await enforcer.check(makeInput())

      expect(result.granted).toBe(true)
    })

    it('grants capability with no expiry', async () => {
      const enforcer = new AuthorityBoundaryEnforcer(
        makeRegistry([makeGrant({ expiresAt: undefined })]),
        makeEventStore()
      )

      const result = await enforcer.check(makeInput())

      expect(result.granted).toBe(true)
    })
  })

  describe('Capability revocation', () => {
    it('denies revoked capability', async () => {
      const enforcer = new AuthorityBoundaryEnforcer(
        makeRegistry([makeGrant({ revokedAt: Date.now() - 500 })]),
        makeEventStore()
      )

      const result = await enforcer.check(makeInput())

      expect(result.granted).toBe(false)
      expect(result.violation).toBe('CAPABILITY_REVOKED')
    })
  })

  describe('Constraint enforcement', () => {
    it('denies when amount exceeds grant maxAmount', async () => {
      const enforcer = new AuthorityBoundaryEnforcer(
        makeRegistry([makeGrant({
          constraints: { maxAmount: '1000' }
        })]),
        makeEventStore()
      )

      const result = await enforcer.check(
        makeInput({ payload: { amount: '5000' } })
      )

      expect(result.granted).toBe(false)
      expect(result.violation).toBe('CONSTRAINT_AMOUNT_EXCEEDED')
    })

    it('grants when amount is within grant maxAmount', async () => {
      const enforcer = new AuthorityBoundaryEnforcer(
        makeRegistry([makeGrant({
          constraints: { maxAmount: '10000' }
        })]),
        makeEventStore()
      )

      const result = await enforcer.check(
        makeInput({ payload: { amount: '5000' } })
      )

      expect(result.granted).toBe(true)
    })
  })

  describe('Audit trail', () => {
    it('writes rejection event to event store on denial', async () => {
      const eventStore = makeEventStore()
      const enforcer   = new AuthorityBoundaryEnforcer(
        makeRegistry([]),
        eventStore
      )

      await enforcer.check(makeInput())

      expect(eventStore.append).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'command.rejected.authority_boundary_violation'
        })
      )
    })

    it('does not write event on grant', async () => {
      const eventStore = makeEventStore()
      const enforcer   = new AuthorityBoundaryEnforcer(
        makeRegistry([makeGrant()]),
        eventStore
      )

      await enforcer.check(makeInput())

      expect(eventStore.append).not.toHaveBeenCalled()
    })
  })

  describe('Exempt commands', () => {
    it('grants system.health.check without capability check', async () => {
      const registry = makeRegistry([])
      const enforcer = new AuthorityBoundaryEnforcer(registry, makeEventStore())

      const result = await enforcer.check(
        makeInput({ commandName: 'system.health.check' })
      )

      expect(result.granted).toBe(true)
      expect(registry.getActorCapabilities).not.toHaveBeenCalled()
    })
  })

  describe('Fail-closed — event store failure', () => {
    it('still denies even if audit write throws', async () => {
      const eventStore = {
        append: vi.fn().mockRejectedValue(new Error('DB connection failed'))
      }
      const enforcer = new AuthorityBoundaryEnforcer(
        makeRegistry([]),
        eventStore
      )

      const result = await enforcer.check(makeInput())

      expect(result.granted).toBe(false)
    })
  })
})
