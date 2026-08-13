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
    const agent = await harness.actorFactory.create('ATTACKER')
    await harness.registerActor(agent)

    const result = await harness.execute({
      commandName: 'governance.capability.grant',
      commandId: randomUUID(),
      correlationId: randomUUID(),
      actorId: agent.actorId,
      payload: {
        capability_id: 'treasury.transfer.request',
        actor_id: 'some-other-actor',
        scope_pattern: '*',
        expires_at: null,
        conditions: {},
      },
      aggregateId: 'grant-001',
    })

    expect(result.status).toBe('REJECTED')
    expect(result.rejectionCode).toBe('INVARIANT_VIOLATION')
    expect(result.rejectionReason).toMatch(/INV-004/)
  })

  it('INV004-002: Human governance can grant (passes INV-004)', async () => {
    const gov = await harness.actorFactory.create('ADMIN')
    await harness.registerActor(gov)

    const result = await harness.execute({
      commandName: 'governance.capability.grant',
      commandId: randomUUID(),
      correlationId: randomUUID(),
      actorId: gov.actorId,
      payload: {
        capability_id: 'ledger.entry.post',
        actor_id: 'human-actor-001',
        scope_pattern: '*',
        expires_at: null,
        conditions: {},
      },
      aggregateId: 'grant-002',
    })

    if (result.status === 'REJECTED') {
      expect(result.rejectionReason).not.toMatch(/INV-004/)
    } else {
      expect(result.status).toBe('ACCEPTED')
    }
  })
})
