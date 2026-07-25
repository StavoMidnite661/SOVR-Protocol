CREATE TABLE IF NOT EXISTS sovr_aggregate_states (
  aggregate       VARCHAR(255) NOT NULL,
  aggregate_id    VARCHAR(255) NOT NULL,
  current_state   VARCHAR(255) NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (aggregate, aggregate_id)
);

CREATE INDEX IF NOT EXISTS idx_sovr_aggregate_states_aggregate
  ON sovr_aggregate_states(aggregate);
