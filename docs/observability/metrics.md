# SOVR Observability & Metrics

## Recommended Metrics (Prometheus style)

### Core
- `sovr_events_total` (counter, by domain, event_name)
- `sovr_commands_total` (by command, status)
- `sovr_invariant_violations_total` (by invariant)
- `sovr_pipeline_stage_duration_seconds` (histogram, by stage)

### Event Store
- `sovr_event_store_size`
- `sovr_causation_breaks_total`
- `sovr_projection_lag_seconds` (by projection)

### Security
- `sovr_capability_grants_total`
- `sovr_auth_failures_total`
- `sovr_jwt_validations_total`

### Adapters
- `sovr_adapter_success_total` / `failure_total` (by rail)

## Recommended Logs (structured JSON)

Every event should be logged with:
- full 18-field envelope (21 leaf with audit subfields)
- `trace_id` / `correlation_id`
- `build_hash`

## Dashboards

- **Executive**: Overall system health + INV violation rate
- **Operational**: Pipeline latency, projection lag, adapter health
- **Security**: Capability grants, auth failures, actor behavior

## Alerting Rules (examples)

- INV-00x violation > 0 in last 5m
- Event store append rate drops > 50%
- Projection lag > 30s
- Adapter failure rate > 1%

**Implementation Note**: The current runtime emits events. Wire them to your observability stack via Kafka/Redis.