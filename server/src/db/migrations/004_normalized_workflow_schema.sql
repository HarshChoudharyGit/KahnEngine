DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM github_watcher_cursors) THEN
    RAISE EXCEPTION 'github_watcher_cursors contains data; migrate cursor state before applying 004';
  END IF;
  DROP TABLE github_watcher_cursors;
END
$$;

ALTER TABLE executions RENAME TO executions_legacy;
ALTER TABLE workflows RENAME TO workflows_legacy;
ALTER INDEX IF EXISTS workflows_updated_at_idx RENAME TO workflows_legacy_updated_at_idx;

CREATE TABLE workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  name varchar(255) NOT NULL,
  description text,
  status varchar(20) NOT NULL DEFAULT 'draft',
  definition jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workflows_status_check CHECK (status IN ('draft', 'active', 'archived')),
  CONSTRAINT workflows_version_check CHECK (version > 0),
  CONSTRAINT workflows_definition_object CHECK (jsonb_typeof(definition) = 'object'),
  CONSTRAINT workflows_definition_graph CHECK (
    jsonb_typeof(definition->'nodes') = 'array'
    AND jsonb_typeof(definition->'edges') = 'array'
  )
);

INSERT INTO workflows (id, legacy_id, name, definition, created_at, updated_at)
SELECT
  md5('kahn-workflow:' || id)::uuid,
  id,
  left(name, 255),
  jsonb_build_object('nodes', nodes, 'edges', edges),
  created_at,
  updated_at
FROM workflows_legacy;

INSERT INTO workflows (id, legacy_id, name, definition)
SELECT DISTINCT
  md5('kahn-orphan:' || coalesce(e.workflow_id, e.id))::uuid,
  '__legacy_orphan_workflow__' || coalesce(e.workflow_id, e.id),
  left(coalesce(e.workflow_name, 'Recovered workflow'), 255),
  '{"nodes":[],"edges":[],"recovered":true}'::jsonb
FROM executions_legacy e
LEFT JOIN workflows_legacy w ON w.id = e.workflow_id
WHERE w.id IS NULL
ON CONFLICT (legacy_id) DO NOTHING;

CREATE TABLE workflow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id text UNIQUE,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE RESTRICT,
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

INSERT INTO workflow_executions (
  id, legacy_id, workflow_id, workflow_version, status, trigger_type,
  trigger_data, started_at, finished_at, error, created_at
)
SELECT
  md5('kahn-execution:' || e.id)::uuid,
  e.id,
  w.id,
  w.version,
  CASE e.status
    WHEN 'RUNNING' THEN 'running'
    WHEN 'SUCCESS' THEN 'completed'
    WHEN 'FAILED' THEN 'failed'
    ELSE 'queued'
  END,
  CASE
    WHEN e.trigger_payload->>'source' = 'github-poller' THEN 'github_webhook'
    WHEN e.trigger_payload->>'event' IS NOT NULL THEN e.trigger_payload->>'event'
    ELSE 'manual'
  END,
  CASE WHEN jsonb_typeof(e.trigger_payload) = 'object'
       THEN coalesce(e.trigger_payload, '{}'::jsonb)
       ELSE jsonb_build_object('value', e.trigger_payload)
  END,
  CASE WHEN e.status = 'PENDING' THEN NULL ELSE e.started_at END,
  e.completed_at,
  e.error,
  e.started_at
FROM executions_legacy e
JOIN workflows w
  ON w.legacy_id = coalesce(e.workflow_id, '__legacy_orphan_workflow__' || coalesce(e.workflow_id, e.id));

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

INSERT INTO node_executions (
  execution_id, node_id, node_type, status, output, error, attempt,
  started_at, finished_at, created_at
)
SELECT
  x.id,
  left(coalesce(step.value->>'nodeId', 'unknown'), 255),
  left(coalesce(step.value->>'nodeType', step.value->>'category', 'unknown'), 100),
  CASE step.value->>'status'
    WHEN 'SUCCESS' THEN 'completed'
    WHEN 'FAILED' THEN 'failed'
    WHEN 'RUNNING' THEN 'running'
    WHEN 'SKIPPED' THEN 'skipped'
    WHEN 'QUEUED' THEN 'queued'
    ELSE 'pending'
  END,
  step.value->'output',
  step.value->>'error',
  1,
  x.started_at,
  CASE
    WHEN nullif(step.value->>'completedAt', '') IS NOT NULL
      THEN (step.value->>'completedAt')::timestamptz
    ELSE NULL
  END,
  coalesce(
    nullif(step.value->>'completedAt', '')::timestamptz,
    x.created_at
  )
