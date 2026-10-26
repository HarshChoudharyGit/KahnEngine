CREATE TABLE IF NOT EXISTS workflows (
  id text PRIMARY KEY,
  name text NOT NULL,
  nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  edges jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workflows_nodes_array CHECK (jsonb_typeof(nodes) = 'array'),
  CONSTRAINT workflows_edges_array CHECK (jsonb_typeof(edges) = 'array')
);

CREATE INDEX IF NOT EXISTS workflows_updated_at_idx ON workflows (updated_at DESC);

CREATE TABLE IF NOT EXISTS executions (
  id text PRIMARY KEY,
  workflow_id text REFERENCES workflows(id) ON DELETE SET NULL,
  workflow_name text NOT NULL,
  trigger_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED')),
  node_statuses jsonb NOT NULL DEFAULT '{}'::jsonb,
  logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms bigint,
  error text,
  CONSTRAINT executions_node_statuses_object CHECK (jsonb_typeof(node_statuses) = 'object'),
  CONSTRAINT executions_logs_array CHECK (jsonb_typeof(logs) = 'array'),
  CONSTRAINT executions_steps_array CHECK (jsonb_typeof(steps) = 'array')
);

CREATE INDEX IF NOT EXISTS executions_workflow_started_idx
  ON executions (workflow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS executions_started_idx ON executions (started_at DESC);

CREATE TABLE IF NOT EXISTS integration_sessions (
  provider text PRIMARY KEY CHECK (provider IN ('github', 'gmail')),
  encrypted_payload text NOT NULL,
  nonce text NOT NULL,
  authentication_tag text NOT NULL,
  user_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
