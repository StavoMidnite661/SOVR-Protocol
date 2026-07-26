/**
 * INV-004: Capability Boundary Enforcement
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { AcceptanceTestHarness } from '../setup/AcceptanceTestHarness'
import { randomUUID } from 'crypto'

let harness: AcceptanceTestHarness

beforeEach(async () => {
  harness = await AcceptanceTestHarness.create()
})

describe('INV-004 — Capability Boundary (Agent Prohibition)', () => {
  it('INV004-001: AI agent cannot grant capabilities (fail-closed)', async () => {
    const agent = await harness.actorFactory.create('ATTACKER') // AI_AGENT not a valid profile; use ATTACKER (simulates agent)

    const result = await harness.execute({
      commandName: 'governance.capability.grant',
      commandId: randomUUID(),
      correlationId: randomUUID(),
      actorId: agent.actorId,
      aggregateId: 'grant-001',
      payload: {
        capability_id: 'treasury.transfer.initiate',
        actor_id: 'some-other-actor'
      }
    })

    expect(result.status).toBe('REJECTED')
    expect(result.rejectionCode).toBe('INVARIANT_VIOLATION')
    expect(result.rejectionReason).toMatch(/INV-004/)
  })

  it('INV004-002: Human governance can grant (passes INV-004)', async () => {
    const gov = await harness.actorFactory.create('ADMIN') // GOVERNANCE not a valid profile; ADMIN represents governance authority

    const result = await harness.execute({
      commandName: 'governance.capability.grant',
      commandId: randomUUID(),
      correlationId: randomUUID(),
      actorId: gov.actorId,
      aggregateId: 'grant-002',
      payload: {
        capability_id: 'ledger.account.open',
        actor_id: 'human-actor-001'
      }
    })

    // May still be rejected by other gates, but not INV-004
    if (result.status === 'REJECTED') {
      expect(result.rejectionReason).not.toMatch(/INV-004/)
    } else {
      expect(result.status).toBe('ACCEPTED')
    }
  })
})
