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
    await harness.registerActor(admin)
    const assetId = `asset-audit-${randomUUID()}`

    const result = await harness.execute({
      commandName: 'vault.asset.register',
      commandId: randomUUID(),
      correlationId: randomUUID(),
      actorId: admin.actorId,
      aggregateId: assetId,
      payload: {
        asset_id: assetId,
        asset_type: 'stablecoin',
        issuer_id: admin.actorId,
        ownership_id: admin.actorId,
        custody_provider: 'sovr_internal',
        custody_location: 'sovr_internal_vault_1',
        native_unit: 'wei',
        precision: 18,
        valuation_source: 'internal',
        reserve_ratio: '1.0',
        face_value: '0',
        quantity: '0',
      },
    })

    expect(result.status).toBe('ACCEPTED')
    const events = result.events || []
    expect(events.length).toBeGreaterThan(0)

    for (const ev of events) {
      const refs = ev.audit?.constitutional_rules_referenced ?? ev.payload?.audit?.constitutional_rules_referenced
      expect(refs).toBeDefined()
      expect(refs).toContain('INV-005')
    }
  })
})
