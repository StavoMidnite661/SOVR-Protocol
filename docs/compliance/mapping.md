# Compliance & Control Mapping

## Key Controls (as of 2026-07-22)

| Control Area | SOVR Mechanism | Evidence |
|--------------|----------------|----------|
| **Event Immutability** | INV-001 + Object.freeze | Event Store code + TLA+ models |
| **Double-Entry** | INV-002 guard | Command Bus + ledger tests |
| **Audit Trail** | 18-field envelope (21 leaf with audit subfields) + `/audit` endpoint | Every financial command |
| **Authorization** | 107 capabilities + scope + JWT | Capability Engine |
| **No Agent Bypass** | INV-004 + actor_type checks | Command Bus |
| **Value Preservation** | Reservation before execution | Treasury + Vault contracts |

## Mapping Examples

**SOC 2 CC6.1 (Logical Access)**  
→ SOVR: Capability grants + JWT + scope validation

**SOC 2 CC7.2 (System Monitoring)**  
→ SOVR: Full event streaming + projections + health

**Financial Audit**  
→ Complete trail via `correlation_id` + isComplete flag

## Recommended Evidence Package

- `management/PROJECT_STATUS_2026-07-22.yaml`
- Latest `compiler-manifest.yaml` + `boot-attestation.json`
- Sample event trail from `/api/v1/audit/...`
- TLA+ models
- Threat model

**Gap**: Formal SOC 2 / ISO 27001 control matrix is not yet maintained.