CREATE TABLE IF NOT EXISTS sovr_events (
  event_id UUID PRIMARY KEY,
  event_name VARCHAR(255) NOT NULL,
  event_version VARCHAR(50) NOT NULL,
  schema_version VARCHAR(50) NOT NULL,
  aggregate VARCHAR(255) NOT NULL,
  aggregate_id VARCHAR(255) NOT NULL,
  source_domain VARCHAR(100) NOT NULL,
  command_id UUID NOT NULL,
  triggering_command VARCHAR(255) NOT NULL,
  causation_id UUID,
  correlation_id UUID,
  actor_id VARCHAR(255) NOT NULL,
  identity_context JSONB NOT NULL,
  policy_decision_id UUID,
  capability_id VARCHAR(255),
  timestamp TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL,
  projection_effect JSONB NOT NULL,
  audit JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sovr_events_aggregate ON sovr_events(aggregate, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_sovr_events_domain ON sovr_events(source_domain);
CREATE INDEX IF NOT EXISTS idx_sovr_events_timestamp ON sovr_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_sovr_events_correlation ON sovr_events(correlation_id);

CREATE OR REPLACE RULE no_update_sovr_events AS
  ON UPDATE TO sovr_events DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_sovr_events AS
  ON DELETE TO sovr_events DO INSTEAD NOTHING;
