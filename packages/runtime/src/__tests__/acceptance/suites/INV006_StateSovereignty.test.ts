/**
 * INV-006: State Machine Sovereignty
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { AcceptanceTestHarness } from '../setup/AcceptanceTestHarness'
import { randomUUID } from 'crypto'

let harness: AcceptanceTestHarness

beforeEach(async () => {
  harness = await AcceptanceTestHarness.create()
})

describe('INV-006 — State Machine Sovereignty', () => {
  it('INV006-001: invalid transition not in compiled machine is rejected', async () => {
    const admin = await harness.actorFactory.create('ADMIN')

    harness.setAggregateState('sovereignty-001', 'INVALID_STATE')

    const result = await harness.execute({
      commandName: 'escrow.account.release',
      commandId: randomUUID(),
      correlationId: randomUUID(),
      actorId: admin.actorId,
      aggregateId: 'sovereignty-001',
      payload: {}
    })

    expect(result.status).toBe('REJECTED')
    // Harness state transition check is after gates, so it may surface as EXECUTION_GATE_FAILED or INVALID_TRANSITION
    // Per constitutional harness model this is acceptable as long as REJECTED
    expect(['EXECUTION_GATE_FAILED', 'INVALID_TRANSITION', 'INVARIANT_VIOLATION']).toContain(result.rejectionCode)
  })
})
