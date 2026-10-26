CREATE TABLE workflow_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_id varchar(255) NOT NULL,
  cron_expression varchar(100) NOT NULL,
  timezone varchar(100) NOT NULL DEFAULT 'UTC',
  enabled boolean NOT NULL DEFAULT true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workflow_schedules_workflow_node_key UNIQUE (workflow_id, node_id)
);

CREATE INDEX workflow_schedules_next_run_idx
  ON workflow_schedules (next_run_at) WHERE enabled;
