CREATE TABLE execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  node_execution_id uuid REFERENCES node_executions(id) ON DELETE SET NULL,
  level varchar(20) NOT NULL DEFAULT 'info',
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT execution_logs_level_check CHECK (level IN ('debug', 'info', 'warn', 'error')),
  CONSTRAINT execution_logs_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX execution_logs_execution_created_idx
  ON execution_logs (execution_id, created_at);
