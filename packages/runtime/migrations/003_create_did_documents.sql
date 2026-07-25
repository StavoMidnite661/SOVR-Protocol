CREATE TABLE IF NOT EXISTS sovr_did_documents (
  did           VARCHAR(255) PRIMARY KEY,
  actor_id      VARCHAR(255) NOT NULL,
  document      JSONB        NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sovr_credentials (
  credential_id VARCHAR(255) PRIMARY KEY,
  subject_did   VARCHAR(255) NOT NULL,
  issuer_did    VARCHAR(255) NOT NULL,
  credential    JSONB        NOT NULL,
  issued_at     TIMESTAMPTZ  NOT NULL,
  expires_at    TIMESTAMPTZ,
  revoked       BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sovr_did_documents_actor_id ON sovr_did_documents(actor_id);
CREATE INDEX IF NOT EXISTS idx_sovr_credentials_subject_did ON sovr_credentials(subject_did);
CREATE INDEX IF NOT EXISTS idx_sovr_credentials_issuer_did ON sovr_credentials(issuer_did);
