CREATE TABLE node_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  node_id varchar(255) NOT NULL,
  node_type varchar(100) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  input jsonb,
  output jsonb,
  error text,
  attempt integer NOT NULL DEFAULT 1,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT node_executions_status_check
    CHECK (status IN ('pending', 'queued', 'running', 'completed', 'failed', 'skipped')),
  CONSTRAINT node_executions_attempt_check CHECK (attempt > 0),
  CONSTRAINT node_executions_execution_node_attempt_key
    UNIQUE (execution_id, node_id, attempt)
);

CREATE INDEX node_executions_execution_node_idx ON node_executions (execution_id, node_id);
