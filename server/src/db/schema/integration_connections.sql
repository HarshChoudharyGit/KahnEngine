CREATE TABLE integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(50) NOT NULL UNIQUE,
  account_name varchar(255),
  status varchar(20) NOT NULL DEFAULT 'connected',
  scopes text[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integration_connections_status_check
    CHECK (status IN ('connected', 'disconnected', 'error')),
  CONSTRAINT integration_connections_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);
