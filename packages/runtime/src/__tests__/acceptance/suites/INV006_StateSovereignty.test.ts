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
    await harness.registerActor(admin)
    const escrowId = 'sovereignty-001'

    harness.setAggregateState(escrowId, 'INVALID_STATE', 'escrow_account', 'escrow')

    const result = await harness.execute({
      commandName: 'escrow.account.release',
      commandId: randomUUID(),
      correlationId: randomUUID(),
      actorId: admin.actorId,
      aggregateId: escrowId,
      payload: {
        escrow_id: escrowId,
        release_proof: 'proof',
      },
    })

    expect(result.status).toBe('REJECTED')
    expect(['EXECUTION_GATE_FAILED', 'INVALID_TRANSITION', 'INVARIANT_VIOLATION', 'InvalidStateTransitionError']).toContain(result.rejectionCode)
  })
})
