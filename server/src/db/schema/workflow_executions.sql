CREATE TABLE workflow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  workflow_version integer NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'queued',
  trigger_type varchar(50),
  trigger_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  queue_job_id varchar(255),
  priority integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workflow_executions_status_check
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  CONSTRAINT workflow_executions_version_check CHECK (workflow_version > 0),
  CONSTRAINT workflow_executions_trigger_data_object
    CHECK (jsonb_typeof(trigger_data) = 'object')
);

CREATE INDEX workflow_executions_workflow_created_idx
  ON workflow_executions (workflow_id, created_at DESC);
CREATE INDEX workflow_executions_status_idx ON workflow_executions (status);
