/**
 * INV-005: Audit Trail Completeness
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { AcceptanceTestHarness } from '../setup/AcceptanceTestHarness'
import { randomUUID } from 'crypto'

let harness: AcceptanceTestHarness

beforeEach(async () => {
  harness = await AcceptanceTestHarness.create()
})

describe('INV-005 — Audit Trail Completeness', () => {
  it('INV005-001: events always contain constitutional_rules_referenced including INV-005', async () => {
    const admin = await harness.actorFactory.create('ADMIN')

    const result = await harness.execute({
      commandName: 'ledger.account.open',
      commandId: randomUUID(),
      correlationId: randomUUID(),
      actorId: admin.actorId,
      aggregateId: 'acct-audit-001',
      payload: {}
    })

    expect(result.status).toBe('ACCEPTED')
    const events = result.events || []
    expect(events.length).toBeGreaterThan(0)

    for (const ev of events) {
      const audit = (ev.payload as any)?.audit || (ev as any).payload?.audit || {}
      expect(audit.constitutional_rules_referenced).toBeDefined()
      expect(audit.constitutional_rules_referenced).toContain('INV-005')
    }
  })
})
