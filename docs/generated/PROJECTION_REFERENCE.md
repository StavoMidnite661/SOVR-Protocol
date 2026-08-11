# Projection Reference

> **Compiler-generated reference documentation**
> Generated at: 2026-08-11T13:54:07.400Z
> Source: generated/registries/projections.registry.json

## Summary

| Metric | Count |
| --- | --- |
| Total Projections | 16 |
| ABI Version | v1 |

## Projections

| Projection | ProjectionID | Domain | RebuildStrategy | SourceEvents | Caching | Description |
| --- | --- | --- | --- | --- | --- | --- |
| account_summary |  | treasury |  |  | TTL=60s | Treasury balances and activity per identity |
| agent_activity |  | agent |  |  | TTL=60s | Agent execution history and audit envelopes |
| audit_timeline |  | ALL |  |  | No | Complete chronological audit trail across all domains |
| compliance_report |  | ALL |  |  | TTL=600s | Regulatory compliance metrics and violations |
| escrow_account_view |  | escrow |  |  | TTL=60s | Current state of all escrow accounts |
| governance_dashboard |  | governance |  |  | TTL=60s | Governance metrics, escalations, and amendments |
| identity_directory |  | identity |  |  | TTL=300s | Active identities, trust levels, and credentials |
| intent_queue |  | intent |  |  | TTL=10s | Active intents and their processing states |
| liquidity_position |  | treasury |  |  | TTL=30s | Current liquidity state and warnings |
| payment_status |  | payment |  |  | TTL=10s | Payment execution status across all rails |
| policy_decisions |  | policy |  |  | TTL=300s | Policy evaluation history and outcomes |
| portfolio |  | vault |  |  | TTL=120s | All assets held by an identity across all vaults |
| risk_dashboard |  | vault |  |  | TTL=60s | Risk metrics across all domains |
| settlement_summary |  | payment |  |  | TTL=120s | Settlement confirmations and failures across rails |
| treasury_dashboard |  | treasury |  |  | TTL=30s | System-wide treasury state and liquidity metrics |
| vault_holdings |  | vault |  |  | TTL=120s | Current vault state, reserves, and collateral |