FROM executions_legacy e
JOIN workflow_executions x ON x.legacy_id = e.id
CROSS JOIN LATERAL jsonb_array_elements(e.steps) AS step(value)
WHERE coalesce(step.value->>'nodeId', '') <> ''
ON CONFLICT (execution_id, node_id, attempt) DO NOTHING;

INSERT INTO node_executions (
  execution_id, node_id, node_type, status, started_at, created_at
)
SELECT
  x.id,
  left(statuses.key, 255),
  'unknown',
  CASE statuses.value #>> '{}'
    WHEN 'SUCCESS' THEN 'completed'
    WHEN 'FAILED' THEN 'failed'
    WHEN 'RUNNING' THEN 'running'
    WHEN 'SKIPPED' THEN 'skipped'
    WHEN 'QUEUED' THEN 'queued'
    ELSE 'pending'
  END,
  x.started_at,
  x.created_at
FROM executions_legacy e
JOIN workflow_executions x ON x.legacy_id = e.id
CROSS JOIN LATERAL jsonb_each(coalesce(e.node_statuses, '{}'::jsonb)) AS statuses
WHERE NOT EXISTS (
  SELECT 1 FROM node_executions n
  WHERE n.execution_id = x.id AND n.node_id = left(statuses.key, 255)
);

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

INSERT INTO workflow_schedules (workflow_id, node_id, cron_expression, timezone)
SELECT w.id,
       left(node.value->>'id', 255),
       left(coalesce(node.value #>> '{data,configuration,schedule}', node.value #>> '{data,schedule}'), 100),
       left(coalesce(node.value #>> '{data,configuration,timezone}', node.value #>> '{data,timezone}', 'UTC'), 100)
FROM workflows_legacy old
JOIN workflows w ON w.legacy_id = old.id
CROSS JOIN LATERAL jsonb_array_elements(old.nodes) AS node(value)
WHERE lower(coalesce(node.value #>> '{data,configType}', node.value->>'type', '')) IN ('crontrigger', 'cron')
  AND coalesce(node.value #>> '{data,configuration,schedule}', node.value #>> '{data,schedule}') IS NOT NULL
  AND coalesce(node.value->>'id', '') <> ''
ON CONFLICT (workflow_id, node_id) DO NOTHING;

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

INSERT INTO execution_logs (execution_id, level, message, metadata, created_at)
SELECT
  x.id,
  CASE upper(coalesce(entry.value->>'level', 'INFO'))
    WHEN 'DEBUG' THEN 'debug'
    WHEN 'WARN' THEN 'warn'
    WHEN 'WARNING' THEN 'warn'
    WHEN 'ERROR' THEN 'error'
    ELSE 'info'
  END,
  coalesce(entry.value->>'message', ''),
  (entry.value - 'message' - 'level'),
  CASE
    WHEN jsonb_typeof(entry.value->'timestamp') = 'number'
      THEN to_timestamp((entry.value->>'timestamp')::double precision / 1000)
    WHEN nullif(entry.value->>'timestamp', '') IS NOT NULL
      THEN (entry.value->>'timestamp')::timestamptz
    ELSE x.created_at
  END
FROM executions_legacy e
JOIN workflow_executions x ON x.legacy_id = e.id
CROSS JOIN LATERAL jsonb_array_elements(e.logs) AS entry(value);

INSERT INTO integration_connections (provider, account_name, status, metadata)
SELECT provider, coalesce(user_profile->>'login', user_profile->>'email'),
       CASE WHEN connected THEN 'connected' ELSE 'disconnected' END,
       jsonb_build_object('profile', user_profile)
FROM integration_sessions
ON CONFLICT (provider) DO UPDATE SET
  account_name = EXCLUDED.account_name,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();

CREATE INDEX workflow_executions_workflow_created_idx
  ON workflow_executions (workflow_id, created_at DESC);
CREATE INDEX workflow_executions_status_idx ON workflow_executions (status);
CREATE INDEX node_executions_execution_node_idx ON node_executions (execution_id, node_id);
CREATE INDEX execution_logs_execution_created_idx ON execution_logs (execution_id, created_at);
CREATE INDEX workflow_schedules_next_run_idx ON workflow_schedules (next_run_at) WHERE enabled;
CREATE INDEX workflows_updated_at_idx ON workflows (updated_at DESC);

DROP TABLE executions_legacy;
DROP TABLE workflows_legacy;
