# Proposal: Event Store Merkle Root for External Auditability

**Status:** Proposed (2026-07-22)

## Goal

Expose a cryptographic hash of the entire event history so external auditors and third parties can verify that the event log has not been tampered with.

## Design Sketch

1. On every append (or on a periodic schedule), compute a Merkle root over the ordered list of event IDs + hashes.
2. Store the current root in the Event Store metadata.
3. Expose it via:
   - `/health`
   - `/api/v1/manifest`
   - A new endpoint `/api/v1/event-store/root`

## Benefits
- Strong external verifiability (complements build_hash)
- Enables "proof of history" style auditing
- Useful for regulatory submissions

## Implementation Notes
- Can be computed incrementally (rolling Merkle tree)
- Should be included in the 18-field envelope (21 leaf with audit subfields) or as a separate projection
- Add to boot attestation chain

This would be a high-value addition for the "auditable financial OS" claim.